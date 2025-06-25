const logger = require('../../utils/logger');

/**
 * TemplateValidator - Responsable de validar templates y sus estructuras
 * Extraído del TemplateManager para separar responsabilidades
 */
class TemplateValidator {
  constructor() {
    this.validationRules = {
      required: ['id', 'name', 'version'],
      optional: ['description', 'tags', 'metadata', 'timeline'],
      types: {
        id: 'string',
        name: 'string',
        version: 'string',
        description: 'string',
        tags: 'array',
        metadata: 'object',
        timeline: 'object'
      }
    };

    this.timelineRules = {
      required: ['tracks'],
      optional: ['duration', 'frameRate', 'resolution', 'background'],
      types: {
        tracks: 'array',
        duration: 'number',
        frameRate: 'number',
        resolution: 'object',
        background: 'object'
      }
    };

    this.trackRules = {
      required: ['clips'],
      optional: ['id', 'name', 'type', 'enabled'],
      types: {
        id: 'string',
        name: 'string',
        type: 'string',
        enabled: 'boolean',
        clips: 'array'
      }
    };

    this.clipRules = {
      required: ['type', 'start', 'duration'],
      optional: ['id', 'name', 'src', 'text', 'position', 'scale', 'opacity', 'effects', 'animations'],
      types: {
        id: 'string',
        name: 'string',
        type: 'string',
        start: 'number',
        duration: 'number',
        src: 'string',
        text: 'string',
        position: 'object',
        scale: 'number',
        opacity: 'number',
        effects: 'array',
        animations: 'array'
      }
    };

    this.supportedClipTypes = [
      'video', 'image', 'audio', 'text', 'html', 'background', 'shape'
    ];

    this.supportedTrackTypes = [
      'video', 'audio', 'text', 'background', 'overlay'
    ];
  }

