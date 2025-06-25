const logger = require('../../utils/logger');

/**
 * FilterBuilder - Responsable de construir filtros complejos de FFmpeg
 * Extraído del VideoRenderer para separar la lógica de construcción de filtros
 */
class FilterBuilder {
  constructor() {
    this.filterTypes = {
      video: new Map(),
      audio: new Map(),
      complex: new Map()
    };
    
    this.initializeFilterTypes();
  }

  /**
   * Inicializar tipos de filtros soportados
   */
  initializeFilterTypes() {
    // Filtros de video
    this.filterTypes.video.set('scale', this.buildScaleFilter.bind(this));
    this.filterTypes.video.set('crop', this.buildCropFilter.bind(this));
    this.filterTypes.video.set('rotate', this.buildRotateFilter.bind(this));
    this.filterTypes.video.set('blur', this.buildBlurFilter.bind(this));
    this.filterTypes.video.set('brightness', this.buildBrightnessFilter.bind(this));
    this.filterTypes.video.set('contrast', this.buildContrastFilter.bind(this));
    this.filterTypes.video.set('saturation', this.buildSaturationFilter.bind(this));
    this.filterTypes.video.set('overlay', this.buildOverlayFilter.bind(this));
    this.filterTypes.video.set('text', this.buildTextFilter.bind(this));

    // Filtros de audio
    this.filterTypes.audio.set('volume', this.buildVolumeFilter.bind(this));
    this.filterTypes.audio.set('fade', this.buildAudioFadeFilter.bind(this));
    this.filterTypes.audio.set('equalizer', this.buildEqualizerFilter.bind(this));
    this.filterTypes.audio.set('normalize', this.buildNormalizeFilter.bind(this));

    // Filtros complejos
    this.filterTypes.complex.set('transition', this.buildTransitionFilter.bind(this));
    this.filterTypes.complex.set('composite', this.buildCompositeFilter.bind(this));
    this.filterTypes.complex.set('mix', this.buildMixFilter.bind(this));
  }

  /**
   * Construir filtro complejo para múltiples clips
   */
  async buildComplexFilter(timeline, options = {}) {
    const correlationId = logger.generateCorrelationId();
    const timer = logger.timeOperation('Complex Filter Building', correlationId);

    try {
      logger.info('🔧 Construyendo filtro complejo', {
        correlationId,
        tracks: timeline.tracks.length,
        totalClips: this.countTotalClips(timeline.tracks)
      });

      const filterGraph = {
        inputs: [],
        filters: [],
        outputs: [],
        metadata: {
          complexity: 'complex',
          trackCount: timeline.tracks.length,
          clipCount: this.countTotalClips(timeline.tracks)
        }
      };

      // Procesar cada track
      for (let trackIndex = 0; trackIndex < timeline.tracks.length; trackIndex++) {
        const track = timeline.tracks[trackIndex];
        const trackFilters = await this.buildTrackFilters(track, trackIndex, correlationId);
        
        filterGraph.inputs.push(...trackFilters.inputs);
        filterGraph.filters.push(...trackFilters.filters);
      }

      // Construir composición final
      const compositionFilters = this.buildCompositionFilters(timeline.tracks);
      filterGraph.filters.push(...compositionFilters);

      // Definir salidas
      filterGraph.outputs = this.buildOutputs(timeline);

      // Optimizar filtro
      const optimizedFilter = this.optimizeFilterGraph(filterGraph);

      timer.end({
        success: true,
        filtersGenerated: optimizedFilter.filters.length,
        complexity: optimizedFilter.metadata.complexity
      });

      logger.info('✅ Filtro complejo construido exitosamente', {
        correlationId,
        filters: optimizedFilter.filters.length
      });

      return optimizedFilter;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      logger.error('❌ Error construyendo filtro complejo', {
        error: error.message,
        correlationId
      });
      throw error;
    }
  }

  /**
   * Construir filtros para un track específico
   */
  async buildTrackFilters(track, trackIndex, correlationId) {
    const trackFilters = {
      inputs: [],
      filters: []
    };

    logger.debug(`Construyendo filtros para track ${track.id} (${track.type})`, {
      correlationId,
      clipCount: track.clips.length
    });

    // Procesar clips del track
    for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex++) {
      const clip = track.clips[clipIndex];
      const clipFilters = await this.buildClipFilters(clip, trackIndex, clipIndex);
      
      trackFilters.inputs.push(...clipFilters.inputs);
      trackFilters.filters.push(...clipFilters.filters);
    }

