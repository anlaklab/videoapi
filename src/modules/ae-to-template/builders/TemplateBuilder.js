/**
 * Template Builder - Constructor de Templates JSON
 * Convierte análisis de After Effects en templates estructurados
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class TemplateBuilder {
  constructor() {
    this.stats = {
      totalBuilds: 0,
      successfulBuilds: 0,
      averageBuildTime: 0
    };
  }

  /**
   * Construir template desde análisis de contenido
   */
  async build(contentData, options = {}) {
    const startTime = Date.now();
    const correlationId = options.correlationId;
    
    this.stats.totalBuilds++;
    
    logger.info('🏗️ Iniciando construcción de template', {
      correlationId,
      layers: contentData.layers?.length || 0,
      animations: contentData.animations?.length || 0,
      effects: contentData.effects?.length || 0
    });

    try {
      const template = {
        metadata: this.buildMetadata(contentData, options),
        timeline: this.buildTimeline(contentData, options),
        mergeFields: this.buildMergeFields(contentData, options),
        stats: this.buildStats(contentData)
      };

      const buildTime = Date.now() - startTime;
      this.updateStats(buildTime, true);

      logger.info('✅ Template construido exitosamente', {
        correlationId,
        templateId: template.metadata.id,
        tracksCount: template.timeline.tracks.length,
        clipsCount: template.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0),
        buildTime
      });

      return template;

    } catch (error) {
      const buildTime = Date.now() - startTime;
      this.updateStats(buildTime, false);

      logger.error('❌ Error construyendo template', {
        correlationId,
        error: error.message,
        buildTime
      });

      throw error;
    }
  }

  /**
   * Construir metadata del template
   */
  buildMetadata(contentData, options) {
    return {
      id: uuidv4(),
      name: options.filename || 'Generated Template',
      description: 'Template generado desde After Effects',
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      source: 'after-effects',
      complexity: this.calculateComplexity(contentData),
      optimized: false,
      sourceFile: options.sourceFile || 'unknown.aep',
      analysisDepth: options.analysisDepth || 'basic',
      extractedAssets: options.extractAssets || false,
      generatedAt: new Date().toISOString(),
      fileSize: options.fileSize || 0
    };
  }

  /**
   * Construir timeline con tracks y clips
   */
  buildTimeline(contentData, options) {
    const timeline = {
      tracks: [],
      background: this.extractBackground(contentData),
      duration: this.calculateDuration(contentData),
      fps: this.extractFPS(contentData)
    };

    // Crear track principal
    const mainTrack = {
      clips: []
    };

    // Procesar capas y convertir a clips
    if (contentData.layers && Array.isArray(contentData.layers)) {
      contentData.layers.forEach(layer => {
        const clips = this.layerToClips(layer, contentData);
        mainTrack.clips.push(...clips);
      });
    }

    // Ordenar clips por tiempo de inicio
    mainTrack.clips.sort((a, b) => a.start - b.start);

    timeline.tracks.push(mainTrack);
    return timeline;
  }

  /**
   * Convertir capa a clips con TODA la información tipográfica
   */
  layerToClips(layer, contentData) {
    const clips = [];

    // CLIP DE BACKGROUND
    if (layer.type === 'background' || (layer.shapeProperties && layer.name.toLowerCase().includes('background'))) {
      clips.push({
        type: 'background',
        start: layer.startTime || 0,
        duration: layer.duration || 10,
        position: {
          x: (layer.transform?.position?.[0]) || 960,
          y: (layer.transform?.position?.[1]) || 540
        },
        opacity: layer.transform?.opacity || 100,
        scale: this.extractScale(layer.transform?.scale),
        color: this.extractBackgroundColor(layer)
      });
    }

    // CLIP DE TEXTO CON TIPOGRAFÍA COMPLETA
    if (layer.type === 'text') {
      const textClip = {
        type: 'text',
        start: layer.startTime || 0,
        duration: layer.duration || 8,
        position: {
          x: (layer.transform?.position?.[0]) || 960,
          y: (layer.transform?.position?.[1]) || 540
        },
        opacity: layer.transform?.opacity || 100,
        scale: this.extractScale(layer.transform?.scale),
        text: this.extractText(layer),
        style: this.extractTextStyle(layer)
      };

      // Agregar efectos de texto si existen
      const textEffects = this.findLayerEffects(layer.name, contentData.effects || []);
      if (textEffects.length > 0) {
        textClip.effects = textEffects.map(effect => ({
          type: effect.type,
          name: effect.name,
          enabled: effect.enabled,
          properties: effect.properties
        }));
      }

      clips.push(textClip);
    }

    // CLIP DE FORMA
    if (layer.type === 'shape') {
      clips.push({
        type: 'shape',
        start: layer.startTime || 0,
        duration: layer.duration || 10,
        position: {
          x: (layer.transform?.position?.[0]) || 960,
          y: (layer.transform?.position?.[1]) || 540
        },
        opacity: layer.transform?.opacity || 100,
        scale: this.extractScale(layer.transform?.scale),
        shape: this.extractShape(layer)
      });
    }

    return clips;
  }

  /**
   * Extraer texto con manejo de merge fields
   */
  extractText(layer) {
    if (layer.textProperties?.text) {
      const text = layer.textProperties.text;
      
      // Detectar patrones de merge fields
      if (this.containsMergeFields(text)) {
        return text; // Mantener placeholders
      }
      
      // Convertir texto estático a merge field si parece genérico
      if (this.isGenericText(text)) {
        const fieldName = this.textToFieldName(text);
        return `{{${fieldName}}}`;
      }
      
      return text;
    }
    
    // Fallback basado en nombre de capa
    if (layer.name) {
      const fieldName = this.layerNameToFieldName(layer.name);
      return `{{${fieldName}}}`;
    }
    
    return 'Texto por defecto';
  }

  /**
   * Extraer estilo de texto COMPLETO
   */
  extractTextStyle(layer) {
    const defaultStyle = {
      fontSize: 72,
      fontFamily: 'Arial',
      fontStyle: 'Regular',
      color: '#ffffff',
      alignment: 'center',
      tracking: 0,
      leading: 0,
      strokeColor: null,
      strokeWidth: 0
    };

    if (layer.textProperties) {
      const props = layer.textProperties;
      
      return {
        fontSize: props.fontSize || defaultStyle.fontSize,
        fontFamily: props.fontFamily || defaultStyle.fontFamily,
        fontStyle: props.fontStyle || defaultStyle.fontStyle,
        color: this.rgbToHex(props.color || props.fillColor) || defaultStyle.color,
        alignment: this.normalizeAlignment(props.alignment || props.justification),
        tracking: props.tracking || defaultStyle.tracking,
        leading: props.leading || defaultStyle.leading,
        strokeColor: props.strokeColor ? this.rgbToHex(props.strokeColor) : null,
        strokeWidth: props.strokeWidth || 0,
        fontWeight: this.extractFontWeight(props.fontStyle),
        textDecoration: 'none',
        textTransform: 'none'
      };
    }

    return defaultStyle;
  }

  /**
   * Construir merge fields detectados
   */
  buildMergeFields(contentData, options) {
    const mergeFields = {};

    // Buscar en capas de texto
    if (contentData.layers) {
      contentData.layers.forEach(layer => {
        if (layer.type === 'text') {
          const text = this.extractText(layer);
          const fields = this.extractMergeFieldsFromText(text);
          Object.assign(mergeFields, fields);
        }
      });
    }

    // Agregar campos detectados automáticamente
    Object.assign(mergeFields, contentData.mergeFields || {});

    return mergeFields;
  }

  /**
   * Utilidades de conversión
   */
  rgbToHex(rgb) {
    if (!rgb || !Array.isArray(rgb)) return '#ffffff';
    
    const r = Math.round(rgb[0]).toString(16).padStart(2, '0');
    const g = Math.round(rgb[1]).toString(16).padStart(2, '0');
    const b = Math.round(rgb[2]).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }

  extractScale(scaleArray) {
    if (!scaleArray || !Array.isArray(scaleArray)) return 1;
    return scaleArray[0] / 100; // Convertir porcentaje a factor
  }

  extractBackgroundColor(layer) {
    if (layer.shapeProperties?.fillColor) {
      return this.rgbToHex(layer.shapeProperties.fillColor);
    }
    return '#1a1a1a';
  }

  extractShape(layer) {
    return {
      type: layer.shapeProperties?.type || 'rectangle',
      fillColor: this.rgbToHex(layer.shapeProperties?.fillColor),
      strokeColor: this.rgbToHex(layer.shapeProperties?.strokeColor),
      strokeWidth: layer.shapeProperties?.strokeWidth || 0,
      cornerRadius: layer.shapeProperties?.cornerRadius || 0
    };
  }

  containsMergeFields(text) {
    return /\{\{.*?\}\}|\$\{.*?\}|%.*?%/.test(text);
  }

  isGenericText(text) {
    const genericPatterns = [
      'titulo', 'title', 'heading',
      'subtitulo', 'subtitle', 'subheading',
      'texto', 'text', 'content',
      'company', 'empresa', 'brand'
    ];
    
    const lowerText = text.toLowerCase();
    return genericPatterns.some(pattern => lowerText.includes(pattern));
  }

  textToFieldName(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  layerNameToFieldName(layerName) {
    const cleaned = layerName.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // Mapear nombres comunes
    const mappings = {
      'title': 'titulo',
      'subtitle': 'subtitulo',
      'text': 'texto',
      'company': 'empresa'
    };
    
    return mappings[cleaned] || cleaned;
  }

  normalizeAlignment(alignment) {
    const mappings = {
      'left': 'left',
      'center': 'center',
      'right': 'right',
      'justify': 'justify',
      '0': 'left',
      '1': 'center',
      '2': 'right'
    };
    
    return mappings[String(alignment).toLowerCase()] || 'center';
  }

  extractFontWeight(fontStyle) {
    if (!fontStyle) return 'normal';
    
    const style = fontStyle.toLowerCase();
    if (style.includes('bold')) return 'bold';
    if (style.includes('light')) return 'light';
    if (style.includes('medium')) return 'medium';
    
    return 'normal';
  }

  extractMergeFieldsFromText(text) {
    const fields = {};
    const patterns = [
      /\{\{([^}]+)\}\}/g,
      /\$\{([^}]+)\}/g,
      /%([^%]+)%/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const fieldName = match[1].trim();
        fields[fieldName] = {
          type: 'text',
          defaultValue: this.getDefaultForField(fieldName),
          description: `Campo ${fieldName} detectado automáticamente`,
          validation: {
            required: false,
            maxLength: 100
          }
        };
      }
    });

    return fields;
  }

  getDefaultForField(fieldName) {
    const defaults = {
      'titulo': 'Título Principal',
      'subtitulo': 'Subtítulo',
      'empresa': 'Nombre de Empresa',
      'texto': 'Texto de ejemplo',
      'title': 'Main Title',
      'subtitle': 'Subtitle'
    };
    
    return defaults[fieldName.toLowerCase()] || 'Valor por defecto';
  }

  calculateComplexity(contentData) {
    let complexity = 'low';
    
    const layerCount = contentData.layers?.length || 0;
    const animationCount = contentData.animations?.length || 0;
    const effectCount = contentData.effects?.length || 0;
    
    if (layerCount > 10 || animationCount > 5 || effectCount > 3) {
      complexity = 'high';
    } else if (layerCount > 5 || animationCount > 2 || effectCount > 1) {
      complexity = 'medium';
    }
    
    return complexity;
  }

  calculateDuration(contentData) {
    let maxDuration = 10;
    
    if (contentData.layers) {
      contentData.layers.forEach(layer => {
        const layerEnd = (layer.startTime || 0) + (layer.duration || 0);
        if (layerEnd > maxDuration) {
          maxDuration = layerEnd;
        }
      });
    }
    
    return maxDuration;
  }

  extractBackground(contentData) {
    // Buscar capa de background
    const bgLayer = contentData.layers?.find(layer => 
      layer.type === 'background' || 
      layer.name?.toLowerCase().includes('background') ||
      layer.name?.toLowerCase().includes('fondo')
    );
    
    if (bgLayer) {
      return {
        color: this.extractBackgroundColor(bgLayer),
        type: 'solid'
      };
    }
    
    return { color: '#000000', type: 'solid' };
  }

  extractFPS(contentData) {
    return contentData.compositions?.[0]?.frameRate || 30;
  }

  findLayerEffects(layerName, effects) {
    return effects.filter(effect => effect.layer === layerName);
  }

  buildStats(contentData) {
    return {
      totalLayers: contentData.layers?.length || 0,
      totalKeyframes: contentData.keyframes?.length || 0,
      totalEffects: contentData.effects?.length || 0,
      totalExpressions: contentData.expressions?.length || 0,
      estimatedRenderTime: this.estimateRenderTime(contentData)
    };
  }

  estimateRenderTime(contentData) {
    const baseTime = 10; // segundos base
    const layerMultiplier = (contentData.layers?.length || 0) * 2;
    const effectMultiplier = (contentData.effects?.length || 0) * 5;
    const animationMultiplier = (contentData.animations?.length || 0) * 3;
    
    return baseTime + layerMultiplier + effectMultiplier + animationMultiplier;
  }

  updateStats(buildTime, success) {
    if (success) {
      this.stats.successfulBuilds++;
    }
    
    this.stats.averageBuildTime = (this.stats.averageBuildTime + buildTime) / 2;
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = TemplateBuilder;
