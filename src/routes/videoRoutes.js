const express = require('express');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('../middleware/asyncHandler');
const { validateVideoRequest, validateTimeline } = require('../validation/schemas');
const { 
  addVideoRenderJob, 
  getJobStatus, 
  cancelJob,
  getQueueStats,
  JOB_PRIORITIES 
} = require('../queues/videoQueue');
const TransitionProcessor = require('../services/transitionProcessor');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Video
 *   description: Endpoints para renderizado de videos
 */

/**
 * @swagger
 * /api/video/render:
 *   post:
 *     summary: Renderizar video desde JSON timeline
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VideoRenderRequest'
 *           example:
 *             timeline:
 *               tracks:
 *                 - clips:
 *                     - type: "text"
 *                       start: 0
 *                       duration: 5
 *                       text: "¡Hola Mundo!"
 *                       position: { x: 100, y: 100 }
 *                       style:
 *                         fontSize: 48
 *                         color: "#ffffff"
 *               background:
 *                 color: "#0066cc"
 *             output:
 *               format: "mp4"
 *               resolution: { width: 1920, height: 1080 }
 *               fps: 30
 *     responses:
 *       202:
 *         description: Video encolado para procesamiento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 videoId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 statusUrl:
 *                   type: string
 *                 downloadUrl:
 *                   type: string
 *       400:
 *         description: Error de validación
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */

// POST /api/video/render - Crear nuevo video
router.post('/render', asyncHandler(async (req, res) => {
  // Debug logging
  logger.debug('Video render request body:', JSON.stringify(req.body, null, 2));
  
  // Validar request body según especificación
  const { error, value } = validateVideoRequest.validate(req.body);
  
  if (error) {
    logger.error('Validation failed:', {
      error: error.details,
      requestBody: req.body
    });
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  const { timeline, output, merge: mergeFields, callback, priority } = value;
  const jobId = uuidv4();

  // Convertir prioridad de string a número
  const priorityMap = {
    'low': JOB_PRIORITIES.LOW,
    'normal': JOB_PRIORITIES.NORMAL,
    'high': JOB_PRIORITIES.HIGH,
    'urgent': JOB_PRIORITIES.URGENT
  };
  const numericPriority = priorityMap[priority] || JOB_PRIORITIES.NORMAL;

  try {
    // Agregar trabajo a la cola
    const jobResult = await addVideoRenderJob({
      timeline,
      output,
      mergeFields
    }, {
      jobId,
      clientId: req.client.id,
      apiKey: req.client.apiKey,
      callback,
      priority: numericPriority,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    logger.info(`Video render job created: ${jobId}`, {
      clientId: req.client.id,
      estimatedDuration: jobResult.estimatedDuration
    });

    // Respuesta inmediata según especificación
    res.status(202).json({
      success: true,
      videoId: jobId,
      status: 'enqueued',
      message: 'Video encolado para renderizado',
      eta: jobResult.estimatedDuration ? Math.round(jobResult.estimatedDuration * 3) : null,
      queuePosition: jobResult.queuePosition,
      statusUrl: `/api/video/${jobId}/status`,
      downloadUrl: `/api/video/${jobId}`,
      estimatedDuration: jobResult.estimatedDuration
    });

  } catch (error) {
    logger.error('Error creating video render job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error encolando trabajo de renderizado'
    });
  }
}));

/**
 * @swagger
 * /api/video/validate:
 *   post:
 *     summary: Validar timeline JSON
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Timeline'
 *     responses:
 *       200:
 *         description: Resultado de validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: object
 *                 info:
 *                   type: object
 */

// POST /api/video/validate - Validar JSON de edición
router.post('/validate', asyncHandler(async (req, res) => {
  const { error, value } = validateTimeline.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      valid: false,
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  try {
    // Validaciones adicionales personalizadas
    const validationResults = await performAdvancedValidation(value);
    
    res.json({
      valid: validationResults.valid,
      errors: validationResults.errors || [],
      warnings: validationResults.warnings || [],
      info: validationResults.info || {}
    });

  } catch (error) {
    logger.error('Error in timeline validation:', error);
    res.status(500).json({
      valid: false,
      errors: [{ 
        field: 'general', 
        message: 'Error interno en validación' 
      }]
    });
  }
}));

/**
 * @swagger
 * /api/video/{id}/status:
 *   get:
 *     summary: Consultar estado de renderizado
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del video
 *     responses:
 *       200:
 *         description: Estado del video
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatus'
 *       404:
 *         description: Video no encontrado
 *       500:
 *         description: Error interno del servidor
 */

// GET /api/video/{id}/status - Consultar estado de tarea
router.get('/:id/status', asyncHandler(async (req, res) => {
  const { id: videoId } = req.params;
  
  try {
    const jobStatus = await getJobStatus(videoId);
    
    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
        message: `No se encontró video con ID: ${videoId}`
      });
    }

    // Formatear respuesta según especificación
    const response = {
      videoId: jobStatus.jobId,
      status: jobStatus.status,
      progress: jobStatus.progress || 0,
      message: getStatusMessage(jobStatus.status, jobStatus.progress),
      createdAt: jobStatus.createdAt,
      updatedAt: jobStatus.processedOn || jobStatus.createdAt
    };

    // Agregar campos específicos según estado
    if (jobStatus.status === 'processing' && jobStatus.eta) {
      response.eta = jobStatus.eta;
    }

    if (jobStatus.status === 'enqueued' && jobStatus.queuePosition) {
      response.queuePosition = jobStatus.queuePosition;
    }

    if (jobStatus.status === 'completed' && jobStatus.returnvalue) {
      response.resultUrl = jobStatus.returnvalue.url;
      response.duration = jobStatus.returnvalue.duration;
      response.size = jobStatus.returnvalue.size;
      response.format = jobStatus.returnvalue.format;
      response.resolution = jobStatus.returnvalue.resolution;
    }

    if (jobStatus.status === 'failed') {
      response.error = {
        message: jobStatus.failedReason || 'Error desconocido',
        code: 'PROCESSING_ERROR',
        attempts: jobStatus.attemptsMade
      };
    }

    res.json(response);

  } catch (error) {
    logger.error(`Error getting job status for ${videoId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error consultando estado del video'
    });
  }
}));

/**
 * @swagger
 * /api/video/{id}:
 *   get:
 *     summary: Descargar video renderizado
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del video
 *     responses:
 *       302:
 *         description: Redirige a la URL del video
 *       400:
 *         description: Video no está listo
 *       404:
 *         description: Video no encontrado
 *       500:
 *         description: Error interno del servidor
 */

// GET /api/video/{id} - Obtener video renderizado
router.get('/:id', asyncHandler(async (req, res) => {
  const { id: videoId } = req.params;
  
  try {
    const jobStatus = await getJobStatus(videoId);
    
    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Video not found',
        message: `No se encontró video con ID: ${videoId}`
      });
    }

    if (jobStatus.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Video not ready',
        message: `Video aún no está listo. Estado actual: ${jobStatus.status}`,
        status: jobStatus.status,
        progress: jobStatus.progress
      });
    }

    // Redirigir a Firebase Storage URL
    if (jobStatus.returnvalue && jobStatus.returnvalue.url) {
      res.redirect(302, jobStatus.returnvalue.url);
    } else {
      res.status(500).json({
        success: false,
        error: 'Video file not available',
        message: 'El archivo de video no está disponible'
      });
    }

  } catch (error) {
    logger.error(`Error downloading video ${videoId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error descargando video'
    });
  }
}));

