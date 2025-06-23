#!/usr/bin/env node

require('dotenv').config();
const { Worker } = require('bullmq');
const { bullMQConnection } = require('./config/redis');
const { initializeFirebase } = require('./config/firebase');
const logger = require('./utils/logger');
const VideoRenderer = require('./services/videoRenderer');
const SimpleVideoRenderer = require('./services/simpleVideoRenderer');
const AfterEffectsProcessor = require('./services/afterEffectsProcessor');
const TemplateManager = require('./services/templateManager');
const AssetProcessor = require('./services/assetProcessor');
const WebhookService = require('./services/webhookService');
const { validateVideoRequest } = require('./validation/schemas');
const Redis = require('ioredis');

// Configuración del worker
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 2;
const WORKER_NAME = process.env.WORKER_NAME || `worker-${process.pid}`;

class VideoWorker {
  constructor() {
    this.connection = bullMQConnection.connection;
    this.videoRenderer = new VideoRenderer();
    this.simpleVideoRenderer = new SimpleVideoRenderer();
    this.afterEffectsProcessor = new AfterEffectsProcessor();
    this.templateManager = new TemplateManager();
    this.assetProcessor = new AssetProcessor();
    this.webhookService = new WebhookService();
    this.worker = null;
    this.isShuttingDown = false;
    
    // Redis subscriber para notificaciones de templates
    this.subscriber = new Redis(bullMQConnection.connection);
    this.setupTemplateSubscription();
  }

  async initialize() {
    try {
      logger.info(`Worker: Inicializando ${WORKER_NAME}...`);

      // Inicializar Firebase
      await initializeFirebase();

      // Crear worker de BullMQ
      this.worker = new Worker('video-processing', this.processJob.bind(this), {
        connection: this.connection,
        concurrency: WORKER_CONCURRENCY,
        removeOnComplete: 100,
        removeOnFail: 50,
        stalledInterval: 30000,
        maxStalledCount: 1,
      });

      // Configurar eventos del worker
      this.setupWorkerEvents();

      logger.info(`Worker: ${WORKER_NAME} inicializado con concurrencia ${WORKER_CONCURRENCY}`);

    } catch (error) {
      logger.error('Worker: Error en inicialización', error);
      throw error;
    }
  }

  async processJob(job) {
    const { type, ...jobData } = job.data;
    
    logger.info(`Worker: Procesando trabajo ${job.id} - Tipo: ${type}`, {
      jobId: job.id,
      type,
      clientId: jobData.clientId
    });

    try {
      // Actualizar progreso inicial
      await job.updateProgress(0);

      let result;

      switch (type) {
        case 'render-video':
          result = await this.processVideoRender(job, jobData);
          break;
        
        case 'render-template':
          result = await this.processTemplateRender(job, jobData);
          break;
        
        case 'validate-timeline':
          result = await this.processTimelineValidation(job, jobData);
          break;
        
        case 'process-assets':
          result = await this.processAssets(job, jobData);
          break;
        
        case 'generate-thumbnail':
          result = await this.processThumbnailGeneration(job, jobData);
          break;
        
        default:
          throw new Error(`Tipo de trabajo no soportado: ${type}`);
      }

      // Enviar webhook si está configurado
      if (jobData.callback) {
        await this.webhookService.sendWebhook(jobData.callback, {
          jobId: job.id,
          status: 'completed',
          result
        });
      }

      logger.info(`Worker: Trabajo completado ${job.id}`, { jobId: job.id, result });
      return result;

    } catch (error) {
      logger.error(`Worker: Error procesando trabajo ${job.id}`, error);

      // Enviar webhook de error si está configurado
      if (jobData.callback) {
        await this.webhookService.sendWebhook(jobData.callback, {
          jobId: job.id,
          status: 'failed',
          error: {
            message: error.message,
            code: error.code || 'PROCESSING_ERROR'
          }
        });
      }

      throw error;
    }
  }