    // Aplicar filtros específicos del track
    const trackSpecificFilters = this.buildTrackSpecificFilters(track, trackIndex);
    trackFilters.filters.push(...trackSpecificFilters);

    return trackFilters;
  }

  /**
   * Construir filtros para un clip específico
   */
  async buildClipFilters(clip, trackIndex, clipIndex) {
    const clipFilters = {
      inputs: [],
      filters: []
    };

    const inputLabel = `${trackIndex}:${clipIndex}`;
    const baseLabel = `t${trackIndex}c${clipIndex}`;

    // Input del clip
    if (clip.src) {
      clipFilters.inputs.push({
        src: clip.src,
        label: inputLabel,
        type: clip.type
      });
    }

    // Filtros básicos por tipo de clip
    switch (clip.type) {
      case 'video':
      case 'image':
        clipFilters.filters.push(...this.buildVideoClipFilters(clip, baseLabel));
        break;
      case 'audio':
        clipFilters.filters.push(...this.buildAudioClipFilters(clip, baseLabel));
        break;
      case 'text':
        clipFilters.filters.push(...this.buildTextClipFilters(clip, baseLabel));
        break;
      case 'background':
        clipFilters.filters.push(...this.buildBackgroundClipFilters(clip, baseLabel));
        break;
    }

    // Aplicar efectos
    if (clip.effects && clip.effects.length > 0) {
      const effectFilters = this.buildEffectFilters(clip.effects, baseLabel);
      clipFilters.filters.push(...effectFilters);
    }

    // Aplicar animaciones
    if (clip.animations && clip.animations.length > 0) {
      const animationFilters = this.buildAnimationFilters(clip.animations, baseLabel, clip);
      clipFilters.filters.push(...animationFilters);
    }

    return clipFilters;
  }

  /**
   * Construir filtros para clips de video
   */
  buildVideoClipFilters(clip, baseLabel) {
    const filters = [];
    let currentLabel = `[${baseLabel}_input]`;
    let outputLabel = `[${baseLabel}_video]`;

    // Escala
    if (clip.scale && clip.scale !== 1) {
      const scaleFilter = this.buildScaleFilter(clip, currentLabel, `[${baseLabel}_scaled]`);
      filters.push(scaleFilter);
      currentLabel = `[${baseLabel}_scaled]`;
    }

    // Rotación
    if (clip.rotation && clip.rotation !== 0) {
      const rotateFilter = this.buildRotateFilter(clip, currentLabel, `[${baseLabel}_rotated]`);
      filters.push(rotateFilter);
      currentLabel = `[${baseLabel}_rotated]`;
    }

    // Opacidad
    if (clip.opacity && clip.opacity < 1) {
      const opacityFilter = this.buildOpacityFilter(clip, currentLabel, outputLabel);
      filters.push(opacityFilter);
    } else {
      // Renombrar label final
      if (currentLabel !== outputLabel) {
        filters.push(`${currentLabel}copy${outputLabel}`);
      }
    }

    return filters;
  }

  /**
   * Construir filtros para clips de audio
   */
  buildAudioClipFilters(clip, baseLabel) {
    const filters = [];
    let currentLabel = `[${baseLabel}_input]`;
    let outputLabel = `[${baseLabel}_audio]`;

    // Volumen
    if (clip.volume && clip.volume !== 1) {
      const volumeFilter = this.buildVolumeFilter(clip, currentLabel, `[${baseLabel}_volume]`);
      filters.push(volumeFilter);
      currentLabel = `[${baseLabel}_volume]`;
    }

    // Fade in/out
    if (clip.fadeIn || clip.fadeOut) {
      const fadeFilter = this.buildAudioFadeFilter(clip, currentLabel, outputLabel);
      filters.push(fadeFilter);
    } else {
      if (currentLabel !== outputLabel) {
        filters.push(`${currentLabel}acopy${outputLabel}`);
      }
    }

    return filters;
  }

  /**
   * Construir filtros para clips de texto
   */
  buildTextClipFilters(clip, baseLabel) {
    const filters = [];
    const outputLabel = `[${baseLabel}_text]`;

    // Crear texto base
    const textFilter = this.buildTextFilter(clip, null, outputLabel);
    filters.push(textFilter);

    return filters;
  }

  /**
   * Construir filtros para clips de background
   */
  buildBackgroundClipFilters(clip, baseLabel) {
    const filters = [];
    const outputLabel = `[${baseLabel}_bg]`;

    // Crear background de color
    const bgFilter = this.buildBackgroundFilter(clip, outputLabel);
    filters.push(bgFilter);

    return filters;
  }

  /**
   * Filtro de escala
   */
  buildScaleFilter(clip, inputLabel, outputLabel) {
    const scale = clip.scale || 1;
    return `${inputLabel}scale=iw*${scale}:ih*${scale}${outputLabel}`;
  }

  /**
   * Filtro de recorte
   */
  buildCropFilter(clip, inputLabel, outputLabel) {
    const { x = 0, y = 0, width = 1920, height = 1080 } = clip.crop || {};
    return `${inputLabel}crop=${width}:${height}:${x}:${y}${outputLabel}`;
  }

  /**
   * Filtro de rotación
   */
  buildRotateFilter(clip, inputLabel, outputLabel) {
    const rotation = clip.rotation || 0;
    const radians = (rotation * Math.PI) / 180;
    return `${inputLabel}rotate=${radians}${outputLabel}`;
  }

  /**
   * Filtro de desenfoque
   */
  buildBlurFilter(effect, inputLabel, outputLabel) {
    const sigma = (effect.strength || 0.5) * 10;
    return `${inputLabel}gblur=sigma=${sigma}${outputLabel}`;
  }

  /**
   * Filtro de brillo
   */
  buildBrightnessFilter(effect, inputLabel, outputLabel) {
    const brightness = effect.strength || 0;
    return `${inputLabel}eq=brightness=${brightness}${outputLabel}`;
  }

  /**
   * Filtro de contraste
   */
  buildContrastFilter(effect, inputLabel, outputLabel) {
    const contrast = effect.strength || 1;
    return `${inputLabel}eq=contrast=${contrast}${outputLabel}`;
  }

  /**
   * Filtro de saturación
   */
  buildSaturationFilter(effect, inputLabel, outputLabel) {
    const saturation = effect.strength || 1;
    return `${inputLabel}eq=saturation=${saturation}${outputLabel}`;
  }

  /**
   * Filtro de opacidad
   */
  buildOpacityFilter(clip, inputLabel, outputLabel) {
    const opacity = clip.opacity || 1;
    return `${inputLabel}format=yuva420p,colorchannelmixer=aa=${opacity}${outputLabel}`;
  }

  /**
   * Filtro de overlay
   */
  buildOverlayFilter(clip, backgroundLabel, overlayLabel, outputLabel) {
    const x = clip.position?.x || 0;
    const y = clip.position?.y || 0;
    const enable = clip.start ? `enable='between(t,${clip.start},${clip.start + clip.duration})'` : '';
    
    return `${backgroundLabel}${overlayLabel}overlay=${x}:${y}:${enable}${outputLabel}`;
  }

  /**
   * Filtro de texto
   */
  buildTextFilter(clip, inputLabel, outputLabel) {
    const options = [];
    
    options.push(`text='${this.escapeText(clip.text || 'Default Text')}'`);
    options.push(`fontsize=${clip.fontSize || 48}`);
    options.push(`fontcolor=${clip.color || '#ffffff'}`);
    
    if (clip.fontFamily) {
      options.push(`fontfile='${clip.fontFamily}'`);
    }
    
    if (clip.position) {
      options.push(`x=${clip.position.x || 'w/2-text_w/2'}`);
      options.push(`y=${clip.position.y || 'h/2-text_h/2'}`);
    }

    if (clip.start && clip.duration) {
      options.push(`enable='between(t,${clip.start},${clip.start + clip.duration})'`);
    }

    const baseFilter = inputLabel ? inputLabel : 'color=black:1920x1080:rate=30';
    return `${baseFilter}drawtext=${options.join(':')}${outputLabel}`;
  }

  /**
   * Filtro de background
   */
  buildBackgroundFilter(clip, outputLabel) {
    const color = clip.color || '#000000';
    const width = 1920;
    const height = 1080;
    const duration = clip.duration || 10;
    
    return `color=c=${color}:size=${width}x${height}:duration=${duration}:rate=30${outputLabel}`;
  }

  /**
   * Filtro de volumen
   */
  buildVolumeFilter(clip, inputLabel, outputLabel) {
    const volume = clip.volume || 1;
    return `${inputLabel}volume=${volume}${outputLabel}`;
  }

  /**
   * Filtro de fade de audio
   */
  buildAudioFadeFilter(clip, inputLabel, outputLabel) {
    const filters = [];
    
    if (clip.fadeIn && clip.fadeIn > 0) {
      filters.push(`afade=t=in:ss=0:d=${clip.fadeIn}`);
    }
    
    if (clip.fadeOut && clip.fadeOut > 0) {
      const start = clip.duration - clip.fadeOut;
      filters.push(`afade=t=out:st=${start}:d=${clip.fadeOut}`);
    }
    
    return `${inputLabel}${filters.join(',')}${outputLabel}`;
  }

  /**
   * Filtro de ecualizador
   */
  buildEqualizerFilter(effect, inputLabel, outputLabel) {
    // Implementación básica de ecualizador
    return `${inputLabel}equalizer=f=1000:width_type=h:width=200:g=${effect.gain || 0}${outputLabel}`;
  }

  /**
   * Filtro de normalización
   */
  buildNormalizeFilter(effect, inputLabel, outputLabel) {
    return `${inputLabel}loudnorm${outputLabel}`;
  }

  /**
   * Construir filtros de efectos
   */
  buildEffectFilters(effects, baseLabel) {
    const filters = [];
    let currentLabel = `[${baseLabel}_video]`;

    effects.forEach((effect, index) => {
      const outputLabel = `[${baseLabel}_fx${index}]`;
      
      switch (effect.type) {
        case 'blur':
          filters.push(this.buildBlurFilter(effect, currentLabel, outputLabel));
          break;
        case 'brightness':
          filters.push(this.buildBrightnessFilter(effect, currentLabel, outputLabel));
          break;
        case 'contrast':
          filters.push(this.buildContrastFilter(effect, currentLabel, outputLabel));
          break;
        case 'saturation':
          filters.push(this.buildSaturationFilter(effect, currentLabel, outputLabel));
          break;
      }
      
      currentLabel = outputLabel;
    });

    return filters;
  }

  /**
   * Construir filtros de animación
   */
  buildAnimationFilters(animations, baseLabel, clip) {
    const filters = [];

    animations.forEach((animation, index) => {
      switch (animation.type) {
        case 'fadeIn':
          filters.push(this.buildFadeInFilter(animation, baseLabel, clip));
          break;
        case 'fadeOut':
          filters.push(this.buildFadeOutFilter(animation, baseLabel, clip));
          break;
        case 'slideIn':
          filters.push(this.buildSlideInFilter(animation, baseLabel, clip));
          break;
        case 'zoom':
          filters.push(this.buildZoomFilter(animation, baseLabel, clip));
          break;
      }
    });

    return filters;
  }

  /**
   * Filtro de fade in
   */
  buildFadeInFilter(animation, baseLabel, clip) {
    const duration = animation.duration || 1;
    const start = clip.start || 0;
    
    return `[${baseLabel}_video]fade=t=in:st=${start}:d=${duration}[${baseLabel}_fadein]`;
  }

  /**
   * Filtro de fade out
   */
  buildFadeOutFilter(animation, baseLabel, clip) {
    const duration = animation.duration || 1;
    const start = (clip.start || 0) + (clip.duration || 0) - duration;
    
    return `[${baseLabel}_video]fade=t=out:st=${start}:d=${duration}[${baseLabel}_fadeout]`;
  }

  /**
   * Filtro de slide in
   */
  buildSlideInFilter(animation, baseLabel, clip) {
    const duration = animation.duration || 1;
    const start = clip.start || 0;
    const direction = animation.direction || 'left';
    
    let expression;
    switch (direction) {
      case 'left':
        expression = `if(lt(t,${start}),W,if(lt(t,${start + duration}),W-W*(t-${start})/${duration},0))`;
        break;
      case 'right':
        expression = `if(lt(t,${start}),-W,if(lt(t,${start + duration}),-W+W*(t-${start})/${duration},0))`;
        break;
      case 'top':
        expression = `if(lt(t,${start}),H,if(lt(t,${start + duration}),H-H*(t-${start})/${duration},0))`;
        break;
      case 'bottom':
        expression = `if(lt(t,${start}),-H,if(lt(t,${start + duration}),-H+H*(t-${start})/${duration},0))`;
        break;
      default:
        expression = '0';
    }
    
    return `[${baseLabel}_video]overlay=x='${expression}':y=0[${baseLabel}_slide]`;
  }

  /**
   * Filtro de zoom
   */
  buildZoomFilter(animation, baseLabel, clip) {
    const duration = animation.duration || 1;
    const start = clip.start || 0;
    const zoomFactor = animation.zoomFactor || 1.5;
    
    const scaleExpression = `if(lt(t,${start}),1,if(lt(t,${start + duration}),1+(${zoomFactor}-1)*(t-${start})/${duration},${zoomFactor}))`;
    
    return `[${baseLabel}_video]scale=iw*${scaleExpression}:ih*${scaleExpression}[${baseLabel}_zoom]`;
  }

  /**
   * Construir filtros específicos del track
   */
  buildTrackSpecificFilters(track, trackIndex) {
    const filters = [];

    // Agregar filtros específicos según el tipo de track
    switch (track.type) {
      case 'video':
        // Combinar clips de video del track
        if (track.clips.length > 1) {
          filters.push(this.buildVideoMixFilter(track, trackIndex));
        }
        break;
      case 'audio':
        // Mezclar clips de audio del track
        if (track.clips.length > 1) {
          filters.push(this.buildAudioMixFilter(track, trackIndex));
        }
        break;
    }

    return filters;
  }

  /**
   * Filtro de mezcla de video
   */
  buildVideoMixFilter(track, trackIndex) {
    const inputs = track.clips.map((_, clipIndex) => `[t${trackIndex}c${clipIndex}_video]`).join('');
    const output = `[track${trackIndex}_video]`;
    
    // Para simplificar, usar overlay secuencial
    return `${inputs}overlay${output}`;
  }

  /**
   * Filtro de mezcla de audio
   */
  buildAudioMixFilter(track, trackIndex) {
    const inputs = track.clips.map((_, clipIndex) => `[t${trackIndex}c${clipIndex}_audio]`).join('');
    const output = `[track${trackIndex}_audio]`;
    
    return `${inputs}amix=inputs=${track.clips.length}${output}`;
  }

  /**
   * Construir filtros de composición final
   */
  buildCompositionFilters(tracks) {
    const filters = [];

    // Separar tracks por tipo
    const videoTracks = tracks.filter(t => t.type === 'video' || t.type === 'background' || t.type === 'text');
    const audioTracks = tracks.filter(t => t.type === 'audio');

    // Componer video
    if (videoTracks.length > 0) {
      const videoComposition = this.buildVideoComposition(videoTracks);
      filters.push(...videoComposition);
    }

    // Componer audio
    if (audioTracks.length > 0) {
      const audioComposition = this.buildAudioComposition(audioTracks);
      filters.push(...audioComposition);
    }

    return filters;
  }

  /**
   * Construir composición de video
   */
  buildVideoComposition(videoTracks) {
    const filters = [];
    
    if (videoTracks.length === 1) {
      // Un solo track de video
      const trackIndex = videoTracks[0].index || 0;
      filters.push(`[track${trackIndex}_video]copy[video_out]`);
    } else {
      // Múltiples tracks de video - overlay
      let currentLabel = '[track0_video]';
      
      for (let i = 1; i < videoTracks.length; i++) {
        const trackIndex = videoTracks[i].index || i;
        const outputLabel = i === videoTracks.length - 1 ? '[video_out]' : `[video_comp${i}]`;
        
        filters.push(`${currentLabel}[track${trackIndex}_video]overlay${outputLabel}`);
        currentLabel = outputLabel;
      }
    }

    return filters;
  }

  /**
   * Construir composición de audio
   */
  buildAudioComposition(audioTracks) {
    const filters = [];
    
    if (audioTracks.length === 1) {
      // Un solo track de audio
      const trackIndex = audioTracks[0].index || 0;
      filters.push(`[track${trackIndex}_audio]acopy[audio_out]`);
    } else {
      // Múltiples tracks de audio - mix
      const inputs = audioTracks.map((_, i) => `[track${i}_audio]`).join('');
      filters.push(`${inputs}amix=inputs=${audioTracks.length}[audio_out]`);
    }

    return filters;
  }

  /**
   * Construir salidas
   */
  buildOutputs(timeline) {
    const outputs = [];

    // Salida de video
    outputs.push({
      label: '[video_out]',
      type: 'video',
      codec: 'libx264',
      options: ['-pix_fmt', 'yuv420p']
    });

    // Salida de audio (si hay tracks de audio)
    const hasAudio = timeline.tracks.some(t => t.type === 'audio');
    if (hasAudio) {
      outputs.push({
        label: '[audio_out]',
        type: 'audio',
        codec: 'aac',
        options: ['-ar', '48000', '-ac', '2']
      });
    }

    return outputs;
  }

  /**
   * Optimizar grafo de filtros
   */
  optimizeFilterGraph(filterGraph) {
    // Eliminar filtros redundantes
    const optimizedFilters = this.removeRedundantFilters(filterGraph.filters);
    
    // Combinar filtros compatibles
    const combinedFilters = this.combineCompatibleFilters(optimizedFilters);
    
    // Reordenar para eficiencia
    const reorderedFilters = this.reorderFilters(combinedFilters);

    return {
      ...filterGraph,
      filters: reorderedFilters,
      metadata: {
        ...filterGraph.metadata,
        optimized: true,
        originalFilterCount: filterGraph.filters.length,
        optimizedFilterCount: reorderedFilters.length,
        optimizationRatio: reorderedFilters.length / filterGraph.filters.length
      }
    };
  }

  /**
   * Remover filtros redundantes
   */
  removeRedundantFilters(filters) {
    const seen = new Set();
    return filters.filter(filter => {
      if (seen.has(filter)) {
        return false;
      }
      seen.add(filter);
      return true;
    });
  }

  /**
   * Combinar filtros compatibles
   */
  combineCompatibleFilters(filters) {
    // Implementación básica - agrupar filtros del mismo tipo
    const grouped = {};
    
    filters.forEach(filter => {
      const type = this.getFilterType(filter);
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(filter);
    });

    // Combinar filtros del mismo tipo cuando sea posible
    const combined = [];
    Object.values(grouped).forEach(group => {
      if (group.length === 1) {
        combined.push(...group);
      } else {
        // Para simplificar, usar todos los filtros
        combined.push(...group);
      }
    });

    return combined;
  }

  /**
   * Reordenar filtros para eficiencia
   */
  reorderFilters(filters) {
    // Ordenar por prioridad: inputs -> transformaciones -> efectos -> outputs
    const priority = {
      'color': 1,
      'scale': 2,
      'rotate': 3,
      'crop': 4,
      'eq': 5,
      'gblur': 6,
      'overlay': 7,
      'drawtext': 8,
      'copy': 9
    };

    return [...filters].sort((a, b) => {
      const typeA = this.getFilterType(a);
      const typeB = this.getFilterType(b);
      
      const priorityA = priority[typeA] || 5;
      const priorityB = priority[typeB] || 5;
      
      return priorityA - priorityB;
    });
  }

  /**
   * Obtener tipo de filtro
   */
  getFilterType(filter) {
    if (filter.includes('color=')) return 'color';
    if (filter.includes('scale=')) return 'scale';
    if (filter.includes('rotate=')) return 'rotate';
    if (filter.includes('crop=')) return 'crop';
    if (filter.includes('eq=')) return 'eq';
    if (filter.includes('gblur=')) return 'gblur';
    if (filter.includes('overlay')) return 'overlay';
    if (filter.includes('drawtext=')) return 'drawtext';
    if (filter.includes('copy')) return 'copy';
    
    return 'unknown';
  }

  /**
   * Escapar texto para FFmpeg
   */
  escapeText(text) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  /**
   * Contar clips totales
   */
  countTotalClips(tracks) {
    return tracks.reduce((total, track) => total + track.clips.length, 0);
  }

  /**
   * Generar comando FFmpeg desde el grafo de filtros
   */
  generateFFmpegCommand(filterGraph, inputs, output) {
    const command = [];
    
    // Agregar inputs
    filterGraph.inputs.forEach(input => {
      command.push('-i', input.src);
    });

    // Agregar filtro complejo
    if (filterGraph.filters.length > 0) {
      const filterString = filterGraph.filters.join(';');
      command.push('-filter_complex', filterString);
    }

    // Agregar mapeos de salida
    filterGraph.outputs.forEach(output => {
      command.push('-map', output.label);
      if (output.codec) {
        command.push(`-c:${output.type.charAt(0)}`, output.codec);
      }
      if (output.options) {
        command.push(...output.options);
      }
    });

    // Archivo de salida
    command.push(output);

    return command;
  }
}

module.exports = FilterBuilder; 