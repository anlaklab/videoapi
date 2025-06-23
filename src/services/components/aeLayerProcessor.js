const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

/**
 * AELayerProcessor - Procesa capas individuales de After Effects
 * 
 * Responsabilidades:
 * - Convertir capas de AE a clips de nuestro formato
 * - Manejar propiedades específicas de cada tipo de capa
 * - Procesar animaciones y efectos
 */
class AELayerProcessor {
  constructor() {
    // Mapeo de tipos de capa de After Effects a nuestro formato
    this.layerTypeMapping = {
      'AVLayer': 'video',           // Video/Image layers
      'TextLayer': 'text',          // Text layers
      'ShapeLayer': 'shape',        // Shape layers
      'SolidLayer': 'background',   // Solid color layers
      'CameraLayer': 'camera',      // Camera layers
      'LightLayer': 'light',        // Light layers
      'NullLayer': 'null'           // Null/Control layers
    };

    // Efectos comunes de After Effects y su mapeo
    this.effectMapping = {
      'Scale': 'scale',
      'Position': 'position',
      'Rotation': 'rotation',
      'Opacity': 'opacity',
      'Drop Shadow': 'dropShadow',
      'Glow': 'glow',
      'Color Correction': 'colorCorrection',
      'Blur & Sharpen': 'blur'
    };
  }

  /**
   * Convierte una capa de AE a un clip de nuestro formato
   */
  convertLayerToClip(layer) {
    const clip = {
      id: uuidv4(),
      name: layer.name,
      type: this.layerTypeMapping[layer.type] || 'unknown',
      start: layer.startTime || 0,
      duration: layer.duration || 10
    };

    // Aplicar propiedades específicas según el tipo
    this.applyTypeSpecificProperties(clip, layer);
    
    // Aplicar propiedades comunes
    this.applyCommonProperties(clip, layer);
    
    // Aplicar animaciones
    this.applyAnimations(clip, layer);
    
    // Aplicar efectos
    this.applyEffects(clip, layer);

    return clip;
  }

  /**
   * Aplica propiedades específicas según el tipo de capa
   */
  applyTypeSpecificProperties(clip, layer) {
    switch (clip.type) {
      case 'text':
        this.applyTextProperties(clip, layer);
        break;
        
      case 'video':
      case 'image':
        this.applyMediaProperties(clip, layer);
        break;
        
      case 'background':
        this.applyBackgroundProperties(clip, layer);
        break;
        
      case 'shape':
        this.applyShapeProperties(clip, layer);
        break;
    }
  }

  /**
   * Aplica propiedades de texto
   */
  applyTextProperties(clip, layer) {
    clip.text = layer.text || '{{TEXT}}';
    clip.fontSize = layer.fontSize || 48;
    clip.color = layer.color || '#FFFFFF';
    clip.fontFamily = layer.fontFamily || 'Arial';
    
    // Propiedades avanzadas de texto
    if (layer.textStyle) {
      clip.fontWeight = layer.textStyle.fontWeight || 'normal';
      clip.fontStyle = layer.textStyle.fontStyle || 'normal';
      clip.textAlign = layer.textStyle.textAlign || 'center';
      clip.lineHeight = layer.textStyle.lineHeight || 1.2;
    }
  }

  /**
   * Aplica propiedades de medios (video/imagen)
   */
  applyMediaProperties(clip, layer) {
    clip.src = layer.source || '';
    
    if (layer.scale) {
      clip.scale = layer.scale.x / 100; // Convertir de porcentaje
    }
    
    // Propiedades de recorte
    if (layer.crop) {
      clip.crop = {
        x: layer.crop.x || 0,
        y: layer.crop.y || 0,
        width: layer.crop.width || 1,
        height: layer.crop.height || 1
      };
    }
    
    // Opacidad
    if (layer.opacity !== undefined) {
      clip.opacity = layer.opacity / 100;
    }
  }

  /**
   * Aplica propiedades de fondo
   */
  applyBackgroundProperties(clip, layer) {
    clip.color = layer.color || '#000000';
    
    // Gradiente
    if (layer.gradient) {
      clip.gradient = {
        type: layer.gradient.type || 'linear',
        colors: layer.gradient.colors || [clip.color, '#FFFFFF'],
        direction: layer.gradient.direction || 'horizontal'
      };
    }
  }

  /**
   * Aplica propiedades de formas
   */
  applyShapeProperties(clip, layer) {
    clip.shape = {
      type: layer.shapeType || 'rectangle',
      fill: layer.fill || '#FFFFFF',
      stroke: layer.stroke || '#000000',
      strokeWidth: layer.strokeWidth || 1
    };
  }

  /**
   * Aplica propiedades comunes a todas las capas
   */
  applyCommonProperties(clip, layer) {
    // Posición
    if (layer.position) {
      clip.position = {
        x: layer.position.x || 0,
        y: layer.position.y || 0
      };
    }

    // Rotación
    if (layer.rotation !== undefined) {
      clip.rotation = layer.rotation;
    }

    // Punto de anclaje
    if (layer.anchorPoint) {
      clip.anchorPoint = {
        x: layer.anchorPoint.x || 0.5,
        y: layer.anchorPoint.y || 0.5
      };
    }

    // Blend mode
    if (layer.blendMode) {
      clip.blendMode = layer.blendMode;
    }
  }

  /**
   * Aplica animaciones
   */
  applyAnimations(clip, layer) {
    if (layer.animations && layer.animations.length > 0) {
      clip.animations = layer.animations.map(animation => ({
        type: animation.type || animation,
        duration: animation.duration || 1,
        easing: animation.easing || 'ease-in-out',
        delay: animation.delay || 0,
        direction: animation.direction || 'normal',
        iterations: animation.iterations || 1
      }));

      // Por compatibilidad, mantener la propiedad animation simple
      clip.animation = clip.animations[0];
    }
  }

  /**
   * Aplica efectos
   */
  applyEffects(clip, layer) {
    if (layer.effects && layer.effects.length > 0) {
      clip.effects = layer.effects.map(effect => {
        if (typeof effect === 'string') {
          return {
            type: this.effectMapping[effect] || effect.toLowerCase(),
            strength: 1
          };
        }
        
        return {
          type: this.effectMapping[effect.type] || effect.type.toLowerCase(),
          strength: effect.strength || 1,
          properties: effect.properties || {}
        };
      });
    }
  }

  /**
   * Agrupa capas por tipo
   */
  groupLayersByType(layers) {
    const grouped = {};
    
    for (const layer of layers) {
      const mappedType = this.layerTypeMapping[layer.type] || 'unknown';
      
      if (!grouped[mappedType]) {
        grouped[mappedType] = [];
      }
      
      grouped[mappedType].push(layer);
    }
    
    return grouped;
  }

  /**
   * Ordena capas por orden Z (de atrás hacia adelante)
   */
  sortLayersByZOrder(layers) {
    return layers.sort((a, b) => {
      const aZ = a.zOrder || a.index || 0;
      const bZ = b.zOrder || b.index || 0;
      return aZ - bZ;
    });
  }

  /**
   * Valida una capa antes de procesarla
   */
  validateLayer(layer) {
    const errors = [];

    if (!layer.name) {
      errors.push('Layer name is required');
    }

    if (!layer.type) {
      errors.push('Layer type is required');
    }

    if (layer.type === 'text' && !layer.text) {
      errors.push('Text layers must have text content');
    }

    if (['video', 'image'].includes(this.layerTypeMapping[layer.type]) && !layer.source) {
      errors.push('Media layers must have a source');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AELayerProcessor; 