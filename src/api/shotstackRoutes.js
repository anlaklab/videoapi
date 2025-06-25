/**
 * Rutas API para Integración Shotstack Studio - VERSIÓN MEJORADA
 * 
 * Funcionalidades:
 * - Renderizado con transiciones y animaciones
 * - Efectos avanzados (Ken Burns, zoom, rotaciones)
 * - Preview en tiempo real
 * - Gestión de assets
 * - Optimización de rendimiento
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const TemplateToVideoProcessor = require('../modules/template-to-video');

const router = express.Router();

// Middleware de autenticación simple
const simpleAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== 'dev-key-12345') {
    return res.status(401).json({
      success: false,
      error: 'API key requerida',
      message: 'Incluye el header x-api-key: dev-key-12345'
    });
  }
  
  next();
};

/**
 * @swagger
 * /api/shotstack/render-advanced:
 *   post:
 *     summary: Renderizar video avanzado con efectos
 *     description: |
 *       Renderiza video con transiciones, animaciones y efectos avanzados
 *       incluyendo Ken Burns, zoom, rotaciones, y más efectos cinemáticos.
 *     tags:
 *       - Shotstack Integration
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - timeline
 *             properties:
 *               timeline:
 *                 type: object
 *                 description: Timeline con tracks, clips y configuración
 *               transitions:
 *                 type: array
 *                 description: Array de transiciones aplicadas
 *               animations:
 *                 type: array
 *                 description: Array de animaciones aplicadas
 *               settings:
 *                 type: object
 *                 description: Configuración de renderizado
 *     responses:
 *       200:
 *         description: Video renderizado exitosamente
 *       400:
 *         description: Error en el formato del timeline
 *       401:
 *         description: API key requerida
 *       500:
 *         description: Error interno del servidor
 */
