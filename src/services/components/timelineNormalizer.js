const logger = require('../../utils/logger');

/**
 * TimelineNormalizer - Responsable de normalizar y validar timelines
 * Extraído del VideoProcessor para seguir el principio de responsabilidad única
 */
class TimelineNormalizer {
  constructor() {
    this.defaultSettings = {
      frameRate: 30,
      resolution: { width: 1920, height: 1080 },
      duration: 10
    };
  }

  /**
   * Normalizar timeline completo
   */
  async normalizeTimeline(timeline, options = {}) {
    const correlationId = logger.generateCorrelationId();
    const timer = logger.timeOperation('Timeline Normalization', correlationId);

    try {
      logger.info('🔧 Iniciando normalización de timeline', { 
        correlationId,
        tracksCount: timeline.tracks?.length || 0 
      });

      // Validar estructura básica
      this.validateTimelineStructure(timeline);

      // Normalizar configuración general
      const normalizedTimeline = this.normalizeGeneralSettings(timeline);

      // Normalizar tracks
      normalizedTimeline.tracks = await this.normalizeTracks(normalizedTimeline.tracks, correlationId);

      // Calcular duración total
      normalizedTimeline.duration = this.calculateTotalDuration(normalizedTimeline.tracks);

      // Optimizar timeline
      const optimizedTimeline = this.optimizeTimeline(normalizedTimeline);

      timer.end({ 
        success: true,
        tracksProcessed: optimizedTimeline.tracks.length,
        totalClips: this.countTotalClips(optimizedTimeline.tracks),
        finalDuration: optimizedTimeline.duration
      });

      logger.info('✅ Timeline normalizado exitosamente', {
        correlationId,
        tracks: optimizedTimeline.tracks.length,
        duration: optimizedTimeline.duration
      });

      return optimizedTimeline;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      logger.error('❌ Error normalizando timeline', { 
        error: error.message,
        correlationId 
      });
      throw error;
    }
  }

  /**
   * Validar estructura básica del timeline
   */
  validateTimelineStructure(timeline) {
    if (!timeline || typeof timeline !== 'object') {
      throw new Error('Timeline debe ser un objeto válido');
    }

    if (!timeline.tracks || !Array.isArray(timeline.tracks)) {
      throw new Error('Timeline debe contener un array de tracks');
    }

    if (timeline.tracks.length === 0) {
      throw new Error('Timeline debe contener al menos un track');
    }

    // Validar cada track
    timeline.tracks.forEach((track, index) => {
      if (!track.clips || !Array.isArray(track.clips)) {
        throw new Error(`Track ${index} debe contener un array de clips`);
      }

      if (track.clips.length === 0) {
        logger.warn(`Track ${index} está vacío`, { trackId: track.id });
      }
    });
  }

  /**
   * Normalizar configuración general
   */
  normalizeGeneralSettings(timeline) {
    return {
      ...timeline,
      frameRate: timeline.frameRate || this.defaultSettings.frameRate,
      resolution: {
        width: timeline.resolution?.width || this.defaultSettings.resolution.width,
        height: timeline.resolution?.height || this.defaultSettings.resolution.height
      },
      background: timeline.background || {
        type: 'color',
        color: '#000000'
      }
    };
  }

  /**
   * Normalizar todos los tracks
   */
  async normalizeTracks(tracks, correlationId) {
    const normalizedTracks = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      
      try {
        const normalizedTrack = await this.normalizeTrack(track, i, correlationId);
        normalizedTracks.push(normalizedTrack);
      } catch (error) {
        logger.error(`Error normalizando track ${i}`, { 
          error: error.message,
          trackId: track.id,
          correlationId 
        });
        throw new Error(`Error en track ${i}: ${error.message}`);
      }
    }

