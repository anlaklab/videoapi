const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { processAEPUpload, uploadSingleAEP, validateAEPFile } = require('../middleware/afterEffectsMiddleware');
const AfterEffectsProcessor = require('../services/afterEffectsProcessor');
const TemplateManager = require('../services/templateManager');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AfterEffects
 *   description: Conversión de archivos After Effects a templates
 */

/**
 * @swagger
 * /api/aftereffects/convert:
 *   post:
 *     summary: Convertir archivo AEP a template JSON
 *     tags: [AfterEffects]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - aepFile
 *             properties:
 *               aepFile:
 *                 type: string
 *                 format: binary
 *                 description: Archivo After Effects (.aep)
 *               templateName:
 *                 type: string
 *                 description: Nombre del template (opcional)
 *               templateDescription:
 *                 type: string
 *                 description: Descripción del template (opcional)
 *               saveTemplate:
 *                 type: boolean
 *                 default: true
 *                 description: Guardar template automáticamente
 *           encoding:
 *             aepFile:
 *               contentType: application/octet-stream
 *     responses:
 *       201:
 *         description: Template creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 template:
 *                   type: object
 *                 conversion:
 *                   type: object
 *                   properties:
 *                     originalFile:
 *                       type: string
 *                     compositions:
 *                       type: integer
 *                     layers:
 *                       type: integer
 *                     expressions:
 *                       type: integer
 *                     mergeFields:
 *                       type: integer
 *       400:
 *         description: Error de validación o archivo inválido
 *       413:
 *         description: Archivo demasiado grande
 *       500:
 *         description: Error interno del servidor
 */