router.post('/render-advanced', simpleAuth, async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  const timer = logger.timeOperation('Shotstack Advanced Render', correlationId);
  
  try {
    const { timeline, transitions = [], animations = [], settings = {} } = req.body;

    if (!timeline) {
      return res.status(400).json({
        success: false,
        error: 'Timeline requerido',
        message: 'Debe proporcionar un timeline válido',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('🎬 Iniciando renderizado avanzado desde Shotstack', {
      correlationId,
      timelineKeys: Object.keys(timeline),
      tracksCount: timeline.tracks?.length || 0,
      transitionsCount: transitions.length,
      animationsCount: animations.length
    });

    // Procesar transiciones y animaciones
    const enhancedTimeline = await processAdvancedEffects({
      timeline,
      transitions,
      animations,
      settings
    });

    // Convertir a formato Shotstack con efectos
    const shotstackTimeline = convertToShotstackAdvanced(enhancedTimeline);

    logger.info('🔄 Timeline convertido con efectos avanzados', {
      correlationId,
      originalTracks: timeline.tracks.length,
      enhancedTracks: shotstackTimeline.tracks.length,
      effectsApplied: transitions.length + animations.length
    });

    // Crear template completo para renderizado
    const renderData = {
      timeline: shotstackTimeline,
      output: {
        format: settings.format || 'mp4',
        resolution: {
          width: timeline.resolution?.width || 1920,
          height: timeline.resolution?.height || 1080
        },
        fps: timeline.fps || 30,
        quality: settings.quality || 'high'
      }
    };

    // Procesar con el motor de video mejorado
    const templateProcessor = new (require('../modules/template-to-video/index.js'))();
    const result = await templateProcessor.processAdvancedTemplate(renderData, {
      correlationId,
      enableEffects: true,
      enableTransitions: true,
      enableAnimations: true
    });

    timer.end({ success: true });

    res.json({
      success: true,
      message: 'Video renderizado con efectos avanzados',
      data: {
        result: {
          url: result.url,
          filename: result.filename,
          size: result.size,
          duration: result.duration,
          format: result.format
        },
        effects: {
          transitionsApplied: transitions.length,
          animationsApplied: animations.length,
          totalEffects: transitions.length + animations.length
        },
        metadata: {
          renderTime: timer.getDuration(),
          tracks: shotstackTimeline.tracks.length,
          totalClips: shotstackTimeline.tracks.reduce((sum, track) => sum + track.clips.length, 0)
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    timer.end({ success: false, error: error.message });
    logger.error('❌ Error en renderizado avanzado', {
      error: error.message,
      correlationId
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Error renderizando video con efectos avanzados',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/shotstack/preview:
 *   post:
 *     summary: Generar preview rápido del video
 *     description: |
 *       Genera un preview de baja calidad para visualización rápida
 *       del timeline con efectos aplicados.
 *     tags:
 *       - Shotstack Integration
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - timeline
 *             properties:
 *               timeline:
 *                 type: object
 *               segment:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: number
 *                   duration:
 *                     type: number
 *     responses:
 *       200:
 *         description: Preview generado exitosamente
 */
router.post('/preview', simpleAuth, async (req, res) => {
  const correlationId = logger.generateCorrelationId();
  
  try {
    const { timeline, segment, transitions = [], animations = [] } = req.body;

    if (!timeline) {
      return res.status(400).json({
        success: false,
        error: 'Timeline requerido para preview',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('👁️ Generando preview rápido', {
      correlationId,
      tracksCount: timeline.tracks?.length || 0,
      segment: segment || 'completo'
    });

    // Crear versión optimizada para preview
    const previewTimeline = createPreviewTimeline(timeline, segment);
    
    // Aplicar efectos básicos
    const enhancedPreview = await processAdvancedEffects({
      timeline: previewTimeline,
      transitions: transitions.slice(0, 3), // Limitar efectos para preview
      animations: animations.slice(0, 3),
      settings: { quality: 'preview', format: 'mp4' }
    });

    // Renderizar preview
    const templateProcessor = new (require('../modules/template-to-video/index.js'))();
    const result = await templateProcessor.processAdvancedTemplate(enhancedPreview, {
      correlationId,
      isPreview: true,
      quality: 'low',
      maxDuration: 30 // Limitar duración del preview
    });

    res.json({
      success: true,
      message: 'Preview generado exitosamente',
      data: {
        result: {
          url: result.url,
          filename: result.filename,
          size: result.size,
          isPreview: true
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error generando preview', {
      error: error.message,
      correlationId
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Error generando preview',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Procesar efectos avanzados (transiciones y animaciones)
 */
async function processAdvancedEffects({ timeline, transitions, animations, settings }) {
  const enhancedTimeline = JSON.parse(JSON.stringify(timeline));

  // Procesar transiciones
  for (const transition of transitions) {
    enhancedTimeline.tracks = applyTransitionToTracks(
      enhancedTimeline.tracks, 
      transition
    );
  }

  // Procesar animaciones
  for (const animation of animations) {
    enhancedTimeline.tracks = applyAnimationToTracks(
      enhancedTimeline.tracks,
      animation
    );
  }

  return enhancedTimeline;
}

/**
 * Aplicar transición a las pistas
 */
function applyTransitionToTracks(tracks, transition) {
  return tracks.map(track => {
    const targetClip = track.clips.find(clip => clip.id === transition.clipId);
    
    if (targetClip) {
      // Aplicar configuración de transición
      targetClip.transition = {
        type: transition.type,
        duration: transition.config.duration,
        easing: transition.config.easing,
        properties: transition.properties
      };

      // Configuraciones específicas por tipo de transición
      switch (transition.type) {
        case 'fade':
          targetClip.fade = {
            in: transition.config.duration,
            out: transition.config.duration
          };
          break;
          
        case 'slide-right':
          targetClip.transform = {
            ...targetClip.transform,
            x: `+${transition.config.distance || 100}`
          };
          break;
          
        case 'zoom-in':
          targetClip.transform = {
            ...targetClip.transform,
            scale: transition.config.endScale || 1.2
          };
          break;
      }
    }
    
    return track;
  });
}

/**
 * Aplicar animación a las pistas
 */
function applyAnimationToTracks(tracks, animation) {
  return tracks.map(track => {
    const targetClip = track.clips.find(clip => clip.id === animation.clipId);
    
    if (targetClip) {
      // Aplicar configuración de animación
      targetClip.animation = {
        type: animation.type,
        config: animation.config,
        category: animation.category
      };

      // Configuraciones específicas por tipo de animación
      switch (animation.type) {
        case 'ken-burns':
          targetClip.kenBurns = {
            startScale: animation.config.startScale || 1.0,
            endScale: animation.config.endScale || 1.2,
            startX: animation.config.startX || 0,
            startY: animation.config.startY || 0,
            endX: animation.config.endX || -50,
            endY: animation.config.endY || -30,
            duration: animation.config.duration || 5.0
          };
          break;
          
        case 'zoom-in':
          targetClip.zoom = {
            start: animation.config.startScale || 1.0,
            end: animation.config.endScale || 1.5,
            duration: animation.config.duration || 2.0,
            easing: animation.config.easing || 'ease-in-out'
          };
          break;
          
        case 'rotation':
          targetClip.rotate = {
            start: animation.config.startRotation || 0,
            end: animation.config.endRotation || 360,
            duration: animation.config.duration || 3.0
          };
          break;
          
        case 'camera-shake':
          targetClip.shake = {
            intensity: animation.config.intensity || 5,
            frequency: animation.config.frequency || 10,
            duration: animation.config.duration || 0.5
          };
          break;
      }
    }
    
    return track;
  });
}

/**
 * Convertir a formato Shotstack avanzado
 */
function convertToShotstackAdvanced(enhancedTimeline) {
  return {
    resolution: enhancedTimeline.resolution,
    background: enhancedTimeline.background,
    tracks: enhancedTimeline.tracks.map(track => ({
      id: track.id,
      clips: track.clips.map(clip => convertAdvancedClip(clip))
    }))
  };
}

/**
 * Convertir clip con efectos avanzados
 */
function convertAdvancedClip(clip) {
  const shotstackClip = {
    id: clip.id,
    start: clip.start,
    length: clip.duration,
    asset: {
      type: clip.type,
      ...(clip.text && { text: clip.text }),
      ...(clip.src && { src: clip.src }),
      ...(clip.style && { style: clip.style })
    }
  };

  // Aplicar transiciones
  if (clip.transition) {
    shotstackClip.transition = {
      in: clip.transition.type,
      out: clip.transition.type
    };
  }

  // Aplicar efectos Ken Burns
  if (clip.kenBurns) {
    shotstackClip.asset.crop = {
      top: clip.kenBurns.startY,
      bottom: clip.kenBurns.endY,
      left: clip.kenBurns.startX,
      right: clip.kenBurns.endX
    };
    shotstackClip.scale = {
      start: clip.kenBurns.startScale,
      end: clip.kenBurns.endScale
    };
  }

  // Aplicar zoom
  if (clip.zoom) {
    shotstackClip.scale = {
      start: clip.zoom.start,
      end: clip.zoom.end
    };
  }

  // Aplicar rotación
  if (clip.rotate) {
    shotstackClip.rotate = {
      start: clip.rotate.start,
      end: clip.rotate.end
    };
  }

  // Aplicar shake (simulado con múltiples keyframes)
  if (clip.shake) {
    shotstackClip.offset = {
      x: generateShakeKeyframes(clip.shake),
      y: generateShakeKeyframes(clip.shake)
    };
  }

  return shotstackClip;
}

/**
 * Generar keyframes para efecto shake
 */
function generateShakeKeyframes(shakeConfig) {
  const keyframes = [];
  const { intensity, frequency, duration } = shakeConfig;
  const steps = Math.floor(duration * frequency);
  
  for (let i = 0; i <= steps; i++) {
    const time = (i / steps) * duration;
    const offset = (Math.random() - 0.5) * intensity * 2;
    keyframes.push({
      time,
      value: offset
    });
  }
  
  return keyframes;
}

/**
 * Crear timeline optimizado para preview
 */
function createPreviewTimeline(timeline, segment) {
  const previewDuration = segment?.duration || Math.min(timeline.duration, 10);
  const startTime = segment?.start || 0;
  
  const previewTimeline = {
    ...timeline,
    duration: previewDuration,
    tracks: timeline.tracks.map(track => ({
      ...track,
      clips: track.clips
        .filter(clip => {
          const clipEnd = clip.start + clip.duration;
          return clipEnd > startTime && clip.start < startTime + previewDuration;
        })
        .map(clip => ({
          ...clip,
          start: Math.max(0, clip.start - startTime),
          duration: Math.min(
            clip.duration,
            previewDuration - Math.max(0, clip.start - startTime)
          )
        }))
    }))
  };
  
  return previewTimeline;
}

module.exports = router; 