    return normalizedTracks;
  }

  /**
   * Normalizar un track individual
   */
  async normalizeTrack(track, index, correlationId) {
    const normalizedTrack = {
      id: track.id || `track-${index}`,
      name: track.name || `Track ${index + 1}`,
      type: track.type || 'video',
      enabled: track.enabled !== false,
      clips: [],
      metadata: {
        originalIndex: index,
        clipCount: track.clips.length,
        duration: 0,
        hasAnimations: false,
        hasEffects: false
      }
    };

    // Normalizar clips
    for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex++) {
      const clip = track.clips[clipIndex];
      
      try {
        const normalizedClip = this.normalizeClip(clip, clipIndex, normalizedTrack.type);
        normalizedTrack.clips.push(normalizedClip);

        // Actualizar metadata del track
        if (normalizedClip.animations?.length > 0) {
          normalizedTrack.metadata.hasAnimations = true;
        }
        if (normalizedClip.effects?.length > 0) {
          normalizedTrack.metadata.hasEffects = true;
        }
      } catch (error) {
        logger.error(`Error normalizando clip ${clipIndex} en track ${normalizedTrack.id}`, {
          error: error.message,
          correlationId
        });
        throw new Error(`Error en clip ${clipIndex}: ${error.message}`);
      }
    }

    // Calcular duración del track
    normalizedTrack.metadata.duration = this.calculateTrackDuration(normalizedTrack.clips);

    return normalizedTrack;
  }

  /**
   * Normalizar un clip individual
   */
  normalizeClip(clip, index, trackType) {
    if (!clip || typeof clip !== 'object') {
      throw new Error(`Clip ${index} debe ser un objeto válido`);
    }

    const normalizedClip = {
      id: clip.id || `clip-${index}`,
      name: clip.name || `Clip ${index + 1}`,
      type: clip.type || this.inferClipType(clip, trackType),
      start: Math.max(0, clip.start || 0),
      duration: Math.max(0.1, clip.duration || clip.length || 1),
      enabled: clip.enabled !== false
    };

    // Propiedades específicas por tipo
    switch (normalizedClip.type) {
      case 'text':
        normalizedClip.text = clip.text || 'Default Text';
        normalizedClip.fontFamily = clip.fontFamily || 'Arial';
        normalizedClip.fontSize = clip.fontSize || 48;
        normalizedClip.color = this.normalizeColor(clip.color || '#ffffff');
        normalizedClip.position = this.normalizePosition(clip.position);
        break;

      case 'image':
      case 'video':
        normalizedClip.src = clip.src || clip.url;
        if (!normalizedClip.src) {
          throw new Error(`Clip ${normalizedClip.type} requiere src o url`);
        }
        normalizedClip.position = this.normalizePosition(clip.position);
        normalizedClip.scale = Math.max(0.1, clip.scale || 1);
        normalizedClip.opacity = Math.max(0, Math.min(1, clip.opacity || 1));
        break;

      case 'audio':
        normalizedClip.src = clip.src || clip.url;
        if (!normalizedClip.src) {
          throw new Error('Clip de audio requiere src o url');
        }
        normalizedClip.volume = Math.max(0, Math.min(1, clip.volume || 1));
        break;

      case 'background':
        normalizedClip.color = this.normalizeColor(clip.color || '#000000');
        normalizedClip.position = this.normalizePosition(clip.position);
        break;

      case 'html':
        normalizedClip.html = clip.html || '<div>Default HTML</div>';
        normalizedClip.position = this.normalizePosition(clip.position);
        break;
    }

    // Normalizar animaciones
    if (clip.animations || clip.animation) {
      normalizedClip.animations = this.normalizeAnimations(
        clip.animations || [clip.animation]
      );
    }

    // Normalizar efectos
    if (clip.effects) {
      normalizedClip.effects = this.normalizeEffects(clip.effects);
    }

    return normalizedClip;
  }

  /**
   * Inferir tipo de clip basado en propiedades
   */
  inferClipType(clip, trackType) {
    if (clip.text !== undefined) return 'text';
    if (clip.html !== undefined) return 'html';
    if (clip.color !== undefined && !clip.src) return 'background';
    if (clip.src || clip.url) {
      const src = clip.src || clip.url;
      if (src.match(/\.(mp4|mov|avi|webm)$/i)) return 'video';
      if (src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
      if (src.match(/\.(mp3|wav|aac|ogg)$/i)) return 'audio';
    }
    
    // Fallback al tipo del track
    return trackType || 'video';
  }

  /**
   * Normalizar color (asegurar formato hex)
   */
  normalizeColor(color) {
    if (typeof color === 'string') {
      if (color.startsWith('#')) {
        return color;
      }
      if (color.match(/^[0-9a-fA-F]{6}$/)) {
        return `#${color}`;
      }
    }
    
    // Colores nombrados básicos
    const namedColors = {
      'white': '#ffffff',
      'black': '#000000',
      'red': '#ff0000',
      'green': '#00ff00',
      'blue': '#0000ff'
    };
    
    return namedColors[color?.toLowerCase()] || '#ffffff';
  }

  /**
   * Normalizar posición
   */
  normalizePosition(position) {
    if (!position) {
      return { x: 960, y: 540 }; // Centro por defecto para 1920x1080
    }

    return {
      x: typeof position.x === 'number' ? position.x : 960,
      y: typeof position.y === 'number' ? position.y : 540
    };
  }

  /**
   * Normalizar animaciones
   */
  normalizeAnimations(animations) {
    if (!Array.isArray(animations)) {
      return [];
    }

    return animations.map(animation => ({
      type: animation.type || 'fadeIn',
      duration: Math.max(0.1, animation.duration || 1),
      delay: Math.max(0, animation.delay || 0),
      easing: animation.easing || 'ease-in-out',
      direction: animation.direction || 'normal',
      iterations: Math.max(1, animation.iterations || 1)
    }));
  }

  /**
   * Normalizar efectos
   */
  normalizeEffects(effects) {
    if (!Array.isArray(effects)) {
      return [];
    }

    return effects.map(effect => ({
      type: effect.type || 'none',
      strength: Math.max(0, Math.min(1, effect.strength || 0.5)),
      ...effect
    }));
  }

  /**
   * Calcular duración total del timeline
   */
  calculateTotalDuration(tracks) {
    let maxDuration = 0;

    tracks.forEach(track => {
      const trackDuration = this.calculateTrackDuration(track.clips);
      if (trackDuration > maxDuration) {
        maxDuration = trackDuration;
      }
    });

    return Math.max(1, maxDuration);
  }

  /**
   * Calcular duración de un track
   */
  calculateTrackDuration(clips) {
    let maxEnd = 0;

    clips.forEach(clip => {
      const clipEnd = clip.start + clip.duration;
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd;
      }
    });

    return maxEnd;
  }

  /**
   * Optimizar timeline eliminando clips inválidos
   */
  optimizeTimeline(timeline) {
    const optimizedTracks = timeline.tracks.map(track => {
      const validClips = track.clips.filter(clip => {
        // Filtrar clips con duración cero o negativa
        if (clip.duration <= 0) {
          logger.warn(`Removiendo clip con duración inválida: ${clip.id}`, {
            duration: clip.duration
          });
          return false;
        }

        // Filtrar clips que empiezan después del final del timeline
        if (clip.start >= timeline.duration) {
          logger.warn(`Removiendo clip que empieza después del final: ${clip.id}`, {
            start: clip.start,
            timelineDuration: timeline.duration
          });
          return false;
        }

        return true;
      });

      return {
        ...track,
        clips: validClips,
        metadata: {
          ...track.metadata,
          optimizedCount: validClips.length,
          originalCount: track.clips.length,
          clipsRemoved: track.clips.length - validClips.length,
          optimizationRatio: validClips.length / track.clips.length
        }
      };
    });

    return {
      ...timeline,
      tracks: optimizedTracks
    };
  }

  /**
   * Contar clips totales
   */
  countTotalClips(tracks) {
    return tracks.reduce((total, track) => total + track.clips.length, 0);
  }

  /**
   * Validar timeline normalizado
   */
  validateNormalizedTimeline(timeline) {
    const issues = [];

    // Validar duración
    if (timeline.duration <= 0) {
      issues.push('Timeline debe tener duración positiva');
    }

    // Validar tracks
    timeline.tracks.forEach((track, trackIndex) => {
      if (!track.id) {
        issues.push(`Track ${trackIndex} debe tener ID`);
      }

      track.clips.forEach((clip, clipIndex) => {
        if (!clip.id) {
          issues.push(`Clip ${clipIndex} en track ${trackIndex} debe tener ID`);
        }

        if (clip.duration <= 0) {
          issues.push(`Clip ${clip.id} tiene duración inválida: ${clip.duration}`);
        }

        if (clip.start < 0) {
          issues.push(`Clip ${clip.id} tiene tiempo de inicio negativo: ${clip.start}`);
        }
      });
    });

    if (issues.length > 0) {
      throw new Error(`Timeline normalizado tiene problemas: ${issues.join(', ')}`);
    }

    return true;
  }
}

module.exports = TimelineNormalizer; 