  async processVideoRender(job, jobData) {
    const { timeline, output, mergeFields, clientId } = jobData;

    // Fase 1: Validación y preparación (0-10%)
    await job.updateProgress(5);
    
    // Usar SimpleVideoRenderer para todo el contenido multimedia
    await this.simpleVideoRenderer.validateTimeline(timeline);
    
    // Fase 2: Procesamiento de merge fields (10-20%)
    await job.updateProgress(10);
    const processedTimeline = await this.videoRenderer.processMergeFields(timeline, mergeFields);
    
    // Fase 3: Descarga y procesamiento de assets si es necesario (20-40%)
    await job.updateProgress(20);
    const hasAssets = processedTimeline.tracks.some(track =>
      track.clips.some(clip => ['image', 'video', 'audio'].includes(clip.type) && clip.src)
    ) || processedTimeline.soundtrack?.src;
    
    if (hasAssets) {
      await this.assetProcessor.processTimelineAssets(processedTimeline, (progress) => {
        job.updateProgress(20 + (progress * 0.2)); // 20% a 40%
      });
    }
    
    // Fase 4: Renderizado con SimpleVideoRenderer (40-90%)
    await job.updateProgress(40);
    
    const outputPath = `output/${job.id}.mp4`;
    const renderResult = await this.simpleVideoRenderer.renderVideo(processedTimeline, outputPath, mergeFields);
    
    // Fase 5: Subida a Firebase Storage (90-100%)
    await job.updateProgress(90);
    const uploadResult = await this.assetProcessor.uploadToFirebase(
      renderResult, 
      `outputs/${clientId}/${job.id}.${output?.format || 'mp4'}`,
      { jobId: job.id, clientId }
    );

    await job.updateProgress(100);

    // Limpiar archivos temporales
    await this.simpleVideoRenderer.cleanup(renderResult);

    return {
      videoId: job.id,
      url: uploadResult.publicUrl,
      filename: uploadResult.destination,
      duration: this.calculateEstimatedDuration(processedTimeline),
      size: uploadResult.size,
      format: output?.format || 'mp4',
      resolution: { width: 1920, height: 1080 },
      createdAt: new Date().toISOString()
    };
  }

