const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../utils/logger');
const { generateTempPath, generateOutputPath } = require('../utils/fileManager');

/**
 * VideoProcessor - Procesador simplificado para Template → Video
 * Se enfoca en la orquestación básica del procesamiento de video
 */
class VideoProcessor {
  constructor() {
    // Estado de trabajos
    this.jobs = new Map();
    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      lastProcessed: null
    };
  }

  /**
   * Procesar template JSON a video
   */
  async processTemplate(timeline, options = {}) {
    const processingId = `video-${uuidv4()}`;
    const correlationId = options.correlationId || logger.generateCorrelationId();
    const timer = logger.timeOperation('Template Processing', correlationId);
    
    try {
      logger.info('🎥 Iniciando procesamiento Template → Video', { 
        processingId, 
        correlationId 
      });
      
      // Actualizar estado del trabajo
      this.updateJobStatus(processingId, 'processing', 'Iniciando procesamiento');
      
      // 1. Validar timeline
      this.updateJobStatus(processingId, 'processing', 'Validando timeline');
      this.validateTimeline(timeline);
      
      // 2. Procesar merge fields si se proporcionan
      let processedTimeline = timeline;
      if (options.mergeFields && Object.keys(options.mergeFields).length > 0) {
        this.updateJobStatus(processingId, 'processing', 'Aplicando merge fields');
        processedTimeline = this.processMergeFields(timeline, options.mergeFields);
      }
      
      // 3. Generar configuración de salida
      const outputConfig = this.generateOutputConfig(options.output || {});
      
      // 4. Simular procesamiento de video (placeholder)
      this.updateJobStatus(processingId, 'processing', 'Renderizando video');
      const videoResult = await this.simulateVideoRendering(processedTimeline, outputConfig, processingId);
      
      // 5. Finalizar y actualizar estadísticas
      const processingTime = timer.end({ success: true });
      this.updateStats(processingTime.duration, true);
      
      const result = {
        id: processingId,
        status: 'completed',
        message: 'Video renderizado exitosamente',
        result: videoResult,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.updateJobStatus(processingId, 'completed', 'Procesamiento completado', videoResult);
      
      logger.info('✅ Procesamiento Template → Video completado', { 
        processingId, 
        correlationId,
        duration: processingTime.duration
      });
      
      return result;
      
    } catch (error) {
      const processingTime = timer.end({ success: false, error: error.message });
      this.updateStats(processingTime.duration, false);
      
      logger.error('❌ Error en procesamiento Template → Video', { 
        processingId,
        correlationId,
        error: error.message 
      });
      
      this.updateJobStatus(processingId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Validar estructura del timeline
   */
  validateTimeline(timeline) {
    if (!timeline) {
      throw new Error('Timeline es requerido');
    }
    
    if (!timeline.tracks || !Array.isArray(timeline.tracks)) {
      throw new Error('Timeline debe contener un array de tracks');
    }
    
    if (timeline.tracks.length === 0) {
      throw new Error('Timeline debe contener al menos un track');
    }
    
    // Validar cada track
    timeline.tracks.forEach((track, trackIndex) => {
      if (!track.clips || !Array.isArray(track.clips)) {
        throw new Error(`Track ${trackIndex} debe contener un array de clips`);
      }
      
      track.clips.forEach((clip, clipIndex) => {
        if (!clip.type) {
          throw new Error(`Track ${trackIndex}, clip ${clipIndex}: type es requerido`);
        }
        
        if (typeof clip.start !== 'number' || clip.start < 0) {
          throw new Error(`Track ${trackIndex}, clip ${clipIndex}: start debe ser un número >= 0`);
        }
        
        if (typeof clip.duration !== 'number' || clip.duration <= 0) {
          throw new Error(`Track ${trackIndex}, clip ${clipIndex}: duration debe ser un número > 0`);
        }
      });
    });
  }

  /**
   * Procesar merge fields en el timeline
   */
  processMergeFields(timeline, mergeFields) {
    try {
      // Convertir timeline a string, reemplazar placeholders, y convertir de vuelta
      let timelineStr = JSON.stringify(timeline);

      Object.entries(mergeFields).forEach(([key, value]) => {
        // Soportar múltiples formatos de placeholder
        const patterns = [
          `{{${key}}}`,     // {{KEY}} - double braces (templates)
          `{${key}}`,       // {KEY} - single braces (legacy)
          `\${${key}}`,     // ${KEY} - dollar syntax
          `[${key}]`,       // [KEY] - bracket syntax
          `%${key}%`        // %KEY% - percent syntax
        ];
        
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern.replace(/[{}$[\]%]/g, '\\$&'), 'g');
          const beforeReplace = timelineStr;
          timelineStr = timelineStr.replace(regex, String(value));
          if (beforeReplace !== timelineStr) {
            logger.info(`Reemplazado ${pattern} con ${value}`, { correlationId: logger.generateCorrelationId() });
          }
        });
      });

      return JSON.parse(timelineStr);

    } catch (error) {
      logger.error('Error procesando merge fields:', error);
      throw new Error('Error procesando campos de fusión');
    }
  }

  /**
   * Generar configuración de salida
   */
  generateOutputConfig(outputOptions) {
    return {
      format: outputOptions.format || 'mp4',
      resolution: outputOptions.resolution || { width: 1920, height: 1080 },
      fps: outputOptions.fps || 30,
      bitrate: outputOptions.bitrate || '5M',
      codec: outputOptions.codec || 'libx264',
      quality: outputOptions.quality || 'high'
    };
  }

  /**
   * Simular renderizado de video (placeholder para implementación real)
   */
  async simulateVideoRendering(timeline, outputConfig, processingId) {
    // Simular tiempo de procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calcular duración total del timeline
    const totalDuration = this.calculateTimelineDuration(timeline);
    
    // Generar nombre de archivo de salida
    const outputFilename = `video_${processingId}.${outputConfig.format}`;
    const outputPath = generateOutputPath(outputFilename);
    
    // Simular creación de archivo (en implementación real aquí iría FFmpeg)
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, `# Video simulado para ${processingId}\n# Timeline: ${JSON.stringify(timeline, null, 2)}`);
    
    // Obtener estadísticas del archivo
    const stats = await fs.stat(outputPath);
    
    return {
      url: `/output/${path.basename(outputPath)}`,
      filename: path.basename(outputPath),
      duration: totalDuration,
      size: stats.size,
      format: outputConfig.format,
      resolution: outputConfig.resolution,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Calcular duración total del timeline
   */
  calculateTimelineDuration(timeline) {
    let maxDuration = 0;
    
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });
    
    return maxDuration || 10; // Mínimo 10 segundos
  }

  /**
   * Actualizar estado del trabajo
   */
  updateJobStatus(jobId, status, message, result = null) {
    this.jobs.set(jobId, {
      id: jobId,
      status,
      message,
      result,
      updatedAt: new Date().toISOString()
    });
    
    logger.debug('Job status updated', {
      jobId,
      status,
      message
    });
  }

  /**
   * Obtener estado del trabajo
   */
  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Actualizar estadísticas
   */
  updateStats(processingTime, success) {
    this.stats.totalProcessed++;
    if (!success) {
      this.stats.totalErrors++;
    }
    
    // Calcular promedio de tiempo de procesamiento
    if (this.stats.averageProcessingTime === 0) {
      this.stats.averageProcessingTime = processingTime;
    } else {
      this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;
    }
    
    this.stats.lastProcessed = new Date().toISOString();
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    const successRate = this.stats.totalProcessed > 0 
      ? ((this.stats.totalProcessed - this.stats.totalErrors) / this.stats.totalProcessed) * 100 
      : 0;
      
    return {
      totalRendered: this.stats.totalProcessed,
      totalErrors: this.stats.totalErrors,
      averageRenderTime: this.stats.averageProcessingTime,
      successRate: successRate,
      lastRendered: this.stats.lastProcessed
    };
  }

  /**
   * Obtener número de trabajos activos
   */
  getActiveJobsCount() {
    let activeCount = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'processing' || job.status === 'queued') {
        activeCount++;
      }
    }
    return activeCount;
  }

  /**
   * Limpiar trabajos completados antiguos
   */
  cleanupOldJobs(maxAge = 24 * 60 * 60 * 1000) { // 24 horas por defecto
    const now = Date.now();
    const jobsToDelete = [];
    
    for (const [jobId, job] of this.jobs.entries()) {
      const jobAge = now - new Date(job.updatedAt).getTime();
      if (jobAge > maxAge && (job.status === 'completed' || job.status === 'failed')) {
        jobsToDelete.push(jobId);
      }
    }
    
    jobsToDelete.forEach(jobId => {
      this.jobs.delete(jobId);
    });
    
    logger.debug(`Limpiados ${jobsToDelete.length} trabajos antiguos`);
  }
}

module.exports = VideoProcessor; 
