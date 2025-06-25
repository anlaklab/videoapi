const logger = require('../../utils/logger');

/**
 * TrackComposer - Responsable de componer y procesar tracks individuales
 * Extraído del VideoProcessor para manejar la lógica específica de tracks
 */
class TrackComposer {
  constructor() {
    this.supportedTrackTypes = ['video', 'audio', 'text', 'background', 'overlay'];
    this.compositionStrategies = new Map();
    this.initializeStrategies();
  }

  /**
   * Inicializar estrategias de composición por tipo de track
   */
  initializeStrategies() {
    this.compositionStrategies.set('video', this.composeVideoTrack.bind(this));
    this.compositionStrategies.set('audio', this.composeAudioTrack.bind(this));
    this.compositionStrategies.set('text', this.composeTextTrack.bind(this));
    this.compositionStrategies.set('background', this.composeBackgroundTrack.bind(this));
    this.compositionStrategies.set('overlay', this.composeOverlayTrack.bind(this));
  }

  /**
   * Componer múltiples tracks en una secuencia coherente
   */
  async composeTracks(tracks, options = {}) {
    const correlationId = logger.generateCorrelationId();
    const timer = logger.timeOperation('Track Composition', correlationId);

    try {
      logger.info('🎵 Iniciando composición de tracks', {
        correlationId,
        trackCount: tracks.length,
        trackTypes: tracks.map(t => t.type)
      });

      // Validar tracks
      this.validateTracks(tracks);

      // Ordenar tracks por prioridad
      const orderedTracks = this.orderTracksByPriority(tracks);

      // Componer cada track
      const composedTracks = [];
      for (let i = 0; i < orderedTracks.length; i++) {
        const track = orderedTracks[i];
        
        try {
          const composedTrack = await this.composeTrack(track, i, correlationId);
          composedTracks.push(composedTrack);
        } catch (error) {
          logger.error(`Error componiendo track ${track.id}`, {
            error: error.message,
            trackType: track.type,
            correlationId
          });
          throw new Error(`Error en track ${track.id}: ${error.message}`);
        }
      }

      // Sincronizar tracks
      const synchronizedTracks = this.synchronizeTracks(composedTracks);

      // Optimizar composición
      const optimizedTracks = this.optimizeComposition(synchronizedTracks);

      timer.end({
        success: true,
        tracksComposed: optimizedTracks.length,
        totalDuration: this.calculateCompositionDuration(optimizedTracks)
      });

      logger.info('✅ Composición de tracks completada', {
        correlationId,
        tracks: optimizedTracks.length,
        duration: this.calculateCompositionDuration(optimizedTracks)
      });

      return optimizedTracks;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      logger.error('❌ Error en composición de tracks', {
        error: error.message,
        correlationId
      });
      throw error;
    }
  }

  /**
   * Componer un track individual
   */
  async composeTrack(track, index, correlationId) {
    logger.debug(`Componiendo track: ${track.id} (${track.type})`, { correlationId });

    // Obtener estrategia de composición
    const strategy = this.compositionStrategies.get(track.type);
    if (!strategy) {
      throw new Error(`No hay estrategia de composición para el tipo: ${track.type}`);
    }

    // Aplicar estrategia específica
    const composedTrack = await strategy(track, index, correlationId);

    // Agregar metadata de composición
    composedTrack.composition = {
      strategy: track.type,
      index: index,
      processedAt: new Date().toISOString(),
      clipsProcessed: composedTrack.clips.length,
      effectsApplied: this.countEffects(composedTrack.clips),
      animationsApplied: this.countAnimations(composedTrack.clips)
    };

    return composedTrack;
  }

  /**
   * Estrategia de composición para tracks de video
   */
  async composeVideoTrack(track, index, correlationId) {
    const composedTrack = { ...track };

    // Procesar clips de video/imagen
    composedTrack.clips = await Promise.all(
      track.clips.map(async (clip, clipIndex) => {
        const processedClip = { ...clip };

        // Configurar propiedades de video
        if (clip.type === 'video' || clip.type === 'image') {
          processedClip.ffmpegOptions = this.generateVideoFFmpegOptions(clip);
          processedClip.filterChain = this.buildVideoFilterChain(clip, clipIndex);
        }

        // Aplicar transformaciones
        if (clip.position || clip.scale || clip.rotation) {
          processedClip.transform = this.calculateTransform(clip);
        }

        // Procesar efectos visuales
        if (clip.effects && clip.effects.length > 0) {
          processedClip.effectsChain = this.buildEffectsChain(clip.effects);
        }

        return processedClip;
      })
    );

    // Configurar blending entre clips
    composedTrack.blending = this.calculateBlending(composedTrack.clips);

    return composedTrack;
  }