  /**
   * Validar template completo
   */
  async validateTemplate(template, options = {}) {
    const correlationId = logger.generateCorrelationId();
    const timer = logger.timeOperation('Template Validation', correlationId);

    try {
      logger.info('🔍 Validando template', {
        templateId: template.id,
        correlationId
      });

      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        metadata: {
          templateId: template.id,
          validatedAt: new Date().toISOString(),
          validationLevel: options.strict ? 'strict' : 'standard'
        }
      };

      // Validar estructura básica
      this.validateBasicStructure(template, validationResult);

      // Validar timeline si existe
      if (template.timeline) {
        this.validateTimeline(template.timeline, validationResult);
      }

      // Validar merge fields si existen
      if (template.mergeFields) {
        this.validateMergeFields(template.mergeFields, validationResult);
      }

      // Validar metadata específica por tipo
      if (template.metadata?.type) {
        this.validateByType(template, validationResult);
      }

      // Validaciones adicionales en modo estricto
      if (options.strict) {
        this.performStrictValidation(template, validationResult);
      }

      // Determinar si es válido basado en errores
      validationResult.isValid = validationResult.errors.length === 0;

      timer.end({
        success: validationResult.isValid,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length
      });

      logger.info('✅ Validación completada', {
        templateId: template.id,
        correlationId,
        isValid: validationResult.isValid,
        errors: validationResult.errors.length,
        warnings: validationResult.warnings.length
      });

      return validationResult;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      logger.error('❌ Error en validación', {
        templateId: template.id,
        correlationId,
        error: error.message
      });

      return {
        isValid: false,
        errors: [`Error interno de validación: ${error.message}`],
        warnings: [],
        info: [],
        metadata: {
          templateId: template.id,
          validatedAt: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Validar estructura básica del template
   */
  validateBasicStructure(template, result) {
    // Validar campos requeridos
    this.validationRules.required.forEach(field => {
      if (!template[field]) {
        result.errors.push(`Campo requerido faltante: ${field}`);
      }
    });

    // Validar tipos de datos
    Object.entries(this.validationRules.types).forEach(([field, expectedType]) => {
      if (template[field] !== undefined) {
        const actualType = Array.isArray(template[field]) ? 'array' : typeof template[field];
        if (actualType !== expectedType) {
          result.errors.push(`Campo '${field}' debe ser de tipo ${expectedType}, recibido: ${actualType}`);
        }
      }
    });

    // Validar formato de ID
    if (template.id && !/^[a-zA-Z0-9_-]+$/.test(template.id)) {
      result.errors.push('ID del template debe contener solo letras, números, guiones y guiones bajos');
    }

    // Validar formato de versión
    if (template.version && !/^\d+\.\d+\.\d+$/.test(template.version)) {
      result.warnings.push('Versión debería seguir el formato semver (x.y.z)');
    }

    // Validar tags
    if (template.tags && Array.isArray(template.tags)) {
      template.tags.forEach((tag, index) => {
        if (typeof tag !== 'string') {
          result.errors.push(`Tag en índice ${index} debe ser una cadena de texto`);
        }
      });
    }
  }

  /**
   * Validar timeline
   */
  validateTimeline(timeline, result) {
    // Validar estructura básica del timeline
    this.timelineRules.required.forEach(field => {
      if (!timeline[field]) {
        result.errors.push(`Campo requerido en timeline: ${field}`);
      }
    });

    // Validar tipos
    Object.entries(this.timelineRules.types).forEach(([field, expectedType]) => {
      if (timeline[field] !== undefined) {
        const actualType = Array.isArray(timeline[field]) ? 'array' : typeof timeline[field];
        if (actualType !== expectedType) {
          result.errors.push(`Campo timeline.${field} debe ser de tipo ${expectedType}`);
        }
      }
    });

    // Validar resolución
    if (timeline.resolution) {
      if (!timeline.resolution.width || !timeline.resolution.height) {
        result.errors.push('Resolución debe incluir width y height');
      }
      if (timeline.resolution.width < 1 || timeline.resolution.height < 1) {
        result.errors.push('Resolución debe tener valores positivos');
      }
    }

    // Validar frameRate
    if (timeline.frameRate && (timeline.frameRate < 1 || timeline.frameRate > 120)) {
      result.warnings.push('FrameRate fuera del rango común (1-120 fps)');
    }

    // Validar tracks
    if (timeline.tracks && Array.isArray(timeline.tracks)) {
      if (timeline.tracks.length === 0) {
        result.warnings.push('Timeline no tiene tracks definidos');
      } else {
        timeline.tracks.forEach((track, index) => {
          this.validateTrack(track, index, result);
        });
      }
    }

    // Validar duración total
    if (timeline.duration && timeline.duration <= 0) {
      result.errors.push('Duración del timeline debe ser positiva');
    }
  }

  /**
   * Validar track individual
   */
  validateTrack(track, trackIndex, result) {
    const trackPrefix = `tracks[${trackIndex}]`;

    // Validar campos requeridos
    this.trackRules.required.forEach(field => {
      if (!track[field]) {
        result.errors.push(`${trackPrefix}: Campo requerido faltante: ${field}`);
      }
    });

    // Validar tipos
    Object.entries(this.trackRules.types).forEach(([field, expectedType]) => {
      if (track[field] !== undefined) {
        const actualType = Array.isArray(track[field]) ? 'array' : typeof track[field];
        if (actualType !== expectedType) {
          result.errors.push(`${trackPrefix}.${field} debe ser de tipo ${expectedType}`);
        }
      }
    });

    // Validar tipo de track
    if (track.type && !this.supportedTrackTypes.includes(track.type)) {
      result.errors.push(`${trackPrefix}: Tipo de track no soportado: ${track.type}`);
    }

    // Validar clips
    if (track.clips && Array.isArray(track.clips)) {
      if (track.clips.length === 0) {
        result.warnings.push(`${trackPrefix}: Track no tiene clips`);
      } else {
        track.clips.forEach((clip, clipIndex) => {
          this.validateClip(clip, trackIndex, clipIndex, result);
        });
      }
    }
  }

  /**
   * Validar clip individual
   */
  validateClip(clip, trackIndex, clipIndex, result) {
    const clipPrefix = `tracks[${trackIndex}].clips[${clipIndex}]`;

    // Validar campos requeridos
    this.clipRules.required.forEach(field => {
      if (clip[field] === undefined || clip[field] === null) {
        result.errors.push(`${clipPrefix}: Campo requerido faltante: ${field}`);
      }
    });

    // Validar tipos
    Object.entries(this.clipRules.types).forEach(([field, expectedType]) => {
      if (clip[field] !== undefined) {
        const actualType = Array.isArray(clip[field]) ? 'array' : typeof clip[field];
        if (actualType !== expectedType) {
          result.errors.push(`${clipPrefix}.${field} debe ser de tipo ${expectedType}`);
        }
      }
    });

    // Validar tipo de clip
    if (clip.type && !this.supportedClipTypes.includes(clip.type)) {
      result.errors.push(`${clipPrefix}: Tipo de clip no soportado: ${clip.type}`);
    }

    // Validar timing
    if (clip.start < 0) {
      result.errors.push(`${clipPrefix}: start no puede ser negativo`);
    }

    if (clip.duration <= 0) {
      result.errors.push(`${clipPrefix}: duration debe ser positiva`);
    }

    // Validar propiedades específicas por tipo
    this.validateClipByType(clip, clipPrefix, result);

    // Validar posición
    if (clip.position) {
      if (typeof clip.position.x !== 'number' || typeof clip.position.y !== 'number') {
        result.errors.push(`${clipPrefix}: position debe tener x e y numéricos`);
      }
    }

    // Validar escala
    if (clip.scale !== undefined && (clip.scale <= 0 || clip.scale > 10)) {
      result.warnings.push(`${clipPrefix}: scale fuera del rango común (0-10)`);
    }

    // Validar opacidad
    if (clip.opacity !== undefined && (clip.opacity < 0 || clip.opacity > 1)) {
      result.errors.push(`${clipPrefix}: opacity debe estar entre 0 y 1`);
    }

    // Validar efectos
    if (clip.effects && Array.isArray(clip.effects)) {
      clip.effects.forEach((effect, effectIndex) => {
        this.validateEffect(effect, `${clipPrefix}.effects[${effectIndex}]`, result);
      });
    }

    // Validar animaciones
    if (clip.animations && Array.isArray(clip.animations)) {
      clip.animations.forEach((animation, animIndex) => {
        this.validateAnimation(animation, `${clipPrefix}.animations[${animIndex}]`, result);
      });
    }
  }

  /**
   * Validar clip según su tipo
   */
  validateClipByType(clip, clipPrefix, result) {
    switch (clip.type) {
      case 'video':
      case 'image':
      case 'audio':
        if (!clip.src) {
          result.errors.push(`${clipPrefix}: Clips de tipo ${clip.type} requieren 'src'`);
        }
        break;

      case 'text':
        if (!clip.text) {
          result.errors.push(`${clipPrefix}: Clips de texto requieren 'text'`);
        }
        if (clip.fontSize && (clip.fontSize < 1 || clip.fontSize > 500)) {
          result.warnings.push(`${clipPrefix}: fontSize fuera del rango común (1-500)`);
        }
        break;

      case 'html':
        if (!clip.html) {
          result.errors.push(`${clipPrefix}: Clips HTML requieren 'html'`);
        }
        break;

      case 'background':
        if (!clip.color && !clip.src) {
          result.errors.push(`${clipPrefix}: Clips de background requieren 'color' o 'src'`);
        }
        break;
    }
  }

  /**
   * Validar efecto
   */
  validateEffect(effect, effectPrefix, result) {
    if (!effect.type) {
      result.errors.push(`${effectPrefix}: Efecto requiere 'type'`);
    }

    if (effect.strength !== undefined && (effect.strength < 0 || effect.strength > 1)) {
      result.warnings.push(`${effectPrefix}: strength fuera del rango común (0-1)`);
    }
  }

  /**
   * Validar animación
   */
  validateAnimation(animation, animPrefix, result) {
    if (!animation.type) {
      result.errors.push(`${animPrefix}: Animación requiere 'type'`);
    }

    if (animation.duration && animation.duration <= 0) {
      result.errors.push(`${animPrefix}: duration debe ser positiva`);
    }

    if (animation.delay && animation.delay < 0) {
      result.errors.push(`${animPrefix}: delay no puede ser negativo`);
    }
  }

  /**
   * Validar merge fields
   */
  validateMergeFields(mergeFields, result) {
    if (!Array.isArray(mergeFields)) {
      result.errors.push('mergeFields debe ser un array');
      return;
    }

    mergeFields.forEach((field, index) => {
      const fieldPrefix = `mergeFields[${index}]`;

      if (!field.name) {
        result.errors.push(`${fieldPrefix}: Campo requiere 'name'`);
      }

      if (!field.type) {
        result.errors.push(`${fieldPrefix}: Campo requiere 'type'`);
      }

      // Validar nombre del campo
      if (field.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
        result.errors.push(`${fieldPrefix}: name debe ser un identificador válido`);
      }

      // Validar tipo de campo
      const validTypes = ['text', 'number', 'boolean', 'image', 'video', 'audio', 'color'];
      if (field.type && !validTypes.includes(field.type)) {
        result.errors.push(`${fieldPrefix}: type no válido. Tipos soportados: ${validTypes.join(', ')}`);
      }

      // Validar valor por defecto
      if (field.defaultValue !== undefined && field.type) {
        this.validateDefaultValue(field.defaultValue, field.type, fieldPrefix, result);
      }
    });
  }

  /**
   * Validar valor por defecto de merge field
   */
  validateDefaultValue(value, type, fieldPrefix, result) {
    switch (type) {
      case 'text':
        if (typeof value !== 'string') {
          result.errors.push(`${fieldPrefix}: defaultValue debe ser string para tipo text`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          result.errors.push(`${fieldPrefix}: defaultValue debe ser number para tipo number`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          result.errors.push(`${fieldPrefix}: defaultValue debe ser boolean para tipo boolean`);
        }
        break;

      case 'color':
        if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
          result.errors.push(`${fieldPrefix}: defaultValue debe ser un color hex válido (#rrggbb)`);
        }
        break;

      case 'image':
      case 'video':
      case 'audio':
        if (typeof value !== 'string') {
          result.errors.push(`${fieldPrefix}: defaultValue debe ser una URL válida para tipo ${type}`);
        }
        break;
    }
  }

  /**
   * Validar por tipo de template
   */
  validateByType(template, result) {
    switch (template.metadata.type) {
      case 'after-effects-template':
        this.validateAfterEffectsTemplate(template, result);
        break;

      case 'lottie-template':
        this.validateLottieTemplate(template, result);
        break;

      case 'json-template':
        this.validateJsonTemplate(template, result);
        break;

      default:
        result.warnings.push(`Tipo de template desconocido: ${template.metadata.type}`);
    }
  }

  /**
   * Validar template After Effects
   */
  validateAfterEffectsTemplate(template, result) {
    if (!template.metadata.originalPath) {
      result.warnings.push('Template AE sin ruta original especificada');
    }

    if (template.conversion && template.conversion.status === 'failed') {
      result.warnings.push('Template AE con conversión fallida');
    }

    if (!template.timeline && template.metadata.requiresConversion) {
      result.info.push('Template AE requiere conversión para ser utilizable');
    }
  }

  /**
   * Validar template Lottie
   */
  validateLottieTemplate(template, result) {
    if (template.animation) {
      if (template.animation.frameRate && template.animation.frameRate <= 0) {
        result.errors.push('Animation frameRate debe ser positivo');
      }

      if (template.animation.duration && template.animation.duration <= 0) {
        result.errors.push('Animation duration debe ser positiva');
      }
    }

    // Validar estructura Lottie básica
    if (!template.v) {
      result.warnings.push('Template Lottie sin versión especificada');
    }

    if (!template.layers || !Array.isArray(template.layers)) {
      result.errors.push('Template Lottie debe tener layers');
    }
  }

  /**
   * Validar template JSON
   */
  validateJsonTemplate(template, result) {
    if (!template.timeline) {
      result.errors.push('Template JSON debe tener timeline');
    }

    // Validar que tenga al menos un track
    if (template.timeline && (!template.timeline.tracks || template.timeline.tracks.length === 0)) {
      result.errors.push('Template JSON debe tener al menos un track');
    }
  }

  /**
   * Validación estricta adicional
   */
  performStrictValidation(template, result) {
    // Verificar consistencia de IDs
    this.validateIdConsistency(template, result);

    // Verificar solapamientos de clips
    this.validateClipOverlaps(template, result);

    // Verificar referencias de assets
    this.validateAssetReferences(template, result);

    // Verificar coherencia temporal
    this.validateTemporalCoherence(template, result);
  }

  /**
   * Validar consistencia de IDs
   */
  validateIdConsistency(template, result) {
    const usedIds = new Set();

    if (template.timeline?.tracks) {
      template.timeline.tracks.forEach((track, trackIndex) => {
        if (track.id) {
          if (usedIds.has(track.id)) {
            result.errors.push(`ID duplicado en track[${trackIndex}]: ${track.id}`);
          }
          usedIds.add(track.id);
        }

        if (track.clips) {
          track.clips.forEach((clip, clipIndex) => {
            if (clip.id) {
              if (usedIds.has(clip.id)) {
                result.errors.push(`ID duplicado en track[${trackIndex}].clips[${clipIndex}]: ${clip.id}`);
              }
              usedIds.add(clip.id);
            }
          });
        }
      });
    }
  }

  /**
   * Validar solapamientos de clips
   */
  validateClipOverlaps(template, result) {
    if (!template.timeline?.tracks) return;

    template.timeline.tracks.forEach((track, trackIndex) => {
      if (!track.clips) return;

      const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);

      for (let i = 0; i < sortedClips.length - 1; i++) {
        const currentClip = sortedClips[i];
        const nextClip = sortedClips[i + 1];

        const currentEnd = currentClip.start + currentClip.duration;
        
        if (currentEnd > nextClip.start) {
          const overlap = currentEnd - nextClip.start;
          result.warnings.push(
            `Solapamiento detectado en track[${trackIndex}]: clips se superponen por ${overlap}s`
          );
        }
      }
    });
  }

  /**
   * Validar referencias de assets
   */
  validateAssetReferences(template, result) {
    if (!template.timeline?.tracks) return;

    const referencedAssets = new Set();

    template.timeline.tracks.forEach((track, trackIndex) => {
      if (!track.clips) return;

      track.clips.forEach((clip, clipIndex) => {
        if (clip.src) {
          referencedAssets.add(clip.src);
          
          // Validar formato de URL/path
          if (typeof clip.src === 'string') {
            if (!clip.src.startsWith('http') && !clip.src.startsWith('/') && !clip.src.startsWith('./')) {
              result.warnings.push(
                `track[${trackIndex}].clips[${clipIndex}]: src podría no ser una URL/path válida`
              );
            }
          }
        }
      });
    });

    result.info.push(`Template referencia ${referencedAssets.size} assets únicos`);
  }

  /**
   * Validar coherencia temporal
   */
  validateTemporalCoherence(template, result) {
    if (!template.timeline?.tracks) return;

    let maxDuration = 0;

    template.timeline.tracks.forEach((track, trackIndex) => {
      if (!track.clips) return;

      track.clips.forEach((clip, clipIndex) => {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }

        // Validar que las animaciones no excedan la duración del clip
        if (clip.animations) {
          clip.animations.forEach((animation, animIndex) => {
            const animEnd = (animation.delay || 0) + (animation.duration || 0);
            if (animEnd > clip.duration) {
              result.warnings.push(
                `track[${trackIndex}].clips[${clipIndex}].animations[${animIndex}]: animación excede duración del clip`
              );
            }
          });
        }
      });
    });

    // Comparar con duración declarada del timeline
    if (template.timeline.duration && Math.abs(template.timeline.duration - maxDuration) > 0.1) {
      result.warnings.push(
        `Duración declarada (${template.timeline.duration}s) difiere de la calculada (${maxDuration}s)`
      );
    }

    result.info.push(`Duración total calculada: ${maxDuration}s`);
  }

  /**
   * Validar batch de templates
   */
  async validateBatch(templates, options = {}) {
    const correlationId = logger.generateCorrelationId();
    
    try {
      logger.info('🔍 Validando batch de templates', {
        count: templates.length,
        correlationId
      });

      const validationPromises = templates.map(template => 
        this.validateTemplate(template, { ...options, correlationId })
      );

      const results = await Promise.all(validationPromises);

      const summary = {
        total: templates.length,
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length,
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
        totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
        results
      };

      logger.info('✅ Validación batch completada', {
        correlationId,
        ...summary
      });

      return summary;

    } catch (error) {
      logger.error('❌ Error en validación batch', {
        correlationId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = TemplateValidator; 