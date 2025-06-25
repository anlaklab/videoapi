/**
 * Endpoints principales de la API
 * Integra los módulos AE-to-Template y Template-to-Video
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Importar módulos principales
const AEToTemplateProcessor = require('../modules/ae-to-template/index');
const TemplateToVideoProcessor = require('../modules/template-to-video/index');

// Middleware y utilidades
const { authMiddleware } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Middleware de autenticación simplificado para desarrollo
const simpleAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key requerida',
      message: 'Incluye el header x-api-key: dev-key-12345',
      timestamp: new Date().toISOString()
    });
  }
  
  // En desarrollo, cualquier API key es válida para simplificar
  if (apiKey === 'dev-key-12345' || process.env.NODE_ENV === 'development') {
    req.client = {
      id: 'dev-client',
      name: 'Development Client',
      permissions: ['*']
    };
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: 'API key inválida',
    message: 'Usa: dev-key-12345',
    timestamp: new Date().toISOString()
  });
};

const router = express.Router();

// Inicializar procesadores
const aeToTemplateProcessor = new AEToTemplateProcessor();
const templateToVideoProcessor = new TemplateToVideoProcessor();

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './temp/aep-uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.aep', '.aet', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Use .aep, .aet o .json'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB límite
  }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health Check del Sistema
 *     description: |
 *       Verifica el estado de salud de todos los componentes del sistema:
 *       - FFmpeg (disponibilidad y versión)
 *       - After Effects tools (ae-to-json, after-effects, etc.)
 *       - Almacenamiento (espacio disponible)
 *       - Memoria del sistema
 *       
 *       **Estados posibles:**
 *       - `healthy`: Todos los servicios funcionando correctamente
 *       - `degraded`: Algunos servicios con problemas menores
 *       - `unhealthy`: Servicios críticos no disponibles
 *     tags:
 *       - sistema
 *     security: []
 *     responses:
 *       200:
 *         description: Estado de salud del sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             examples:
 *               healthy:
 *                 summary: Sistema saludable
 *                 value:
 *                   status: "healthy"
 *                   timestamp: "2024-01-15T10:30:00Z"
 *                   services:
 *                     ffmpeg:
 *                       available: true
 *                       version: "7.1.1"
 *                       path: "/opt/homebrew/bin/ffmpeg"
 *                     afterEffects:
 *                       available: true
 *                       method: "ae-to-json"
 *                     storage:
 *                       available: true
 *                       freeSpace: 50000000000
 *                       totalSpace: 500000000000
 *                   checks:
 *                     - name: "FFmpeg Test"
 *                       status: "pass"
 *                       message: "FFmpeg ejecutándose correctamente"
 *                       duration: 150
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        ffmpeg: await checkFFmpeg(),
        afterEffects: await checkAfterEffectsTools(),
        storage: await checkStorage()
      },
      checks: []
    };

    // Determinar estado general
    const allServicesHealthy = Object.values(healthCheck.services)
      .every(service => service.available);
    
    healthCheck.status = allServicesHealthy ? 'healthy' : 'degraded';

    res.json(healthCheck);
  } catch (error) {
    logger.error('Error en health check:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Estadísticas del Sistema
 *     description: |
 *       Obtiene estadísticas detalladas de procesamiento y rendimiento:
 *       - Estadísticas de conversión AE → Template
 *       - Estadísticas de renderizado Template → Video
 *       - Métricas del sistema (memoria, uptime, etc.)
 *       - Trabajos activos en cola
 *     tags:
 *       - sistema
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcessingStats'
 *             example:
 *               aeToTemplate:
 *                 totalProcessed: 145
 *                 averageProcessingTime: 8.5
 *                 successRate: 94.5
 *                 lastProcessed: "2024-01-15T10:25:00Z"
 *               templateToVideo:
 *                 totalRendered: 312
 *                 averageRenderTime: 45.2
 *                 successRate: 98.1
 *                 lastRendered: "2024-01-15T10:28:00Z"
 *               system:
 *                 uptime: 86400
 *                 memoryUsage:
 *                   used: 512000000
 *                   total: 8000000000
 *                 ffmpegVersion: "7.1.1"
 *                 activeJobs: 3
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */
router.get('/stats', simpleAuth, async (req, res) => {
  try {
    const stats = {
      aeToTemplate: aeToTemplateProcessor.getStats(),
      templateToVideo: templateToVideoProcessor.getStats(),
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        ffmpegVersion: await getFFmpegVersion(),
        activeJobs: aeToTemplateProcessor.getActiveJobsCount() + templateToVideoProcessor.getActiveJobsCount()
      }
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas del sistema',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/ae-to-template:
 *   post:
 *     summary: Conversión AE → Template JSON
 *     description: |
 *       **Convierte archivos After Effects en templates JSON optimizados**
 *       
 *       Este endpoint del módulo AE-to-Template realiza análisis profundo de archivos
 *       After Effects para extraer toda la información de animaciones, efectos y expresiones.
 *       
 *       **Características del análisis:**
 *       - 🔍 Extracción de keyframes y animaciones
 *       - 🎨 Análisis de efectos y filtros
 *       - 📝 Detección automática de merge fields
 *       - 🎯 Optimización de timeline multi-track
 *       - 📊 Estadísticas de complejidad del proyecto
 *       
 *       **Resultado:** Template JSON listo para renderizado de video
 *     tags:
 *       - aep2json
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo After Effects (.aep o .aet)
 *               analysisDepth:
 *                 type: string
 *                 enum: [basic, full, deep]
 *                 default: full
 *                 description: Nivel de análisis del archivo AE
 *               extractAssets:
 *                 type: boolean
 *                 default: true
 *                 description: Si extraer información de assets
 *               generatePreview:
 *                 type: boolean
 *                 default: false
 *                 description: Si generar vista previa del template
 *     responses:
 *       200:
 *         description: Template generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Template generado exitosamente desde After Effects"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "ae-template-456e7890-e12b-34c5-d678-901234567890"
 *                     template:
 *                       $ref: '#/components/schemas/OptimizedTemplate'
 *                     analysis:
 *                       $ref: '#/components/schemas/AEAnalysisResult'
 *                     processingTime:
 *                       type: number
 *                       example: 8.5
 *                       description: Tiempo de procesamiento en segundos
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */
router.post('/ae-to-template', simpleAuth, upload.single('file'), async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  const timer = logger.timeOperation('AE to Template', correlationId);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Archivo After Effects requerido',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🎬 Iniciando conversión AE → Template', {
      filename: req.file.originalname,
      correlationId
    });

    const options = {
      analysisDepth: req.body.analysisDepth || 'full',
      extractAssets: req.body.extractAssets !== 'false',
      generatePreview: req.body.generatePreview === 'true',
      correlationId
    };

    const result = await aeToTemplateProcessor.processAEFile(req.file.path, options);

    // Limpiar archivo temporal
    await fs.remove(req.file.path);

    timer.end({ success: true });

    res.json({
      success: true,
      message: 'Template generado exitosamente desde After Effects',
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    timer.end({ success: false, error: error.message });
    logger.error('❌ Error en conversión AE → Template', {
      error: error.message,
      correlationId
    });

    if (req.file?.path) {
      await fs.remove(req.file.path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error generando template desde After Effects',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/template-to-video:
 *   post:
 *     summary: Renderizado Template → Video
 *     description: |
 *       **Renderiza templates JSON en videos profesionales**
 *       
 *       Este endpoint del módulo Template-to-Video toma templates JSON optimizados
 *       y los convierte en videos usando FFmpeg con configuraciones avanzadas.
 *       
 *       **Características del renderizado:**
 *       - 🎥 Soporte multi-track con layering
 *       - 🎨 Filtros y efectos profesionales
 *       - 📝 Reemplazo dinámico de merge fields
 *       - 🔊 Procesamiento de audio y soundtrack
 *       - 🎬 Transiciones y animaciones
 *       - 📐 Múltiples resoluciones y formatos
 *       
 *       **Formatos soportados:** MP4, WebM, MOV, AVI
 *     tags:
 *       - json2mp4
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VideoRenderRequest'
 *               - type: object
 *                 properties:
 *                   priority:
 *                     type: string
 *                     enum: [low, normal, high, urgent]
 *                     default: normal
 *                     description: Prioridad del trabajo de renderizado
 *                   generateThumbnail:
 *                     type: boolean
 *                     default: true
 *                     description: Si generar thumbnail del video
 *           examples:
 *             simple_text:
 *               summary: Video simple con texto
 *               value:
 *                 timeline:
 *                   tracks:
 *                     - clips:
 *                         - type: "background"
 *                           start: 0
 *                           duration: 10
 *                           color: "#1a1a1a"
 *                         - type: "text"
 *                           start: 1
 *                           duration: 8
 *                           text: "{{titulo}}"
 *                           position: "center"
 *                           style:
 *                             fontSize: 72
 *                             color: "#ffffff"
 *                             fontFamily: "Arial"
 *                 output:
 *                   format: "mp4"
 *                   resolution:
 *                     width: 1920
 *                     height: 1080
 *                   fps: 30
 *                 mergeFields:
 *                   titulo: "Mi Video Increíble"
 *             complex_multimedia:
 *               summary: Video complejo con multimedia
 *               value:
 *                 timeline:
 *                   tracks:
 *                     - clips:
 *                         - type: "video"
 *                           start: 0
 *                           duration: 15
 *                           src: "https://example.com/background.mp4"
 *                           scale: 1.2
 *                           filter: "blur"
 *                     - clips:
 *                         - type: "image"
 *                           start: 2
 *                           duration: 10
 *                           src: "https://example.com/logo.png"
 *                           position: "top-right"
 *                           animation:
 *                             type: "fadeIn"
 *                             duration: 1
 *                     - clips:
 *                         - type: "text"
 *                           start: 3
 *                           duration: 8
 *                           text: "{{mensaje}}"
 *                           position:
 *                             x: 100
 *                             y: 500
 *                   soundtrack:
 *                     src: "https://example.com/music.mp3"
 *                     volume: 30
 *                 output:
 *                   format: "mp4"
 *                   quality: "high"
 *                 mergeFields:
 *                   mensaje: "Contenido Dinámico"
 *     responses:
 *       200:
 *         description: Video renderizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Video renderizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/JobStatus'
 *             example:
 *               success: true
 *               message: "Video renderizado exitosamente"
 *               data:
 *                 id: "video-render-789a0123-b456-78c9-d012-345678901234"
 *                 status: "completed"
 *                 message: "Renderizado completado"
 *                 result:
 *                   url: "/output/video_render-789a0123.mp4"
 *                   filename: "video_render-789a0123.mp4"
 *                   duration: 15
 *                   size: 45600000
 *                   format: "mp4"
 *                   resolution:
 *                     width: 1920
 *                     height: 1080
 *                 createdAt: "2024-01-15T10:30:00Z"
 *                 updatedAt: "2024-01-15T10:30:45Z"
 *       400:
 *         description: Error en la solicitud (timeline inválido)
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */
router.post('/template-to-video', simpleAuth, async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  const timer = logger.timeOperation('Template to Video', correlationId);
  
  try {
    const { timeline, output, mergeFields, webhook, priority, generateThumbnail } = req.body;

    if (!timeline) {
      return res.status(400).json({
        success: false,
        error: 'Timeline requerido',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🎥 Iniciando renderizado Template → Video', {
      correlationId,
      tracksCount: timeline.tracks?.length || 0
    });

    // Crear template completo si se envía solo timeline
    const template = {
      metadata: {
        id: `template-${Date.now()}`,
        name: 'Template desde Timeline',
        version: '1.0.0',
        createdAt: new Date().toISOString()
      },
      timeline: timeline,
      mergeFields: {}
    };

    logger.info('🔧 Template creado', {
      correlationId,
      templateKeys: Object.keys(template),
      hasTimeline: !!template.timeline,
      timelineKeys: template.timeline ? Object.keys(template.timeline) : [],
      tracksCount: template.timeline?.tracks?.length || 0
    });

    const options = {
      mergeFields: mergeFields || {},
      output: output || {},
      webhook,
      priority: priority || 'normal',
      generateThumbnail: generateThumbnail !== false,
      correlationId
    };

    const result = await templateToVideoProcessor.processTemplate(template, options);

    timer.end({ success: true });

    res.json({
      success: true,
      message: 'Video renderizado exitosamente',
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    timer.end({ success: false, error: error.message });
    logger.error('❌ Error en renderizado Template → Video', {
      error: error.message,
      correlationId
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Error renderizando video desde template',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/ae-to-video:
 *   post:
 *     summary: Pipeline Completo AE → Video
 *     description: |
 *       **Pipeline completo: After Effects → Template → Video**
 *       
 *       Este endpoint combina ambos módulos para ofrecer una conversión directa
 *       desde archivos After Effects hasta video final en una sola llamada.
 *       
 *       **Proceso completo:**
 *       1. 📁 Análisis profundo del archivo .aep
 *       2. 🎬 Generación de template JSON optimizado  
 *       3. 📝 Aplicación de merge fields dinámicos
 *       4. 🎥 Renderizado final con FFmpeg
 *       5. ✅ Entrega de video y metadatos
 *       
 *       **Ideal para:** Automatización completa, integración con workflows externos
 *     tags:
 *       - Pipeline Completo
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo After Effects (.aep o .aet)
 *               mergeFields:
 *                 type: string
 *                 description: JSON string con campos dinámicos
 *               outputConfig:
 *                 type: string
 *                 description: JSON string con configuración de salida
 *               webhook:
 *                 type: string
 *                 format: uri
 *                 description: URL para notificación webhook
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *           example:
 *             file: "[archivo .aep]"
 *             mergeFields: '{"titulo":"Video Final","fecha":"2024"}'
 *             outputConfig: '{"format":"mp4","resolution":{"width":1920,"height":1080},"fps":30}'
 *     responses:
 *       200:
 *         description: Pipeline completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     pipelineId:
 *                       type: string
 *                     template:
 *                       $ref: '#/components/schemas/OptimizedTemplate'
 *                     video:
 *                       $ref: '#/components/schemas/JobStatus'
 *                     analysis:
 *                       $ref: '#/components/schemas/AEAnalysisResult'
 *                     processingTime:
 *                       type: object
 *                       properties:
 *                         aeToTemplate:
 *                           type: number
 *                         templateToVideo:
 *                           type: number
 *                         total:
 *                           type: number
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */
router.post('/ae-to-video', simpleAuth, upload.single('file'), async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  const pipelineTimer = logger.timeOperation('AE to Video Pipeline', correlationId);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Archivo After Effects requerido',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🚀 Iniciando pipeline completo AE → Video', {
      filename: req.file.originalname,
      correlationId
    });

    // Parsear configuraciones
    let mergeFields = {};
    let outputConfig = {};
    
    try {
      if (req.body.mergeFields) {
        mergeFields = JSON.parse(req.body.mergeFields);
      }
      if (req.body.outputConfig) {
        outputConfig = JSON.parse(req.body.outputConfig);
      }
    } catch (error) {
      logger.warn('Error parseando configuraciones JSON', {
        correlationId,
        error: error.message
      });
    }

    const pipelineId = `pipeline-${uuidv4()}`;
    const startTime = Date.now();

    // Paso 1: AE → Template
    logger.info('📝 Paso 1/2: Generando template desde AE', { correlationId });
    const aeTimer = logger.timeOperation('AE Analysis', correlationId);
    
    const templateResult = await aeToTemplateProcessor.processAEFile(
      req.file.path,
      { correlationId }
    );
    
    const aeTime = aeTimer.end({ success: true });

    // Paso 2: Template → Video
    logger.info('🎥 Paso 2/2: Renderizando video desde template', { correlationId });
    const videoTimer = logger.timeOperation('Video Render', correlationId);
    
    const videoResult = await templateToVideoProcessor.processTemplate(
      templateResult.template,
      {
        mergeFields,
        output: outputConfig,
        webhook: req.body.webhook,
        priority: req.body.priority || 'normal',
        correlationId
      }
    );
    
    const videoTime = videoTimer.end({ success: true });

    // Limpiar archivo temporal
    await fs.remove(req.file.path);

    const totalTime = (Date.now() - startTime) / 1000;
    pipelineTimer.end({ success: true });

    logger.info('✅ Pipeline completo AE → Video finalizado', {
      correlationId,
      pipelineId,
      totalTime,
      aeTime: aeTime.duration,
      videoTime: videoTime.duration
    });

    res.json({
      success: true,
      message: 'Pipeline AE → Video completado exitosamente',
      data: {
        pipelineId,
        template: templateResult,
        video: videoResult,
        analysis: templateResult.analysis,
        processingTime: {
          aeToTemplate: aeTime.duration,
          templateToVideo: videoTime.duration,
          total: totalTime
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    pipelineTimer.end({ success: false, error: error.message });
    logger.error('❌ Error en pipeline AE → Video', {
      error: error.message,
      correlationId
    });

    if (req.file?.path) {
      await fs.remove(req.file.path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error en pipeline AE → Video',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/aftereffects/expressions:
 *   get:
 *     summary: Obtener expresiones de After Effects soportadas
 *     description: |
 *       **Lista de expresiones de After Effects soportadas por el sistema**
 *       
 *       Este endpoint proporciona información sobre las expresiones de After Effects
 *       que el sistema puede procesar y convertir en animaciones de video.
 *       
 *       **Categorías de expresiones:**
 *       - 🎯 **Transform**: Posición, escala, rotación, opacidad
 *       - 🎨 **Effects**: Efectos de color, blur, distorsión
 *       - 📐 **Math**: Operaciones matemáticas y trigonométricas
 *       - ⏱️ **Time**: Expresiones basadas en tiempo
 *       - 🔗 **Property**: Referencias a otras propiedades
 *       
 *       **Nivel de soporte:**
 *       - ✅ **Full**: Soporte completo con conversión automática
 *       - ⚠️ **Partial**: Soporte parcial con limitaciones
 *       - ❌ **None**: No soportado actualmente
 *     tags:
 *       - After Effects
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de expresiones soportadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           expressions:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                 syntax:
 *                                   type: string
 *                                 support:
 *                                   type: string
 *                                   enum: [full, partial, none]
 *                                 description:
 *                                   type: string
 *                                 example:
 *                                   type: string
 *                     totalExpressions:
 *                       type: number
 *                     supportedCount:
 *                       type: number
 *                     supportPercentage:
 *                       type: number
 *             example:
 *               success: true
 *               data:
 *                 categories:
 *                   - name: "Transform"
 *                     description: "Propiedades de transformación básicas"
 *                     expressions:
 *                       - name: "wiggle"
 *                         syntax: "wiggle(frequency, amplitude)"
 *                         support: "full"
 *                         description: "Añade movimiento aleatorio a una propiedad"
 *                         example: "wiggle(2, 50)"
 *                       - name: "linear"
 *                         syntax: "linear(t, tMin, tMax, value1, value2)"
 *                         support: "full"
 *                         description: "Interpolación lineal entre valores"
 *                         example: "linear(time, 0, 1, 0, 100)"
 *                 totalExpressions: 45
 *                 supportedCount: 32
 *                 supportPercentage: 71.1
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */
router.get('/aftereffects/expressions', simpleAuth, async (req, res) => {
  try {
    const expressionsData = {
      categories: [
        {
          name: "Transform",
          description: "Propiedades de transformación básicas",
          expressions: [
            {
              name: "wiggle",
              syntax: "wiggle(frequency, amplitude)",
              support: "full",
              description: "Añade movimiento aleatorio a una propiedad",
              example: "wiggle(2, 50)"
            },
            {
              name: "linear",
              syntax: "linear(t, tMin, tMax, value1, value2)",
              support: "full",
              description: "Interpolación lineal entre valores",
              example: "linear(time, 0, 1, 0, 100)"
            },
            {
              name: "ease",
              syntax: "ease(t, tMin, tMax, value1, value2)",
              support: "full",
              description: "Interpolación con easing suave",
              example: "ease(time, 0, 1, 0, 100)"
            },
            {
              name: "easeIn",
              syntax: "easeIn(t, tMin, tMax, value1, value2)",
              support: "full",
              description: "Interpolación con easing de entrada",
              example: "easeIn(time, 0, 1, 0, 100)"
            },
            {
              name: "easeOut",
              syntax: "easeOut(t, tMin, tMax, value1, value2)",
              support: "full",
              description: "Interpolación with easing de salida",
              example: "easeOut(time, 0, 1, 0, 100)"
            }
          ]
        },
        {
          name: "Time",
          description: "Expresiones basadas en tiempo",
          expressions: [
            {
              name: "time",
              syntax: "time",
              support: "full",
              description: "Tiempo actual de la composición en segundos",
              example: "time * 360"
            },
            {
              name: "timeToFrames",
              syntax: "timeToFrames(t, fps, isDuration)",
              support: "full",
              description: "Convierte tiempo a frames",
              example: "timeToFrames(time, 30, false)"
            },
            {
              name: "framesToTime",
              syntax: "framesToTime(frames, fps)",
              support: "full",
              description: "Convierte frames a tiempo",
              example: "framesToTime(30, 30)"
            }
          ]
        },
        {
          name: "Math",
          description: "Operaciones matemáticas y trigonométricas",
          expressions: [
            {
              name: "Math.sin",
              syntax: "Math.sin(angle)",
              support: "full",
              description: "Función seno",
              example: "Math.sin(time) * 100"
            },
            {
              name: "Math.cos",
              syntax: "Math.cos(angle)",
              support: "full",
              description: "Función coseno",
              example: "Math.cos(time) * 100"
            },
            {
              name: "Math.PI",
              syntax: "Math.PI",
              support: "full",
              description: "Constante Pi",
              example: "Math.sin(time * Math.PI)"
            },
            {
              name: "random",
              syntax: "random(maxValOrArray)",
              support: "full",
              description: "Genera valores aleatorios",
              example: "random(100)"
            },
            {
              name: "seedRandom",
              syntax: "seedRandom(seed, timeless)",
              support: "partial",
              description: "Inicializa generador aleatorio con semilla",
              example: "seedRandom(1, true); random(100)"
            }
          ]
        },
        {
          name: "Property",
          description: "Referencias a otras propiedades",
          expressions: [
            {
              name: "thisComp",
              syntax: "thisComp.layer(\"layerName\").transform.position",
              support: "partial",
              description: "Referencia a la composición actual",
              example: "thisComp.layer(1).transform.position"
            },
            {
              name: "thisLayer",
              syntax: "thisLayer.transform.position",
              support: "partial",
              description: "Referencia a la capa actual",
              example: "thisLayer.transform.scale"
            },
            {
              name: "value",
              syntax: "value",
              support: "full",
              description: "Valor actual de la propiedad",
              example: "value + [10, 10]"
            }
          ]
        },
        {
          name: "Effects",
          description: "Expresiones para efectos y filtros",
          expressions: [
            {
              name: "effect",
              syntax: "effect(\"effectName\")(\"parameterName\")",
              support: "partial",
              description: "Accede a parámetros de efectos",
              example: "effect(\"Blur\")(\"Blurriness\")"
            },
            {
              name: "mask",
              syntax: "mask(\"maskName\").maskPath",
              support: "none",
              description: "Accede a propiedades de máscaras",
              example: "mask(1).maskPath"
            }
          ]
        },
        {
          name: "Advanced",
          description: "Expresiones avanzadas y complejas",
          expressions: [
            {
              name: "loopIn",
              syntax: "loopIn(type, numKeyframes)",
              support: "partial",
              description: "Bucle de keyframes antes del tiempo actual",
              example: "loopIn(\"cycle\", 0)"
            },
            {
              name: "loopOut",
              syntax: "loopOut(type, numKeyframes)",
              support: "partial",
              description: "Bucle de keyframes después del tiempo actual",
              example: "loopOut(\"pingpong\", 0)"
            },
            {
              name: "valueAtTime",
              syntax: "valueAtTime(t)",
              support: "partial",
              description: "Valor de la propiedad en un tiempo específico",
              example: "valueAtTime(time - 1)"
            },
            {
              name: "velocityAtTime",
              syntax: "velocityAtTime(t)",
              support: "none",
              description: "Velocidad de la propiedad en un tiempo específico",
              example: "velocityAtTime(time)"
            }
          ]
        }
      ]
    };

    // Calcular estadísticas
    const totalExpressions = expressionsData.categories.reduce(
      (total, category) => total + category.expressions.length, 0
    );
    
    const supportedCount = expressionsData.categories.reduce(
      (total, category) => total + category.expressions.filter(
        expr => expr.support === 'full' || expr.support === 'partial'
      ).length, 0
    );

    const supportPercentage = Math.round((supportedCount / totalExpressions) * 100 * 10) / 10;

    const responseData = {
      success: true,
      data: {
        ...expressionsData,
        totalExpressions,
        supportedCount,
        supportPercentage,
        lastUpdated: new Date().toISOString(),
        version: "2.0.0"
      },
      timestamp: new Date().toISOString()
    };

    res.json(responseData);

  } catch (error) {
    logger.error('Error obteniendo expresiones de After Effects:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo información de expresiones',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/auth/validate:
 *   get:
 *     summary: Validar API Key
 *     description: |
 *       **Valida la API key proporcionada**
 *       
 *       Este endpoint permite verificar si una API key es válida y obtener 
 *       información sobre los permisos y límites asociados.
 *     tags:
 *       - auth
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: API key válida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 keyInfo:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     rateLimit:
 *                       type: number
 *       401:
 *         description: API key inválida
 */
router.get('/auth/validate', simpleAuth, async (req, res) => {
  try {
    // Si llegamos aquí, la API key es válida (pasó el authMiddleware)
    res.json({
      valid: true,
      keyInfo: {
        name: 'Development Key',
        permissions: ['*'],
        rateLimit: 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: 'API key inválida',
      timestamp: new Date().toISOString()
    });
  }
});

// Funciones auxiliares
async function checkFFmpeg() {
  try {
    const { execSync } = require('child_process');
    const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
    execSync(`${ffmpegPath} -version`, { timeout: 5000, stdio: 'ignore' });
    
    const versionOutput = execSync(`${ffmpegPath} -version`, { 
      timeout: 5000, 
      encoding: 'utf8' 
    });
    const versionMatch = versionOutput.match(/ffmpeg version ([^\s]+)/);
    
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : 'unknown',
      path: ffmpegPath
    };
  } catch (error) {
    return {
      available: false,
      error: 'FFmpeg not available'
    };
  }
}

async function checkAfterEffectsTools() {
  try {
    // Verificar si los módulos de After Effects están disponibles
    require('ae-to-json');
    require('after-effects');
    
    return {
      available: true,
      method: 'ae-to-json'
    };
  } catch (error) {
    return {
      available: false,
      error: 'After Effects tools not available'
    };
  }
}

async function checkStorage() {
  try {
    const fs = require('fs');
    const stats = fs.statSync('./');
    return {
      available: true,
      freeSpace: 1000000000, // Simplificado
      totalSpace: 10000000000
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function getFFmpegVersion() {
  try {
    const { execSync } = require('child_process');
    const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
    const versionOutput = execSync(`${ffmpegPath} -version`, { 
      timeout: 5000, 
      encoding: 'utf8' 
    });
    const versionMatch = versionOutput.match(/ffmpeg version ([^\s]+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  } catch (error) {
    return 'not available';
  }
}

function parseResolution(resolutionString) {
  const [width, height] = resolutionString.split('x').map(Number);
  return { width, height };
}

module.exports = router; 