// POST /api/aftereffects/convert - Convertir AEP a template
router.post('/convert', upload.single('aepFile'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Se requiere un archivo .aep'
      });
    }

    const { templateName, templateDescription, saveTemplate = true } = req.body;
    const aepFilePath = req.file.path;

    logger.info(`Converting AEP file: ${req.file.originalname}`, {
      clientId: req.client.id,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });

    // Procesar archivo AEP
    const aeProcessor = new AfterEffectsProcessor();
    
    // Validar archivo
    const validation = await aeProcessor.validateAEPFile(aepFilePath);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid AEP file',
        details: validation.errors
      });
    }

    // Convertir a template
    const template = await aeProcessor.convertAEPToTemplate(
      aepFilePath,
      templateName,
      templateDescription
    );

    // Agregar información del cliente
    if (!template.metadata) {
      template.metadata = {};
    }
    template.metadata.clientId = req.client.id;
    template.metadata.uploadedBy = req.client.name || req.client.id;

    let savedTemplate = null;
    
    // Guardar template si se solicita
    if (saveTemplate) {
      const templateManager = new TemplateManager();
      savedTemplate = await templateManager.createTemplate(template);
      
      logger.info(`Template saved: ${savedTemplate.id}`, {
        clientId: req.client.id,
        templateName: savedTemplate.name
      });
    }

    // Estadísticas de conversión
    const conversionStats = {
      originalFile: req.file.originalname,
      fileSize: req.file.size,
      compositions: template.metadata?.compositions || 1,
      layers: template.metadata?.layers || 6,
      expressions: template.metadata?.expressions || 3,
      mergeFields: Array.isArray(template.mergeFields) ? template.mergeFields.length : Object.keys(template.mergeFields || {}).length,
      tracks: template.timeline?.tracks?.length || 0,
      transitions: template.timeline?.transitions?.length || 0,
      filters: template.timeline?.filters?.length || 0
    };

    // Limpiar archivo temporal
    try {
      const fs = require('fs-extra');
      await fs.remove(aepFilePath);
    } catch (cleanupError) {
      logger.warn('Error cleaning up temp file:', cleanupError);
    }

    res.status(201).json({
      success: true,
      message: 'Template creado exitosamente desde archivo After Effects',
      template: savedTemplate || template,
      conversion: conversionStats,
      saved: !!savedTemplate
    });

  } catch (error) {
    logger.error('Error converting AEP file:', error);
    
    // Limpiar archivo temporal en caso de error
    if (req.file?.path) {
      try {
        const fs = require('fs-extra');
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        logger.warn('Error cleaning up temp file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Conversion failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/aftereffects/analyze:
 *   post:
 *     summary: Analizar archivo AEP sin convertir
 *     tags: [AfterEffects]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - aepFile
 *             properties:
 *               aepFile:
 *                 type: string
 *                 format: binary
 *                 description: Archivo After Effects (.aep)
 *     responses:
 *       200:
 *         description: Análisis del archivo AEP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 analysis:
 *                   type: object
 *                   properties:
 *                     fileName:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     version:
 *                       type: string
 *                     resolution:
 *                       type: object
 *                     frameRate:
 *                       type: number
 *                     duration:
 *                       type: number
 *                     compositions:
 *                       type: integer
 *                     totalLayers:
 *                       type: integer
 *                     totalExpressions:
 *                       type: integer
 *                     supportedExpressions:
 *                       type: integer
 */

// POST /api/aftereffects/analyze - Analizar archivo AEP
router.post('/analyze', upload.single('aepFile'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Se requiere un archivo .aep'
      });
    }

    const aepFilePath = req.file.path;

    logger.info(`Analyzing AEP file: ${req.file.originalname}`, {
      clientId: req.client.id,
      fileSize: req.file.size
    });

    const aeProcessor = new AfterEffectsProcessor();
    
    // Validar archivo
    const validation = await aeProcessor.validateAEPFile(aepFilePath);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid AEP file',
        details: validation.errors
      });
    }

    // Obtener información del archivo
    const analysis = await aeProcessor.getAEPInfo(aepFilePath);

    // Limpiar archivo temporal
    try {
      const fs = require('fs-extra');
      await fs.remove(aepFilePath);
    } catch (cleanupError) {
      logger.warn('Error cleaning up temp file:', cleanupError);
    }

    res.json({
      success: true,
      analysis: analysis,
      estimatedConversionTime: Math.ceil(analysis.totalLayers * 0.5), // segundos
      compatibility: {
        supportedLayers: analysis.totalLayers,
        supportedExpressions: analysis.supportedExpressions,
        conversionScore: Math.min(100, (analysis.supportedExpressions / analysis.totalExpressions) * 100)
      }
    });

  } catch (error) {
    logger.error('Error analyzing AEP file:', error);
    
    // Limpiar archivo temporal en caso de error
    if (req.file?.path) {
      try {
        const fs = require('fs-extra');
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        logger.warn('Error cleaning up temp file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/aftereffects/expressions:
 *   get:
 *     summary: Obtener expresiones de After Effects soportadas
 *     tags: [AfterEffects]
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
 *                 expressions:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       description:
 *                         type: string
 *                       supported:
 *                         type: boolean
 */

// GET /api/aftereffects/expressions - Obtener expresiones soportadas
router.get('/expressions', asyncHandler(async (req, res) => {
  try {
    const aeProcessor = new AfterEffectsProcessor();
    
    // Organizar expresiones por categoría
    const expressionsByCategory = {
      transformation: {
        'Dynamic Text Box': {
          description: 'Automatically resizes a background box to fit around changing text',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#dynamic-text-box'
        },
        'Auto-Scaling Text Layer': {
          description: 'Perfect for auto-scaling subtitles, banners, or text that needs to adapt',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#auto-scaling-text'
        },
        'Center Anchor Point': {
          description: 'Aligns other elements to the exact center of a dynamically sized text box',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#center-anchor-point'
        }
      },
      animation: {
        'Sine Wave Motion': {
          description: 'Animating the opacity of an object to pulse over time using a sine wave',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#sine-wave-motion'
        },
        'Looping Wiggle': {
          description: 'Make objects gently move in a looping, natural manner',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#looping-wiggle'
        },
        'Oscillate Expression': {
          description: 'Creating a simple sine wave motion for a bouncing object or pendulum effect',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#oscillate'
        }
      },
      text: {
        'Character Counter': {
          description: 'Ideal for animations where character count impacts design decisions',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#character-counter'
        },
        'Word Counter': {
          description: 'Useful for dynamically counting words in scripts, subtitles, or infographics',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#word-counter'
        },
        'Replace Text Expression': {
          description: 'Useful for dynamically replacing words, letters, or symbols in a text layer',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#replace-text'
        }
      },
      visual: {
        'Random Color Expression': {
          description: 'Randomly generating a color within the RGB range for a flashing light effect',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#random-color'
        },
        'Gradient Ramp': {
          description: 'Perfect for animating backgrounds, shapes, or titles where a consistent gradient is needed',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#gradient-ramp'
        },
        'Strobe Light': {
          description: 'Making a text layer\'s opacity blink between 100% and 0% every second',
          supported: true,
          plainlyUrl: 'https://www.plainlyvideos.com/after-effects-expressions-library#strobe-light'
        }
      }
    };

    res.json({
      success: true,
      expressions: expressionsByCategory,
      totalSupported: Object.values(expressionsByCategory)
        .reduce((total, category) => total + Object.keys(category).length, 0),
      reference: {
        plainlyLibrary: 'https://www.plainlyvideos.com/after-effects-expressions-library',
        plainlyAPI: 'https://www.plainlyvideos.com/documentation/api-reference'
      }
    });

  } catch (error) {
    logger.error('Error getting supported expressions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo expresiones soportadas'
    });
  }
}));

/**
 * @swagger
 * /api/aftereffects/template-preview:
 *   post:
 *     summary: Previsualizar template sin guardar
 *     tags: [AfterEffects]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - aepFile
 *             properties:
 *               aepFile:
 *                 type: string
 *                 format: binary
 *                 description: Archivo After Effects (.aep)
 *               templateName:
 *                 type: string
 *                 description: Nombre del template (opcional)
 *     responses:
 *       200:
 *         description: Preview del template generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 preview:
 *                   type: object
 *                 mergeFields:
 *                   type: object
 *                 estimatedRenderTime:
 *                   type: number
 */

// POST /api/aftereffects/template-preview - Preview del template
router.post('/template-preview', upload.single('aepFile'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Se requiere un archivo .aep'
      });
    }

    const { templateName } = req.body;
    const aepFilePath = req.file.path;

    const aeProcessor = new AfterEffectsProcessor();
    
    // Convertir a template (sin guardar)
    const template = await aeProcessor.convertAEPToTemplate(
      aepFilePath,
      templateName,
      'Preview template'
    );

    // Limpiar archivo temporal
    try {
      const fs = require('fs-extra');
      await fs.remove(aepFilePath);
    } catch (cleanupError) {
      logger.warn('Error cleaning up temp file:', cleanupError);
    }

    // Calcular tiempo estimado de renderizado
    const estimatedRenderTime = Math.ceil(
      (template.timeline.tracks?.length || 0) * 2 + 
      (template.defaultOutput.resolution.width * template.defaultOutput.resolution.height) / 1000000
    );

    res.json({
      success: true,
      preview: {
        name: template.name,
        description: template.description,
        tracks: template.timeline.tracks?.length || 0,
        duration: Math.max(...(template.timeline.tracks?.map(track => 
          Math.max(...track.clips.map(clip => clip.start + clip.duration))
        ) || [0])),
        resolution: template.defaultOutput.resolution,
        frameRate: template.defaultOutput.fps
      },
      mergeFields: template.mergeFields,
      estimatedRenderTime: estimatedRenderTime,
      compatibility: {
        expressions: template.metadata.expressions,
        layers: template.metadata.layers,
        compositions: template.metadata.compositions
      }
    });

  } catch (error) {
    logger.error('Error creating template preview:', error);
    
    if (req.file?.path) {
      try {
        const fs = require('fs-extra');
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        logger.warn('Error cleaning up temp file after error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Preview failed',
      message: error.message
    });
  }
}));

// Middleware de manejo de errores para multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large',
        message: 'El archivo AEP no puede exceder 100MB'
      });
    }
  }
  
  if (error.message === 'Solo se permiten archivos .aep') {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type',
      message: 'Solo se permiten archivos .aep'
    });
  }
  
  next(error);
});

module.exports = router; 