  /**
   * Estrategia de composición para tracks de audio
   */
  async composeAudioTrack(track, index, correlationId) {
    const composedTrack = { ...track };

    // Procesar clips de audio
    composedTrack.clips = track.clips.map((clip, clipIndex) => {
      const processedClip = { ...clip };

      if (clip.type === 'audio') {
        // Configurar opciones de audio
        processedClip.audioOptions = {
          volume: clip.volume || 1,
          fadeIn: clip.fadeIn || 0,
          fadeOut: clip.fadeOut || 0,
          format: 'aac',
          sampleRate: 48000,
          channels: 2
        };

        // Generar filtros de audio
        processedClip.audioFilters = this.buildAudioFilters(clip);
      }

      return processedClip;
    });

    // Configurar mezcla de audio
    composedTrack.mixing = this.calculateAudioMixing(composedTrack.clips);

    return composedTrack;
  }

  /**
   * Estrategia de composición para tracks de texto
   */
  async composeTextTrack(track, index, correlationId) {
    const composedTrack = { ...track };

    // Procesar clips de texto
    composedTrack.clips = track.clips.map((clip, clipIndex) => {
      const processedClip = { ...clip };

      if (clip.type === 'text') {
        // Configurar propiedades de texto
        processedClip.textOptions = {
          fontFamily: clip.fontFamily || 'Arial',
          fontSize: clip.fontSize || 48,
          color: clip.color || '#ffffff',
          fontWeight: clip.fontWeight || 'normal',
          textAlign: clip.textAlign || 'center',
          lineHeight: clip.lineHeight || 1.2
        };

        // Calcular posicionamiento
        processedClip.positioning = this.calculateTextPositioning(clip);

        // Generar filtros de texto para FFmpeg
        processedClip.textFilter = this.buildTextFilter(clip);
      }

      return processedClip;
    });

    return composedTrack;
  }

  /**
   * Estrategia de composición para tracks de background
   */
  async composeBackgroundTrack(track, index, correlationId) {
    const composedTrack = { ...track };

    // Procesar clips de background
    composedTrack.clips = track.clips.map((clip, clipIndex) => {
      const processedClip = { ...clip };

      if (clip.type === 'background') {
        // Configurar background
        processedClip.backgroundOptions = {
          type: 'color',
          color: clip.color || '#000000',
          width: 1920,
          height: 1080
        };

        // Generar filtro de background
        processedClip.backgroundFilter = this.buildBackgroundFilter(clip);
      }

      return processedClip;
    });

    return composedTrack;
  }

  /**
   * Estrategia de composición para tracks de overlay
   */
  async composeOverlayTrack(track, index, correlationId) {
    const composedTrack = { ...track };

    // Procesar clips de overlay
    composedTrack.clips = track.clips.map((clip, clipIndex) => {
      const processedClip = { ...clip };

      // Configurar overlay
      processedClip.overlayOptions = {
        blendMode: clip.blendMode || 'normal',
        opacity: clip.opacity || 1,
        position: clip.position || { x: 0, y: 0 }
      };

      // Generar filtros de overlay
      processedClip.overlayFilters = this.buildOverlayFilters(clip);

      return processedClip;
    });

    return composedTrack;
  }

  /**
   * Generar opciones de FFmpeg para video
   */
  generateVideoFFmpegOptions(clip) {
    const options = [];

    if (clip.scale && clip.scale !== 1) {
      options.push(`scale=iw*${clip.scale}:ih*${clip.scale}`);
    }

    if (clip.opacity && clip.opacity < 1) {
      options.push(`format=yuva420p,colorchannelmixer=aa=${clip.opacity}`);
    }

    return options;
  }