  async processTemplateRender(job, jobData) {
    const { templateId, mergeFields, output, clientId } = jobData;

    // Obtener template con verificación de existencia
    await job.updateProgress(5);
    
    logger.info(`Worker: Buscando template ${templateId}`, { templateId, jobId: job.id });
    
    // Asegurar que el template existe
    const templateExists = await this.templateManager.ensureTemplateExists(templateId);
    if (!templateExists) {
      logger.warn(`Template ${templateId} no encontrado, recargando templates...`);
      await this.templateManager.reloadTemplates();
      
      const existsAfterReload = await this.templateManager.ensureTemplateExists(templateId);
      if (!existsAfterReload) {
        throw new Error(`Template no encontrado: ${templateId}`);
      }
    }
    
    const template = this.templateManager.getTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template no encontrado después de carga: ${templateId}`);
    }

    logger.info(`Worker: Template encontrado: ${template.name} (Tipo: ${template.type})`, { 
      templateId, 
      jobId: job.id,
      templateType: template.type 
    });

    // Validar merge fields requeridos
    await job.updateProgress(10);
    await this.templateManager.validateMergeFields(template, mergeFields);

    // FLUJO REFACTORIZADO: Decidir procesador basado en tipo de template
    await job.updateProgress(15);
    
    if (template.type === 'after-effects') {
      logger.info(`🎬 Worker: Usando AfterEffectsProcessor para template ${templateId}`, { 
        templateId, 
        jobId: job.id,
        mergeFieldsCount: Object.keys(mergeFields).length 
      });
      return await this.processAfterEffectsTemplate(job, template, mergeFields, output, clientId);
    } else {
      logger.info(`🎥 Worker: Usando SimpleVideoRenderer para template ${templateId}`, { 
        templateId, 
        jobId: job.id 
      });
      return await this.processStandardTemplate(job, template, mergeFields, output, clientId);
    }
  }

  /**
   * Procesa templates de After Effects usando el procesador especializado
   */
  async processAfterEffectsTemplate(job, template, mergeFields, output, clientId) {
    try {
      logger.info(`🎬 Iniciando procesamiento After Effects`, {
        templateId: template.id,
        templateName: template.name,
        mergeFieldsCount: Object.keys(mergeFields).length,
        jobId: job.id
      });

      // Fase 1: Procesar con AfterEffectsProcessor (15-90%)
      await job.updateProgress(20);
      
      const outputPath = `output/${job.id}.mp4`;
      
      // El AfterEffectsProcessor maneja todo internamente con SimpleVideoRenderer
      const renderResult = await this.afterEffectsProcessor.processTemplate(
        template, 
        mergeFields, 
        outputPath,
        (progress) => {
          // Mapear progreso de 20% a 90%
          job.updateProgress(20 + (progress * 0.7));
        }
      );
      
      // Fase 2: Subida a Firebase Storage (90-100%)
      await job.updateProgress(90);
      const uploadResult = await this.assetProcessor.uploadToFirebase(
        renderResult.outputPath || renderResult, 
        `outputs/${clientId}/${job.id}.${output?.format || 'mp4'}`,
        { jobId: job.id, clientId, templateType: 'after-effects' }
      );

      await job.updateProgress(100);

      // Limpiar archivos temporales
      if (renderResult.outputPath) {
        await this.afterEffectsProcessor.cleanup(renderResult.outputPath);
      }

      logger.info(`✅ After Effects template procesado exitosamente`, {
        templateId: template.id,
        jobId: job.id,
        outputSize: uploadResult.size,
        processingTime: renderResult.processingTime
      });

      return {
        videoId: job.id,
        url: uploadResult.publicUrl,
        filename: uploadResult.destination,
        duration: template.duration || 10,
        size: uploadResult.size,
        format: output?.format || 'mp4',
        resolution: template.resolution || { width: 1920, height: 1080 },
        createdAt: new Date().toISOString(),
        processingInfo: {
          type: 'after-effects',
          processor: 'AfterEffectsProcessor',
          mergeFieldsApplied: Object.keys(mergeFields).length,
          templateId: template.id,
          processingTime: renderResult.processingTime,
          assetValidation: renderResult.assetValidation
        }
      };
      
    } catch (error) {
      logger.error(`❌ Error procesando template After Effects ${template.id}`, {
        templateId: template.id,
        jobId: job.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Procesa templates estándar usando SimpleVideoRenderer
   */
  async processStandardTemplate(job, template, mergeFields, output, clientId) {
    try {
      // Aplicar merge fields al timeline del template
      const processedTimeline = this.templateManager.applyMergeFields(template.timeline, mergeFields);

      // Crear datos para el procesamiento de video estándar
      const videoData = {
        timeline: processedTimeline,
        output: output || {},
        mergeFields: mergeFields,
        clientId
      };

      // Procesar como video normal usando el timeline procesado
      return await this.processVideoRender(job, videoData);
      
    } catch (error) {
      logger.error(`❌ Error procesando template estándar ${template.id}`, {
        templateId: template.id,
        jobId: job.id,
        error: error.message
      });
      throw error;
    }
  }

  async processTimelineValidation(job, jobData) {
    const { timeline } = jobData;

    await job.updateProgress(25);
    const validation = await this.videoRenderer.validateTimeline(timeline);
    
    await job.updateProgress(50);
    const assetValidation = await this.assetProcessor.validateAssets(timeline);
    
    await job.updateProgress(75);
    const estimatedDuration = this.calculateEstimatedDuration(timeline);
    
    await job.updateProgress(100);

    return {
      valid: validation.valid && assetValidation.valid,
      errors: [...(validation.errors || []), ...(assetValidation.errors || [])],
      warnings: [...(validation.warnings || []), ...(assetValidation.warnings || [])],
      info: {
        estimatedDuration,
        totalTracks: timeline.tracks?.length || 0,
        totalClips: this.countTotalClips(timeline),
        estimatedProcessingTime: this.estimateProcessingTime(timeline)
      }
    };
  }

  async processAssets(job, jobData) {
    const { assets } = jobData;

    const results = [];
    const total = assets.length;

    for (let i = 0; i < total; i++) {
      const asset = assets[i];
      
      try {
        const processed = await this.assetProcessor.processAsset(asset);
        results.push({ success: true, asset: processed });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          asset: asset.src || asset.url 
        });
      }

      await job.updateProgress(Math.round(((i + 1) / total) * 100));
    }

    return {
      total,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async processThumbnailGeneration(job, jobData) {
    const { videoUrl, timestamp = 1, width = 1920, height = 1080 } = jobData;

    await job.updateProgress(25);
    const thumbnailPath = await this.videoRenderer.generateThumbnail(
      videoUrl, 
      timestamp, 
      { width, height }
    );

    await job.updateProgress(75);
    const uploadResult = await this.assetProcessor.uploadToFirebase(
      thumbnailPath,
      `thumbnails/${job.id}.jpg`,
      { jobId: job.id, type: 'thumbnail' }
    );

    await job.updateProgress(100);

    // Limpiar archivo temporal
    await this.videoRenderer.cleanup(thumbnailPath);

    return {
      thumbnailId: job.id,
      url: uploadResult.publicUrl,
      width,
      height,
      timestamp,
      createdAt: new Date().toISOString()
    };
  }

  setupWorkerEvents() {
    this.worker.on('completed', (job, result) => {
      logger.info(`Worker: Trabajo completado - ${job.id}`, {
        jobId: job.id,
        duration: Date.now() - job.processedOn
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Worker: Trabajo falló - ${job.id}`, {
        jobId: job.id,
        error: err.message,
        stack: err.stack
      });
    });

    this.worker.on('active', (job) => {
      logger.info(`Worker: Trabajo iniciado - ${job.id}`, {
        jobId: job.id,
        type: job.data.type
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn(`Worker: Trabajo estancado - ${jobId}`);
    });

    this.worker.on('error', (err) => {
      logger.error('Worker: Error general', err);
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug(`Worker: Progreso ${job.id} - ${progress}%`);
    });
  }

  calculateEstimatedDuration(timeline) {
    let maxDuration = 0;
    
    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        const clipEnd = (clip.start || 0) + (clip.duration || clip.length || 0);
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });

    return Math.max(maxDuration, 1);
  }

  countTotalClips(timeline) {
    let total = 0;
    timeline.tracks?.forEach(track => {
      total += track.clips?.length || 0;
    });
    return total;
  }

  estimateProcessingTime(timeline) {
    const duration = this.calculateEstimatedDuration(timeline);
    const clips = this.countTotalClips(timeline);
    const complexity = timeline.tracks?.length || 1;
    
    // Estimación básica: 2-5 segundos por segundo de video + complejidad
    const baseTime = duration * 3;
    const complexityFactor = Math.log(clips + 1) * complexity;
    
    return Math.round(baseTime + complexityFactor);
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    logger.info(`Worker: Iniciando cierre graceful de ${WORKER_NAME}...`);

    try {
      if (this.worker) {
        await this.worker.close();
        logger.info('Worker: Cerrado correctamente');
      }
    } catch (error) {
      logger.error('Worker: Error durante cierre', error);
    }
  }

  setupTemplateSubscription() {
    this.subscriber.subscribe('template-changes');
    
    this.subscriber.on('message', async (channel, message) => {
      if (channel === 'template-changes') {
        try {
          const data = JSON.parse(message);
          logger.info(`Received template notification: ${data.action} - ${data.templateId}`);
          
          switch (data.action) {
            case 'created':
            case 'updated':
              await this.templateManager.ensureTemplateExists(data.templateId);
              break;
            case 'deleted':
              this.templateManager.templates.delete(data.templateId);
              break;
          }
        } catch (error) {
          logger.error('Error processing template notification:', error);
        }
      }
    });
    
    logger.info('Template subscription setup completed');
  }
}

// Inicializar y ejecutar worker
async function main() {
  const worker = new VideoWorker();

  try {
    await worker.initialize();
    
    // Manejo de señales para cierre graceful
    process.on('SIGTERM', async () => {
      logger.info('Worker: Recibida señal SIGTERM');
      await worker.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Worker: Recibida señal SIGINT');
      await worker.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Worker: Excepción no capturada', error);
      worker.shutdown().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Worker: Promesa rechazada no manejada', { reason, promise });
      worker.shutdown().then(() => process.exit(1));
    });

    logger.info(`Worker: ${WORKER_NAME} ejecutándose...`);

  } catch (error) {
    logger.error('Worker: Error fatal en inicialización', error);
    process.exit(1);
  }
}

// Ejecutar solo si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = VideoWorker; 