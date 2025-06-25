/**
 * Validador especializado para composiciones de After Effects
 * Responsabilidad única: validación y normalización de composiciones
 */

const { getConfig } = require('../../config/aeParserConfig');
const { validateComposition } = require('../../utils/aeErrorHandler');
const { normalizeColor } = require('../../utils/aeColorUtils');
const logger = require('../../utils/logger');

class AECompositionValidator {
  constructor() {
    this.config = getConfig();
  }

  /**
   * Validar y normalizar una composición
   */
  validateAndNormalizeComposition(composition, correlationId) {
    try {
      // Validación básica
      const validation = validateComposition(composition);
      
      if (!validation.isValid) {
        logger.warn('Composition validation failed', {
          errors: validation.errors.map(e => e.message),
          correlationId
        });
        
        // Crear composición por defecto si la validación falla
        return this.createDefaultComposition();
      }

      // Normalizar la composición válida
      const normalized = this.normalizeComposition(composition);
      
      // Log de warnings si los hay
      if (validation.warnings && validation.warnings.length > 0) {
        logger.warn('Composition validation warnings', {
          warnings: validation.warnings,
          correlationId
        });
      }

      return normalized;
    } catch (error) {
      logger.error('Error validating composition', {
        error: error.message,
        correlationId
      });
      
      return this.createDefaultComposition();
    }
  }

  /**
   * Normalizar composición aplicando valores por defecto
   */
  normalizeComposition(composition) {
    const defaults = this.config.defaults.composition;
    
    return {
      id: composition.id || this.generateId(),
      name: composition.name || 'Untitled Composition',
      width: this.normalizeNumber(composition.width, defaults.width, 1, 7680),
      height: this.normalizeNumber(composition.height, defaults.height, 1, 4320),
      frameRate: this.normalizeNumber(composition.frameRate, defaults.frameRate, 1, 120),
      duration: this.normalizeNumber(composition.duration, defaults.duration, 0.1, 3600),
      bgColor: this.normalizeBackgroundColor(composition.bgColor || composition.backgroundColor),
      pixelAspect: composition.pixelAspect || 1,
      workAreaStart: composition.workAreaStart || 0,
      workAreaDuration: composition.workAreaDuration || composition.duration || defaults.duration,
      layers: composition.layers || [],
      markers: composition.markers || [],
      motionBlur: composition.motionBlur || false,
      threedLayer: composition.threedLayer || false,
      frameBlending: composition.frameBlending || false
    };
  }

  /**
   * Validar múltiples composiciones
   */
  validateCompositions(compositions, correlationId) {
    if (!Array.isArray(compositions)) {
      logger.warn('Compositions is not an array, creating default', { correlationId });
      return [this.createDefaultComposition()];
    }

    if (compositions.length === 0) {
      logger.warn('No compositions found, creating default', { correlationId });
      return [this.createDefaultComposition()];
    }

    const validatedCompositions = [];
    const errors = [];

    for (let i = 0; i < compositions.length; i++) {
      try {
        const validated = this.validateAndNormalizeComposition(compositions[i], correlationId);
        validatedCompositions.push(validated);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
          composition: compositions[i]
        });
        
        logger.error('Failed to validate composition at index', {
          index: i,
          error: error.message,
          correlationId
        });
      }
    }

    // Si todas las composiciones fallaron, crear una por defecto
    if (validatedCompositions.length === 0) {
      logger.warn('All compositions failed validation, creating default', {
        totalErrors: errors.length,
        correlationId
      });
      validatedCompositions.push(this.createDefaultComposition());
    }

    return validatedCompositions;
  }

  /**
   * Normalizar número con límites
   */
  normalizeNumber(value, defaultValue, min, max) {
    if (typeof value !== 'number' || isNaN(value)) {
      return defaultValue;
    }
    
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Normalizar color de fondo
   */
  normalizeBackgroundColor(bgColor) {
    const normalized = normalizeColor(bgColor);
    return normalized || this.config.defaults.composition.backgroundColor;
  }

  /**
   * Crear composición por defecto
   */
  createDefaultComposition() {
    const defaults = this.config.defaults.composition;
    
    return {
      id: this.generateId(),
      name: 'Main Composition',
      width: defaults.width,
      height: defaults.height,
      frameRate: defaults.frameRate,
      duration: defaults.duration,
      bgColor: defaults.backgroundColor,
      pixelAspect: 1,
      workAreaStart: 0,
      workAreaDuration: defaults.duration,
      layers: [],
      markers: [],
      motionBlur: false,
      threedLayer: false,
      frameBlending: false
    };
  }

  /**
   * Validar propiedades específicas de composición
   */
  validateCompositionProperties(composition) {
    const issues = [];

    // Validar resolución
    if (composition.width * composition.height > 33177600) { // 8K
      issues.push({
        type: 'warning',
        message: 'Very high resolution composition may cause performance issues',
        property: 'resolution',
        value: `${composition.width}x${composition.height}`
      });
    }

    // Validar frame rate
    const commonFrameRates = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
    if (!commonFrameRates.includes(composition.frameRate)) {
      issues.push({
        type: 'warning',
        message: 'Uncommon frame rate detected',
        property: 'frameRate',
        value: composition.frameRate
      });
    }

    // Validar duración
    if (composition.duration > 3600) { // 1 hora
      issues.push({
        type: 'warning',
        message: 'Very long composition duration',
        property: 'duration',
        value: composition.duration
      });
    }

    // Validar pixel aspect ratio
    if (composition.pixelAspect !== 1) {
      issues.push({
        type: 'info',
        message: 'Non-square pixel aspect ratio',
        property: 'pixelAspect',
        value: composition.pixelAspect
      });
    }

    return issues;
  }

  /**
   * Obtener estadísticas de composición
   */
  getCompositionStats(composition) {
    return {
      id: composition.id,
      name: composition.name,
      resolution: `${composition.width}x${composition.height}`,
      frameRate: composition.frameRate,
      duration: composition.duration,
      aspectRatio: (composition.width / composition.height).toFixed(2),
      totalFrames: Math.round(composition.duration * composition.frameRate),
      layerCount: composition.layers ? composition.layers.length : 0,
      markerCount: composition.markers ? composition.markers.length : 0,
      has3D: composition.threedLayer,
      hasMotionBlur: composition.motionBlur
    };
  }

  /**
   * Generar ID único
   */
  generateId() {
    return 'comp_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Comparar dos composiciones
   */
  compareCompositions(comp1, comp2) {
    const differences = [];

    const properties = ['width', 'height', 'frameRate', 'duration', 'bgColor'];
    
    properties.forEach(prop => {
      if (comp1[prop] !== comp2[prop]) {
        differences.push({
          property: prop,
          value1: comp1[prop],
          value2: comp2[prop]
        });
      }
    });

    return {
      identical: differences.length === 0,
      differences
    };
  }
}

module.exports = AECompositionValidator; 