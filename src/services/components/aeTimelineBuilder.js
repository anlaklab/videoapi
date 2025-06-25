const logger = require('../../utils/logger');
const AELayerProcessor = require('./aeLayerProcessor');

/**
 * AETimelineBuilder - Construye timelines desde composiciones de After Effects
 * 
 * Responsabilidades:
 * - Convertir composiciones de AE a timelines
 * - Organizar capas en tracks
 * - Manejar timing y sincronización
 * - Optimizar la estructura del timeline
 */
class AETimelineBuilder {
  constructor() {
    this.layerProcessor = new AELayerProcessor();
  }

  /**
   * Convierte una composición de AE a nuestro formato de timeline
   */
  buildTimelineFromComposition(composition) {
    logger.info(`🏗️ Construyendo timeline desde composición: ${composition?.name || 'Unknown'}`);
    
    // Validar composición con valores por defecto
    const validatedComposition = this.validateAndNormalizeComposition(composition);
    
    // Si la composición tiene capas reales, procesarlas
    const realLayers = validatedComposition.realLayers || [];
    
    if (realLayers.length > 0) {
      logger.info(`🎭 Procesando ${realLayers.length} capas reales extraídas`);
      
      // Procesar capas reales
      const tracks = this.createTracksFromRealLayers(realLayers);
      
      // Crear timeline con tracks reales
      const timeline = {
        tracks: tracks,
        duration: validatedComposition.duration || 10,
        resolution: {
          width: validatedComposition.width || 1920,
          height: validatedComposition.height || 1080
        },
        frameRate: validatedComposition.frameRate || 24,
        background: {
          color: this.convertBgColorToHex(validatedComposition.bgColor) || '#000000'
        }
      };
      
      logger.info(`✅ Timeline construido con ${tracks.length} tracks reales`);
      return timeline;
    }
    
    // Fallback para composiciones sin capas reales
    logger.info('⚠️ No hay capas reales, usando proceso estándar');
    
    // Procesar capas estándar (el código original)
    const processedLayers = this.preprocessLayers(validatedComposition.layers);
    const layersByType = this.layerProcessor.groupLayersByType(processedLayers);
    const tracks = this.createTracksFromLayers(layersByType);
    const optimizedTracks = this.optimizeTimeline(tracks);

    const timeline = {
      tracks: optimizedTracks,
      duration: this.calculateTimelineDuration(optimizedTracks),
      resolution: {
        width: validatedComposition.width || 1920,
        height: validatedComposition.height || 1080
      },
      frameRate: validatedComposition.frameRate || 24,
      background: {
        color: this.convertBgColorToHex(validatedComposition.bgColor) || '#000000'
      }
    };

    logger.info(`✅ Timeline construido con ${optimizedTracks.length} tracks`);
    return timeline;
  }

  /**
   * Valida y normaliza una composición antes de procesarla
   */
  validateAndNormalizeComposition(composition) {
    if (!composition) {
      throw new Error('Composition is required');
    }

    // Crear composición normalizada con valores por defecto
    const normalized = {
      name: composition.name || 'Unknown Composition',
      duration: composition.duration || 10,
      width: composition.width || 1920,
      height: composition.height || 1080,
      frameRate: composition.frameRate || 30,
      layers: composition.layers || [],
      bgColor: composition.bgColor || [0, 0, 0],
      backgroundColor: composition.backgroundColor || '#000000'
    };

    // Validaciones básicas
    if (normalized.duration <= 0) {
      logger.warn(`Duración inválida (${normalized.duration}), usando 10 segundos por defecto`);
      normalized.duration = 10;
    }

    if (!Array.isArray(normalized.layers)) {
      logger.warn('Layers no es un array, creando array vacío');
      normalized.layers = [];
    }

    logger.info(`Composición normalizada: ${normalized.name} (${normalized.layers.length} capas)`);
    return normalized;
  }

  /**
   * Valida una composición antes de procesarla (método legacy)
   */
  validateComposition(composition) {
    if (!composition || !composition.name) {
      throw new Error('Composition must have a name');
    }
    
    if (!composition.layers || !Array.isArray(composition.layers)) {
      throw new Error('Composition must have layers array');
    }
    
    if (!composition.duration || composition.duration <= 0) {
      throw new Error('Composition duration must be positive');
    }
  }