/**
 * @swagger
 * /api/video/{id}:
 *   delete:
 *     summary: Cancelar trabajo de renderizado
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del video
 *     responses:
 *       200:
 *         description: Trabajo cancelado exitosamente
 *       400:
 *         description: No se puede cancelar el trabajo
 *       404:
 *         description: Video no encontrado
 */

// DELETE /api/video/{id} - Cancelar o borrar tarea
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id: videoId } = req.params;
  
  try {
    const result = await cancelJob(videoId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel job',
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message,
      videoId: result.jobId
    });

  } catch (error) {
    logger.error(`Error cancelling job ${videoId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error cancelando trabajo'
    });
  }
}));

/**
 * @swagger
 * /api/video/queue/stats:
 *   get:
 *     summary: Obtener estadísticas de la cola de renderizado
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de la cola
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 queue:
 *                   type: object
 *                   properties:
 *                     waiting:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     completed:
 *                       type: integer
 *                     failed:
 *                       type: integer
 */

// GET /api/video/queue/stats - Estadísticas de la cola
router.get('/queue/stats', asyncHandler(async (req, res) => {
  try {
    const stats = await getQueueStats();
    
    res.json({
      success: true,
      queue: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo estadísticas de cola'
    });
  }
}));

/**
 * @swagger
 * /api/video/transitions:
 *   get:
 *     summary: Obtener transiciones disponibles
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de transiciones disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transitions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       description:
 *                         type: string
 *                       parameters:
 *                         type: array
 *                         items:
 *                           type: string
 */

// GET /api/video/transitions - Obtener transiciones disponibles
router.get('/transitions', asyncHandler(async (req, res) => {
  try {
    const transitionProcessor = new TransitionProcessor();
    const availableTransitions = transitionProcessor.getAvailableTransitions();
    
    res.json({
      success: true,
      transitions: availableTransitions,
      count: availableTransitions.length
    });

  } catch (error) {
    logger.error('Error getting available transitions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo transiciones disponibles'
    });
  }
}));

/**
 * @swagger
 * /api/video/formats:
 *   get:
 *     summary: Obtener formatos y configuraciones soportadas
 *     tags: [Video]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Formatos y configuraciones disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 formats:
 *                   type: object
 *                   properties:
 *                     formats:
 *                       type: array
 *                       items:
 *                         type: object
 *                     resolutions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     frameRates:
 *                       type: array
 *                       items:
 *                         type: integer
 */

// GET /api/video/formats - Formatos soportados
router.get('/formats', asyncHandler(async (req, res) => {
  const supportedFormats = {
    formats: [
      {
        name: 'mp4',
        description: 'MPEG-4 Video',
        codecs: ['libx264', 'libx265'],
        recommended: true,
        maxResolution: '8K'
      },
      {
        name: 'webm',
        description: 'WebM Video',
        codecs: ['libvpx-vp9'],
        recommended: true,
        maxResolution: '4K'
      },
      {
        name: 'mov',
        description: 'QuickTime Movie',
        codecs: ['libx264', 'libx265'],
        recommended: false,
        maxResolution: '8K'
      },
      {
        name: 'gif',
        description: 'Animated GIF',
        codecs: ['gif'],
        recommended: false,
        maxResolution: '1080p',
        notes: 'Solo para videos cortos'
      }
    ],
    resolutions: [
      { name: '8K', width: 7680, height: 4320, alias: '8k' },
      { name: '4K', width: 3840, height: 2160, alias: '4k' },
      { name: '2K', width: 2560, height: 1440, alias: '2k' },
      { name: '1080p', width: 1920, height: 1080, alias: 'hd', recommended: true },
      { name: '720p', width: 1280, height: 720, alias: 'hd720' },
      { name: '480p', width: 854, height: 480, alias: 'sd' }
    ],
    frameRates: [24, 25, 30, 50, 60],
    bitrates: ['1Mbps', '2Mbps', '5Mbps', '10Mbps', '20Mbps', '50Mbps'],
    qualities: [
      { name: 'low', crf: 28, description: 'Baja calidad, archivos pequeños' },
      { name: 'medium', crf: 23, description: 'Calidad media, balance tamaño/calidad' },
      { name: 'high', crf: 18, description: 'Alta calidad, archivos grandes', recommended: true },
      { name: 'ultra', crf: 15, description: 'Calidad ultra, archivos muy grandes' }
    ]
  };

  res.json({
    success: true,
    formats: supportedFormats
  });
}));

// Funciones auxiliares

async function performAdvancedValidation(timelineData) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    info: {}
  };

  try {
    const { timeline, output } = timelineData;
    
    // Calcular duración estimada
    let maxDuration = 0;
    let totalClips = 0;
    let totalTracks = timeline.tracks?.length || 0;

    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        totalClips++;
        const clipEnd = (clip.start || 0) + (clip.duration || clip.length || 0);
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }

        // Validar URLs de assets
        if (clip.asset?.src && !isValidUrl(clip.asset.src)) {
          results.errors.push({
            field: `timeline.tracks[].clips[].asset.src`,
            message: `URL no válida: ${clip.asset.src}`
          });
          results.valid = false;
        }
      });
    });

    // Información calculada
    results.info = {
      estimatedDuration: maxDuration,
      totalTracks,
      totalClips,
      outputFormat: output?.format || 'mp4',
      resolution: output?.resolution || { width: 1920, height: 1080 },
      estimatedProcessingTime: Math.round(maxDuration * 3 + Math.log(totalClips + 1) * totalTracks)
    };

    // Advertencias
    if (maxDuration > 300) { // 5 minutos
      results.warnings.push({
        field: 'timeline.duration',
        message: 'Video excede 5 minutos - el procesamiento puede tomar más tiempo'
      });
    }

    if (totalClips > 50) {
      results.warnings.push({
        field: 'timeline.complexity',
        message: 'Alto número de clips detectado - considere optimizar la timeline'
      });
    }

    if (output?.resolution?.width > 3840) {
      results.warnings.push({
        field: 'output.resolution',
        message: 'Resolución muy alta (>4K) - procesamiento intensivo'
      });
    }

    return results;

  } catch (error) {
    logger.error('Error in advanced validation:', error);
    return {
      valid: false,
      errors: [{ field: 'general', message: 'Error en validación avanzada' }],
      warnings: [],
      info: {}
    };
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// DEBUG endpoint - temporal
router.post('/debug', asyncHandler(async (req, res) => {
  logger.info('DEBUG: Raw request body:', JSON.stringify(req.body, null, 2));
  logger.info('DEBUG: Request headers:', req.headers);
  
  const { error, value } = validateVideoRequest.validate(req.body);
  
  res.json({
    success: true,
    debug: {
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {}),
      validationError: error ? error.details : null,
      validationSuccess: !error,
      rawBody: req.body
    }
  });
}));

function getStatusMessage(status, progress) {
  switch (status) {
    case 'enqueued':
      return 'Video en cola de procesamiento';
    case 'processing':
      return `Procesando video... ${progress || 0}%`;
    case 'completed':
      return 'Video renderizado exitosamente';
    case 'failed':
      return 'Error en el procesamiento del video';
    default:
      return 'Estado desconocido';
  }
}

module.exports = router; 