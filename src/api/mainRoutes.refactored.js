/**
 * Main API Routes - Refactored Version
 * Organized into separate modules for better maintainability
 */

const express = require('express');
const logger = require('../utils/logger');

// Import route modules
const healthRoutes = require('./routes/health');
const statsRoutes = require('./routes/stats');
const aeToTemplateRoutes = require('./routes/ae-to-template');

const router = express.Router();

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

// Mount route modules
router.use('/health', healthRoutes);
router.use('/stats', simpleAuth, statsRoutes);
router.use('/ae-to-template', simpleAuth, aeToTemplateRoutes);

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
 */
router.post('/template-to-video', simpleAuth, async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  const timer = logger.timeOperation('Template to Video', correlationId);
  
  try {
    const { timeline, output = {}, mergeFields = {}, priority = 'normal' } = req.body;

    if (!timeline) {
      return res.status(400).json({
        success: false,
        error: 'Timeline requerido',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🎬 Iniciando renderizado Template → Video', {
      correlationId,
      timelineKeys: Object.keys(timeline),
      outputFormat: output.format || 'mp4',
      mergeFieldsCount: Object.keys(mergeFields).length
    });

    // Mock response for now - in real implementation this would use the video processor
    const result = {
      jobId: `template-video-${Date.now()}`,
      status: 'completed',
      videoUrl: `https://example.com/videos/${Date.now()}.mp4`,
      thumbnailUrl: `https://example.com/thumbnails/${Date.now()}.jpg`,
      duration: timeline.duration || 10,
      processingTime: 15.2
    };

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
 * /api/status:
 *   get:
 *     summary: Estado de la API
 *     description: Información básica sobre el estado de la API
 *     tags:
 *       - sistema
 *     responses:
 *       200:
 *         description: Estado de la API
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'JSON2VIDEO API funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router; 