  /**
   * Preprocesa las capas antes de agruparlas
   */
  preprocessLayers(layers) {
    return layers
      .filter(layer => this.shouldIncludeLayer(layer))
      .map(layer => this.preprocessLayer(layer))
      .sort((a, b) => (a.index || 0) - (b.index || 0));
  }

  /**
   * Determina si una capa debe incluirse en el timeline
   */
  shouldIncludeLayer(layer) {
    // Excluir capas deshabilitadas
    if (layer.enabled === false) {
      return false;
    }
    
    // Excluir capas de guía
    if (layer.isGuide) {
      return false;
    }
    
    // Excluir capas sin contenido
    if (layer.type === 'TextLayer' && !layer.text) {
      return false;
    }
    
    return true;
  }

  /**
   * Preprocesa una capa individual
   */
  preprocessLayer(layer) {
    // Normalizar timing
    layer.startTime = Math.max(0, layer.startTime || 0);
    layer.duration = Math.max(0.1, layer.duration || 1);
    
    // Normalizar posición
    if (!layer.position) {
      layer.position = { x: 960, y: 540 }; // Centro por defecto
    }
    
    // Normalizar escala
    if (!layer.scale) {
      layer.scale = { x: 100, y: 100 };
    }
    
    return layer;
  }

  /**
   * Crea tracks desde capas agrupadas
   */
  createTracksFromLayers(layersByType) {
    const tracks = [];
    let trackIndex = 0;
    
    // Orden específico para tracks
    const trackOrder = ['background', 'video', 'image', 'shape', 'text', 'null'];
    
    for (const trackType of trackOrder) {
      if (layersByType[trackType] && layersByType[trackType].length > 0) {
        const track = this.createTrack(trackType, layersByType[trackType], trackIndex);
        tracks.push(track);
        trackIndex++;
      }
    }
    
    // Agregar tipos no estándar
    for (const [layerType, layers] of Object.entries(layersByType)) {
      if (!trackOrder.includes(layerType) && layers.length > 0) {
        const track = this.createTrack(layerType, layers, trackIndex);
        tracks.push(track);
        trackIndex++;
      }
    }
    
    return tracks;
  }

  /**
   * Crea un track individual
   */
  createTrack(trackType, layers, trackIndex) {
    const clips = layers.map(layer => this.layerProcessor.convertLayerToClip(layer));
    
    // Ordenar clips por tiempo de inicio
    clips.sort((a, b) => a.start - b.start);
    
    return {
      id: trackIndex,
      name: `${this.capitalizeFirst(trackType)} Track`,
      type: trackType,
      clips,
      metadata: {
        layerCount: layers.length,
        duration: this.calculateTrackDuration(clips),
        hasAnimations: clips.some(clip => clip.animation || clip.animations),
        hasEffects: clips.some(clip => clip.effects && clip.effects.length > 0)
      }
    };
  }

  /**
   * Calcula la duración total de un track
   */
  calculateTrackDuration(clips) {
    if (clips.length === 0) return 0;
    
    return Math.max(...clips.map(clip => clip.start + clip.duration));
  }

  /**
   * Optimiza el timeline después de la construcción
   */
  optimizeTimeline(tracks) {
    return tracks.map(track => this.optimizeTrack(track));
  }

  /**
   * Optimiza un track individual
   */
  optimizeTrack(track) {
    const optimizedClips = this.optimizeClips(track.clips);
    
    return {
      ...track,
      clips: optimizedClips,
      metadata: {
        ...track.metadata,
        optimizations: this.getOptimizationInfo(track.clips, optimizedClips)
      }
    };
  }

  /**
   * Optimiza los clips de un track
   */
  optimizeClips(clips) {
    let optimized = [...clips];
    
    // Eliminar clips duplicados
    optimized = this.removeDuplicateClips(optimized);
    
    // Fusionar clips adyacentes similares
    optimized = this.mergeAdjacentClips(optimized);
    
    // Eliminar clips muy cortos
    optimized = this.removeShortClips(optimized);
    
    return optimized;
  }