  /**
   * Construir cadena de filtros para video
   */
  buildVideoFilterChain(clip, index) {
    const filters = [];

    // Filtro de escala
    if (clip.scale && clip.scale !== 1) {
      filters.push(`[${index}:v]scale=iw*${clip.scale}:ih*${clip.scale}[scaled${index}]`);
    }

    // Filtro de posición
    if (clip.position) {
      const x = clip.position.x || 0;
      const y = clip.position.y || 0;
      filters.push(`[scaled${index}]overlay=${x}:${y}[positioned${index}]`);
    }

    return filters;
  }

  /**
   * Calcular transformación
   */
  calculateTransform(clip) {
    return {
      position: clip.position || { x: 0, y: 0 },
      scale: clip.scale || 1,
      rotation: clip.rotation || 0,
      opacity: clip.opacity || 1
    };
  }

  /**
   * Construir cadena de efectos
   */
  buildEffectsChain(effects) {
    return effects.map(effect => {
      switch (effect.type) {
        case 'blur':
          return `gblur=sigma=${effect.strength * 10}`;
        case 'brightness':
          return `eq=brightness=${effect.strength}`;
        case 'contrast':
          return `eq=contrast=${effect.strength}`;
        case 'saturation':
          return `eq=saturation=${effect.strength}`;
        default:
          return null;
      }
    }).filter(Boolean);
  }

  /**
   * Construir filtros de audio
   */
  buildAudioFilters(clip) {
    const filters = [];

    if (clip.volume && clip.volume !== 1) {
      filters.push(`volume=${clip.volume}`);
    }

    if (clip.fadeIn && clip.fadeIn > 0) {
      filters.push(`afade=t=in:ss=0:d=${clip.fadeIn}`);
    }

    if (clip.fadeOut && clip.fadeOut > 0) {
      const start = clip.duration - clip.fadeOut;
      filters.push(`afade=t=out:st=${start}:d=${clip.fadeOut}`);
    }

    return filters;
  }

  /**
   * Calcular posicionamiento de texto
   */
  calculateTextPositioning(clip) {
    const position = clip.position || { x: 960, y: 540 };
    
    return {
      x: position.x,
      y: position.y,
      anchor: clip.anchor || 'center',
      alignment: clip.textAlign || 'center'
    };
  }

  /**
   * Construir filtro de texto
   */
  buildTextFilter(clip) {
    const options = [];
    
    options.push(`text='${clip.text || 'Default Text'}'`);
    options.push(`fontsize=${clip.fontSize || 48}`);
    options.push(`fontcolor=${clip.color || '#ffffff'}`);
    options.push(`fontfile='${clip.fontFamily || 'Arial'}'`);
    
    if (clip.position) {
      options.push(`x=${clip.position.x || 'w/2-text_w/2'}`);
      options.push(`y=${clip.position.y || 'h/2-text_h/2'}`);
    }

    return `drawtext=${options.join(':')}`;
  }

  /**
   * Construir filtro de background
   */
  buildBackgroundFilter(clip) {
    const color = clip.color || '#000000';
    const width = 1920;
    const height = 1080;
    
    return `color=c=${color}:size=${width}x${height}:rate=30`;
  }

  /**
   * Construir filtros de overlay
   */
  buildOverlayFilters(clip) {
    const filters = [];

    if (clip.blendMode && clip.blendMode !== 'normal') {
      filters.push(`blend=mode=${clip.blendMode}`);
    }

    if (clip.opacity && clip.opacity < 1) {
      filters.push(`format=yuva420p,colorchannelmixer=aa=${clip.opacity}`);
    }

    return filters;
  }

  /**
   * Validar tracks
   */
  validateTracks(tracks) {
    if (!Array.isArray(tracks)) {
      throw new Error('Tracks debe ser un array');
    }

    if (tracks.length === 0) {
      throw new Error('Debe haber al menos un track');
    }

    tracks.forEach((track, index) => {
      if (!track.type || !this.supportedTrackTypes.includes(track.type)) {
        throw new Error(`Track ${index} tiene tipo inválido: ${track.type}`);
      }

      if (!track.clips || !Array.isArray(track.clips)) {
        throw new Error(`Track ${index} debe tener clips`);
      }
    });
  }

  /**
   * Ordenar tracks por prioridad
   */
  orderTracksByPriority(tracks) {
    const priorityOrder = {
      'background': 0,
      'video': 1,
      'audio': 2,
      'text': 3,
      'overlay': 4
    };

    return [...tracks].sort((a, b) => {
      const priorityA = priorityOrder[a.type] || 999;
      const priorityB = priorityOrder[b.type] || 999;
      return priorityA - priorityB;
    });
  }

