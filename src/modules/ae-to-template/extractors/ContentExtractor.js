/**
 * Extractor de Contenido
 * Procesa y enriquece el contenido analizado
 */

const logger = require('../utils/logger');

class ContentExtractor {
  constructor() {
    this.stats = {
      totalExtractions: 0,
      successfulExtractions: 0
    };
  }

  /**
   * Extraer contenido detallado
   */
  async extract(analysisResult, options = {}) {
    const correlationId = options.correlationId;
    
    logger.info('🎭 Iniciando extracción de contenido', {
      correlationId,
      compositions: analysisResult.compositions?.length || 0,
      layers: analysisResult.layers?.length || 0
    });

    this.stats.totalExtractions++;

    try {
      const content = {
        compositions: analysisResult.compositions || [],
        layers: analysisResult.layers || [],
        animations: this.processAnimations(analysisResult.animations || [], options),
        effects: this.processEffects(analysisResult.effects || [], options),
        expressions: this.processExpressions(analysisResult.expressions || [], options),
        transitions: this.generateTransitions(analysisResult.layers || [], options),
        assets: analysisResult.assets || [],
        mergeFields: this.detectMergeFields(analysisResult, options),
        metadata: {
          extractionTime: new Date().toISOString(),
          correlationId,
          method: analysisResult.metadata?.method || 'unknown'
        }
      };

      this.stats.successfulExtractions++;

      logger.info('✅ Extracción de contenido completada', {
        correlationId,
        animations: content.animations.length,
        effects: content.effects.length,
        expressions: content.expressions.length,
        transitions: content.transitions.length,
        mergeFields: Object.keys(content.mergeFields).length
      });

      return content;

    } catch (error) {
      logger.error('❌ Error en extracción de contenido', {
        correlationId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Procesar animaciones
   */
  processAnimations(animations, options) {
    return animations.map(anim => ({
      ...anim,
      easing: this.normalizeEasing(anim.keyframes),
      category: this.categorizeAnimation(anim.property),
      complexity: this.calculateComplexity(anim.keyframes)
    }));
  }

  /**
   * Procesar efectos
   */
  processEffects(effects, options) {
    return effects.map(effect => ({
      ...effect,
      category: this.categorizeEffect(effect.type),
      intensity: this.calculateEffectIntensity(effect.properties),
      renderCost: this.estimateRenderCost(effect.type)
    }));
  }

  /**
   * Procesar expresiones
   */
  processExpressions(expressions, options) {
    return expressions.map(expr => ({
      ...expr,
      complexity: this.analyzeExpressionComplexity(expr.expression),
      dependencies: this.findExpressionDependencies(expr.expression),
      type: this.classifyExpression(expr.expression)
    }));
  }

  /**
   * Generar transiciones
   */
  generateTransitions(layers, options) {
    const transitions = [];
    
    layers.forEach((layer, index) => {
      if (index > 0) {
        const prevLayer = layers[index - 1];
        
        // Detectar solapamiento temporal
        if (this.hasTemporalOverlap(prevLayer, layer)) {
          transitions.push({
            id: this.generateId(),
            from: prevLayer.name,
            to: layer.name,
            type: 'crossfade',
            duration: this.calculateOverlapDuration(prevLayer, layer),
            startTime: Math.max(prevLayer.startTime, layer.startTime)
          });
        }
      }
    });

    return transitions;
  }

  /**
   * Detectar merge fields
   */
  detectMergeFields(analysisResult, options) {
    const mergeFields = {};
    
    // Buscar en capas de texto
    (analysisResult.layers || []).forEach(layer => {
      if (layer.type === 'text' && layer.textProperties?.text) {
        const text = layer.textProperties.text;
        const fields = this.extractMergeFieldsFromText(text);
        Object.assign(mergeFields, fields);
      }
    });

    // Buscar en expresiones
    (analysisResult.expressions || []).forEach(expr => {
      const fields = this.extractMergeFieldsFromText(expr.expression);
      Object.assign(mergeFields, fields);
    });

    return mergeFields;
  }

  /**
   * Extraer merge fields de texto
   */
  extractMergeFieldsFromText(text) {
    const fields = {};
    const patterns = [
      /\{\{([A-Z_]+)\}\}/g,
      /\$\{([A-Z_]+)\}/g,
      /%([A-Z_]+)%/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const fieldName = match[1];
        fields[fieldName] = {
          type: 'string',
          placeholder: `{{${fieldName}}}`,
          defaultValue: this.getDefaultValueForField(fieldName)
        };
      }
    });

    return fields;
  }

  /**
   * Utilidades
   */
  normalizeEasing(keyframes) {
    if (!keyframes || keyframes.length < 2) return 'linear';
    
    const hasEasing = keyframes.some(kf => kf.ease && kf.ease !== 'linear');
    return hasEasing ? 'custom' : 'linear';
  }

  categorizeAnimation(property) {
    if (property.includes('Position')) return 'movement';
    if (property.includes('Scale')) return 'scale';
    if (property.includes('Rotation')) return 'rotation';
    if (property.includes('Opacity')) return 'opacity';
    return 'other';
  }

  calculateComplexity(keyframes) {
    if (!keyframes) return 0;
    
    let complexity = keyframes.length;
    
    // Aumentar complejidad por easing
    keyframes.forEach(kf => {
      if (kf.ease && kf.ease !== 'linear') complexity += 2;
    });
    
    return Math.min(complexity, 10); // Máximo 10
  }

  categorizeEffect(type) {
    const categories = {
      'shadow': 'visual',
      'glow': 'visual',
      'blur': 'filter',
      'color': 'color',
      'transform': 'geometry'
    };
    
    return categories[type] || 'other';
  }

  calculateEffectIntensity(properties) {
    if (!properties) return 1;
    
    let intensity = 1;
    
    if (properties.opacity) intensity *= properties.opacity / 100;
    if (properties.distance) intensity += properties.distance / 10;
    if (properties.softness) intensity += properties.softness / 5;
    
    return Math.max(0.1, Math.min(intensity, 3));
  }

  estimateRenderCost(type) {
    const costs = {
      'shadow': 2,
      'glow': 3,
      'blur': 4,
      'color': 1,
      'transform': 1
    };
    
    return costs[type] || 2;
  }

  analyzeExpressionComplexity(expression) {
    if (!expression) return 0;
    
    let complexity = 0;
    
    // Contar funciones
    const functionCount = (expression.match(/\w+\(/g) || []).length;
    complexity += functionCount * 2;
    
    // Contar operadores
    const operatorCount = (expression.match(/[+\-*/]/g) || []).length;
    complexity += operatorCount;
    
    // Contar referencias a propiedades
    const propertyRefs = (expression.match(/thisLayer\.|thisComp\./g) || []).length;
    complexity += propertyRefs;
    
    return Math.min(complexity, 10);
  }

  findExpressionDependencies(expression) {
    const dependencies = [];
    
    if (!expression) return dependencies;
    
    // Buscar referencias a otras capas
    const layerRefs = expression.match(/comp\(".*?"\)\.layer\(".*?"\)/g) || [];
    layerRefs.forEach(ref => {
      const match = ref.match(/layer\("(.*?)"\)/);
      if (match) dependencies.push(match[1]);
    });
    
    return dependencies;
  }

  classifyExpression(expression) {
    if (!expression) return 'unknown';
    
    if (expression.includes('wiggle')) return 'animation';
    if (expression.includes('time')) return 'time-based';
    if (expression.includes('random')) return 'random';
    if (expression.includes('Math.')) return 'mathematical';
    
    return 'custom';
  }

  hasTemporalOverlap(layer1, layer2) {
    const start1 = layer1.startTime || 0;
    const end1 = start1 + (layer1.duration || 0);
    const start2 = layer2.startTime || 0;
    const end2 = start2 + (layer2.duration || 0);
    
    return start1 < end2 && start2 < end1;
  }

  calculateOverlapDuration(layer1, layer2) {
    const start1 = layer1.startTime || 0;
    const end1 = start1 + (layer1.duration || 0);
    const start2 = layer2.startTime || 0;
    const end2 = start2 + (layer2.duration || 0);
    
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);
    
    return Math.max(0, overlapEnd - overlapStart);
  }

  getDefaultValueForField(fieldName) {
    const defaults = {
      'COMPANY_NAME': 'Your Company',
      'TAGLINE': 'Your Tagline',
      'TITLE': 'Title Text',
      'SUBTITLE': 'Subtitle Text',
      'DESCRIPTION': 'Description text here',
      'LOGO_URL': 'https://via.placeholder.com/200x200',
      'BACKGROUND_COLOR': '#1a1a2e',
      'TEXT_COLOR': '#ffffff',
      'ACCENT_COLOR': '#4287f5'
    };
    
    return defaults[fieldName] || 'Default Value';
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = ContentExtractor; 