  /**
   * Elimina clips duplicados
   */
  removeDuplicateClips(clips) {
    const seen = new Set();
    return clips.filter(clip => {
      const key = `${clip.type}-${clip.start}-${clip.duration}-${clip.src || clip.text || clip.color}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Fusiona clips adyacentes similares
   */
  mergeAdjacentClips(clips) {
    if (clips.length <= 1) return clips;
    
    const merged = [];
    let current = clips[0];
    
    for (let i = 1; i < clips.length; i++) {
      const next = clips[i];
      
      if (this.canMergeClips(current, next)) {
        current = this.mergeClips(current, next);
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }

  /**
   * Determina si dos clips pueden fusionarse
   */
  canMergeClips(clip1, clip2) {
    // Solo fusionar clips del mismo tipo
    if (clip1.type !== clip2.type) return false;
    
    // Solo fusionar clips adyacentes
    if (Math.abs((clip1.start + clip1.duration) - clip2.start) > 0.1) return false;
    
    // Solo fusionar clips con propiedades similares
    switch (clip1.type) {
      case 'text':
        return clip1.text === clip2.text && 
               clip1.fontSize === clip2.fontSize && 
               clip1.color === clip2.color;
               
      case 'background':
        return clip1.color === clip2.color;
        
      default:
        return clip1.src === clip2.src;
    }
  }

  /**
   * Fusiona dos clips
   */
  mergeClips(clip1, clip2) {
    return {
      ...clip1,
      duration: (clip2.start + clip2.duration) - clip1.start,
      name: `${clip1.name} + ${clip2.name}`
    };
  }

  /**
   * Elimina clips muy cortos (menos de 0.1 segundos)
   */
  removeShortClips(clips) {
    return clips.filter(clip => clip.duration >= 0.1);
  }

  /**
   * Obtiene información sobre las optimizaciones aplicadas
   */
  getOptimizationInfo(original, optimized) {
    return {
      originalCount: original.length,
      optimizedCount: optimized.length,
      clipsRemoved: original.length - optimized.length,
      optimizationRatio: optimized.length / original.length
    };
  }

  /**
   * Construye la configuración de fondo
   */
  buildBackground(composition) {
    // Buscar capa de fondo explícita
    const backgroundLayer = composition.layers.find(layer => 
      layer.type === 'SolidLayer' || 
      layer.name.toLowerCase().includes('background') ||
      layer.name.toLowerCase().includes('bg')
    );
    
    if (backgroundLayer) {
      return {
        type: 'color',
        color: backgroundLayer.color || '#000000'
      };
    }
    
    // Fondo por defecto
    return {
      type: 'color',
      color: composition.backgroundColor || '#000000'
    };
  }

  /**
   * Genera estadísticas del timeline
   */
  generateTimelineStats(timeline) {
    const stats = {
      totalTracks: timeline.tracks.length,
      totalClips: 0,
      duration: timeline.duration,
      resolution: timeline.resolution,
      frameRate: timeline.frameRate,
      trackStats: {},
      clipTypes: {},
      hasAnimations: false,
      hasEffects: false
    };
    
    for (const track of timeline.tracks) {
      stats.totalClips += track.clips.length;
      
      stats.trackStats[track.type] = {
        clipCount: track.clips.length,
        duration: track.metadata?.duration || 0
      };
      
      for (const clip of track.clips) {
        stats.clipTypes[clip.type] = (stats.clipTypes[clip.type] || 0) + 1;
        
        if (clip.animation || clip.animations) {
          stats.hasAnimations = true;
        }
        
        if (clip.effects && clip.effects.length > 0) {
          stats.hasEffects = true;
        }
      }
    }
    
    return stats;
  }

  /**
   * Utilidad para capitalizar la primera letra
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Crear tracks desde capas reales extraídas del análisis
   */
  createTracksFromRealLayers(realLayers) {
    const tracks = [];
    let trackId = 0;

    // Agrupar capas por tipo
    const layersByType = this.groupRealLayersByType(realLayers);

    // Procesar cada tipo de capa
    Object.entries(layersByType).forEach(([type, layers]) => {
      layers.forEach(layer => {
        const track = this.convertRealLayerToTrack(layer, trackId++);
        if (track) {
          tracks.push(track);
        }
      });
    });

    // Ordenar tracks por startTime y prioridad
    return this.sortTracksByPriority(tracks);
  }

  /**
   * Agrupar capas reales por tipo
   */
  groupRealLayersByType(realLayers) {
    const grouped = {
      background: [],
      shape: [],
      text: [],
      video: [],
      audio: [],
      image: []
    };

    realLayers.forEach(layer => {
      const type = this.normalizeLayerType(layer.type);
      if (grouped[type]) {
        grouped[type].push(layer);
      } else {
        // Tipo desconocido, tratar como shape
        grouped.shape.push(layer);
      }
    });

    return grouped;
  }

  /**
   * Convertir una capa real a un track
   */
  convertRealLayerToTrack(layer, trackId) {
    const baseTrack = {
      id: trackId,
      name: layer.name || `Track ${trackId}`,
      type: this.normalizeLayerType(layer.type),
      clips: []
    };

    // Crear clip desde la capa
    const clip = this.createClipFromRealLayer(layer);
    if (clip) {
      baseTrack.clips.push(clip);
    }

    return baseTrack.clips.length > 0 ? baseTrack : null;
  }

  /**
   * Crear un clip desde una capa real
   */
  createClipFromRealLayer(layer) {
    const baseClip = {
      id: layer.id || `clip_${Date.now()}`,
      name: layer.name || 'Clip',
      type: this.normalizeLayerType(layer.type),
      start: layer.startTime || 0,
      duration: layer.duration || 5,
      enabled: layer.enabled !== false
    };

    // Agregar propiedades de transformación
    if (layer.transform) {
      baseClip.transform = this.normalizeTransform(layer.transform);
    }

    // Propiedades específicas por tipo
    switch (baseClip.type) {
      case 'text':
        return this.createTextClip(baseClip, layer);
      case 'shape':
        return this.createShapeClip(baseClip, layer);
      case 'video':
      case 'image':
        return this.createMediaClip(baseClip, layer);
      case 'audio':
        return this.createAudioClip(baseClip, layer);
      default:
        return this.createGenericClip(baseClip, layer);
    }
  }

  /**
   * Crear clip de texto
   */
  createTextClip(baseClip, layer) {
    const textClip = {
      ...baseClip,
      type: 'text'
    };

    if (layer.textProperties) {
      textClip.text = layer.textProperties.text || 'Sample Text';
      textClip.fontSize = layer.textProperties.fontSize || 48;
      textClip.fontFamily = layer.textProperties.fontFamily || 'Arial';
      textClip.color = this.normalizeColor(layer.textProperties.fillColor) || '#ffffff';
      
      // Posición desde transform o textProperties
      if (layer.transform?.position) {
        textClip.position = {
          x: layer.transform.position.x || 960,
          y: layer.transform.position.y || 540
        };
      }
    }

    return textClip;
  }

  /**
   * Crear clip de forma/shape
   */
  createShapeClip(baseClip, layer) {
    const shapeClip = {
      ...baseClip,
      type: 'background' // Tratar shapes como background por simplicidad
    };

    if (layer.shapeProperties) {
      shapeClip.color = this.normalizeColor(layer.shapeProperties.fill) || '#000000';
      shapeClip.shapeType = layer.shapeProperties.type || 'rectangle';
      
      if (layer.shapeProperties.size) {
        shapeClip.size = {
          width: layer.shapeProperties.size.width || 1920,
          height: layer.shapeProperties.size.height || 1080
        };
      }
    }

    return shapeClip;
  }

  /**
   * Crear clip de media (video/imagen)
   */
  createMediaClip(baseClip, layer) {
    const mediaClip = {
      ...baseClip,
      type: layer.type === 'av' ? 'video' : layer.type
    };

    if (layer.sourceProperties) {
      mediaClip.source = {
        name: layer.sourceProperties.name,
        type: layer.sourceProperties.type,
        width: layer.sourceProperties.width,
        height: layer.sourceProperties.height,
        duration: layer.sourceProperties.duration,
        hasAudio: layer.sourceProperties.hasAudio
      };
    }

    return mediaClip;
  }

  /**
   * Crear clip de audio
   */
  createAudioClip(baseClip, layer) {
    const audioClip = {
      ...baseClip,
      type: 'audio'
    };

    if (layer.sourceProperties) {
      audioClip.source = {
        name: layer.sourceProperties.name,
        duration: layer.sourceProperties.duration,
        hasAudio: true
      };
      audioClip.volume = layer.transform?.opacity || 100;
    }

    return audioClip;
  }

  /**
   * Crear clip genérico
   */
  createGenericClip(baseClip, layer) {
    return {
      ...baseClip,
      type: 'shape', // Fallback
      color: '#cccccc'
    };
  }

  /**
   * Normalizar tipo de capa
   */
  normalizeLayerType(type) {
    const typeMap = {
      'text': 'text',
      'shape': 'shape',
      'av': 'video',
      'video': 'video',
      'image': 'image',
      'audio': 'audio',
      'null': 'shape',
      'unknown': 'shape'
    };

    return typeMap[type] || 'shape';
  }

  /**
   * Normalizar transformaciones
   */
  normalizeTransform(transform) {
    const normalized = {};

    if (transform.position) {
      if (Array.isArray(transform.position)) {
        normalized.position = {
          x: transform.position[0] || 0,
          y: transform.position[1] || 0
        };
      } else if (typeof transform.position === 'object') {
        normalized.position = {
          x: transform.position.x || 0,
          y: transform.position.y || 0
        };
      }
    }

    if (transform.scale) {
      if (Array.isArray(transform.scale)) {
        normalized.scale = {
          x: transform.scale[0] || 100,
          y: transform.scale[1] || 100
        };
      } else if (typeof transform.scale === 'object') {
        normalized.scale = {
          x: transform.scale.x || 100,
          y: transform.scale.y || 100
        };
      }
    }

    if (transform.rotation !== undefined) {
      normalized.rotation = transform.rotation || 0;
    }

    if (transform.opacity !== undefined) {
      normalized.opacity = transform.opacity || 100;
    }

    return normalized;
  }

  /**
   * Normalizar color
   */
  normalizeColor(color) {
    if (!color) return null;

    if (typeof color === 'string') {
      // Ya es un string de color
      return color.startsWith('#') ? color : `#${color}`;
    }

    if (Array.isArray(color)) {
      // Array RGB [r, g, b]
      const [r, g, b] = color;
      return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
    }

    return null;
  }

  /**
   * Convertir bgColor de AE a hex
   */
  convertBgColorToHex(bgColor) {
    if (!bgColor) return '#000000';
    
    if (Array.isArray(bgColor)) {
      const [r, g, b] = bgColor;
      return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
    }
    
    return '#000000';
  }

  /**
   * Ordenar tracks por prioridad
   */
  sortTracksByPriority(tracks) {
    const priorityOrder = {
      'background': 0,
      'shape': 1,
      'image': 2,
      'video': 3,
      'audio': 4,
      'text': 5
    };

    return tracks.sort((a, b) => {
      const aPriority = priorityOrder[a.type] || 999;
      const bPriority = priorityOrder[b.type] || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Si mismo tipo, ordenar por startTime
      const aStart = a.clips[0]?.start || 0;
      const bStart = b.clips[0]?.start || 0;
      return aStart - bStart;
    });
  }

  /**
   * Calcular duración total del timeline
   */
  calculateTimelineDuration(tracks) {
    if (!tracks || tracks.length === 0) return 10; // Duración por defecto

    let maxDuration = 0;
    
    tracks.forEach(track => {
      if (track.clips && track.clips.length > 0) {
        track.clips.forEach(clip => {
          const clipEnd = (clip.start || 0) + (clip.duration || 0);
          if (clipEnd > maxDuration) {
            maxDuration = clipEnd;
          }
        });
      }
    });

    return Math.max(maxDuration, 1); // Mínimo 1 segundo
  }
}

module.exports = AETimelineBuilder; 