  /**
   * Sincronizar tracks
   */
  synchronizeTracks(tracks) {
    // Encontrar duración máxima
    const maxDuration = Math.max(...tracks.map(track => 
      Math.max(...track.clips.map(clip => clip.start + clip.duration))
    ));

    // Sincronizar todos los tracks a la misma duración
    return tracks.map(track => ({
      ...track,
      synchronization: {
        maxDuration,
        synchronized: true,
        syncedAt: new Date().toISOString()
      }
    }));
  }

  /**
   * Optimizar composición
   */
  optimizeComposition(tracks) {
    return tracks.map(track => {
      // Eliminar clips superpuestos innecesarios
      const optimizedClips = this.removeRedundantClips(track.clips);
      
      // Optimizar filtros
      const optimizedFilters = this.optimizeFilters(track);

      return {
        ...track,
        clips: optimizedClips,
        optimization: {
          originalClips: track.clips.length,
          optimizedClips: optimizedClips.length,
          filtersOptimized: optimizedFilters,
          optimizedAt: new Date().toISOString()
        }
      };
    });
  }

  /**
   * Remover clips redundantes
   */
  removeRedundantClips(clips) {
    // Ordenar clips por tiempo de inicio
    const sortedClips = [...clips].sort((a, b) => a.start - b.start);
    
    // Eliminar clips completamente superpuestos
    return sortedClips.filter((clip, index) => {
      if (index === 0) return true;
      
      const prevClip = sortedClips[index - 1];
      const isCompletelyOverlapped = 
        clip.start >= prevClip.start && 
        (clip.start + clip.duration) <= (prevClip.start + prevClip.duration);
      
      return !isCompletelyOverlapped;
    });
  }

  /**
   * Optimizar filtros
   */
  optimizeFilters(track) {
    let optimizations = 0;

    track.clips.forEach(clip => {
      // Combinar filtros similares
      if (clip.effectsChain) {
        const originalLength = clip.effectsChain.length;
        clip.effectsChain = this.combineFilters(clip.effectsChain);
        optimizations += originalLength - clip.effectsChain.length;
      }
    });

    return optimizations;
  }

  /**
   * Combinar filtros similares
   */
  combineFilters(filters) {
    // Agrupar filtros del mismo tipo
    const grouped = {};
    
    filters.forEach(filter => {
      const type = filter.split('=')[0];
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(filter);
    });

    // Combinar filtros agrupados
    return Object.values(grouped).map(group => {
      if (group.length === 1) {
        return group[0];
      }
      // Para simplificar, usar el último filtro del grupo
      return group[group.length - 1];
    });
  }

  /**
   * Calcular duración de la composición
   */
  calculateCompositionDuration(tracks) {
    let maxDuration = 0;

    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });

    return maxDuration;
  }

  /**
   * Calcular blending entre clips
   */
  calculateBlending(clips) {
    const blendingRules = [];

    for (let i = 0; i < clips.length - 1; i++) {
      const currentClip = clips[i];
      const nextClip = clips[i + 1];
      
      const currentEnd = currentClip.start + currentClip.duration;
      const overlap = Math.max(0, currentEnd - nextClip.start);
      
      if (overlap > 0) {
        blendingRules.push({
          clipA: currentClip.id,
          clipB: nextClip.id,
          overlap: overlap,
          blendType: 'crossfade'
        });
      }
    }

    return blendingRules;
  }

  /**
   * Calcular mezcla de audio
   */
  calculateAudioMixing(clips) {
    return {
      channels: 2,
      sampleRate: 48000,
      format: 'aac',
      mixingStrategy: 'overlay',
      normalization: true,
      clipsCount: clips.length
    };
  }

  /**
   * Contar efectos
   */
  countEffects(clips) {
    return clips.reduce((total, clip) => {
      return total + (clip.effects?.length || 0);
    }, 0);
  }

  /**
   * Contar animaciones
   */
  countAnimations(clips) {
    return clips.reduce((total, clip) => {
      return total + (clip.animations?.length || 0);
    }, 0);
  }
}

module.exports = TrackComposer; 