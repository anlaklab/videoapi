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
    logger.info(`🏗️ Construyendo timeline desde composición: ${composition.name}`);
    
    // Validar composición
    this.validateComposition(composition);
    
    // Procesar capas
    const processedLayers = this.preprocessLayers(composition.layers);
    
    // Agrupar capas por tipo
    const layersByType = this.layerProcessor.groupLayersByType(processedLayers);
    
    // Crear tracks
    const tracks = this.createTracksFromLayers(layersByType);
    
    // Optimizar timeline
    const optimizedTracks = this.optimizeTimeline(tracks);
    
    const timeline = {
      tracks: optimizedTracks,
      duration: composition.duration,
      resolution: {
        width: composition.resolution?.width || 1920,
        height: composition.resolution?.height || 1080
      },
      frameRate: composition.frameRate || 30,
      background: this.buildBackground(composition)
    };
    
    logger.info(`✅ Timeline construido con ${timeline.tracks.length} tracks`);
    return timeline;
  }

  /**
   * Valida una composición antes de procesarla
   */
  validateComposition(composition) {
    if (!composition.name) {
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
}

module.exports = AETimelineBuilder; 