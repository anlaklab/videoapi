const logger = require('../utils/logger');
const FilterProcessor = require('./filterProcessor');

class TransitionProcessor {
  constructor() {
    this.filterProcessor = new FilterProcessor();
    this.supportedTransitions = [
      'fade', 'crossfade', 'slide', 'wipe', 'dissolve', 'zoom', 'rotate', 'push'
    ];
  }

  /**
   * Procesa transiciones entre clips en un track
   */
  processTrackTransitions(track, trackIndex, totalDuration) {
    const transitions = [];
    const clips = track.clips || [];
    
    // Detectar transiciones automáticas entre clips adyacentes
    for (let i = 0; i < clips.length - 1; i++) {
      const currentClip = clips[i];
      const nextClip = clips[i + 1];
      
      const currentEnd = currentClip.start + currentClip.duration;
      const nextStart = nextClip.start;
      
      // Si hay solapamiento o están muy cerca, crear transición
      if (nextStart <= currentEnd + 0.5) {
        const transition = this.createAutoTransition(currentClip, nextClip, i);
        if (transition) {
          transitions.push(transition);
        }
      }
    }
    
    // Agregar transiciones explícitas del timeline
    if (track.transitions) {
      track.transitions.forEach((transition, index) => {
        transitions.push({
          ...transition,
          id: `explicit_${trackIndex}_${index}`,
          explicit: true
        });
      });
    }
    
    return transitions;
  }

  /**
   * Crea una transición automática entre dos clips
   */
  createAutoTransition(clipA, clipB, index) {
    const endA = clipA.start + clipA.duration;
    const startB = clipB.start;
    
    // Calcular duración de la transición
    const overlapDuration = Math.max(0, endA - startB);
    const transitionDuration = overlapDuration > 0 ? overlapDuration : 0.5;
    
    // Elegir tipo de transición basado en los tipos de clip
    let transitionType = 'crossfade'; // Default
    
    if (clipA.type === 'text' && clipB.type === 'text') {
      transitionType = 'fade';
    } else if (clipA.type === 'image' && clipB.type === 'image') {
      transitionType = 'dissolve';
    } else if (clipA.type === 'video' && clipB.type === 'video') {
      transitionType = 'crossfade';
    }
    
    return {
      id: `auto_${index}`,
      type: transitionType,
      duration: Math.min(transitionDuration, 2.0), // Max 2 segundos
      start: Math.max(endA - transitionDuration, startB),
      clipA: clipA,
      clipB: clipB,
      easing: 'ease-in-out',
      automatic: true
    };
  }

  /**
   * Construye filtros FFmpeg para transiciones
   */
  buildTransitionFilters(transitions, clips, trackIndex) {
    const filters = [];
    const processedClips = new Set();
    
    transitions.forEach((transition, index) => {
      try {
        const transitionFilter = this.buildSingleTransition(transition, trackIndex, index);
        if (transitionFilter) {
          filters.push(transitionFilter);
          
          // Marcar clips como procesados
          if (transition.clipA) processedClips.add(transition.clipA);
          if (transition.clipB) processedClips.add(transition.clipB);
        }
      } catch (error) {
        logger.error(`Error building transition ${transition.id}:`, error);
      }
    });
    
    return { filters, processedClips };
  }

  /**
   * Construye una transición individual
   */
  buildSingleTransition(transition, trackIndex, transitionIndex) {
    const { type, duration, start, easing = 'ease-in-out' } = transition;
    
    switch (type) {
      case 'fade':
        return this.buildFadeTransition(transition, trackIndex, transitionIndex);
      case 'crossfade':
        return this.buildCrossfadeTransition(transition, trackIndex, transitionIndex);
      case 'slide':
        return this.buildSlideTransition(transition, trackIndex, transitionIndex);
      case 'wipe':
        return this.buildWipeTransition(transition, trackIndex, transitionIndex);
      case 'dissolve':
        return this.buildDissolveTransition(transition, trackIndex, transitionIndex);
      case 'zoom':
        return this.buildZoomTransition(transition, trackIndex, transitionIndex);
      case 'rotate':
        return this.buildRotateTransition(transition, trackIndex, transitionIndex);
      case 'push':
        return this.buildPushTransition(transition, trackIndex, transitionIndex);
      default:
        logger.warn(`Unsupported transition type: ${type}`);
        return null;
    }
  }

  buildFadeTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, easing } = transition;
    const end = start + duration;
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[fade_${trackIndex}_${transitionIndex}]`,
      filter: `fade=t=in:st=${start}:d=${duration},fade=t=out:st=${end - duration}:d=${duration}`,
      timing: { start, duration, end }
    };
  }

  buildCrossfadeTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, clipA, clipB } = transition;
    
    if (!clipA || !clipB) {
      logger.warn('Crossfade transition requires two clips');
      return null;
    }
    
    // Crear filtros para ambos clips
    const fadeOutA = `fade=t=out:st=${start}:d=${duration}`;
    const fadeInB = `fade=t=in:st=${start}:d=${duration}`;
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[crossfade_${trackIndex}_${transitionIndex}]`,
      filter: `split=2[a][b];[a]${fadeOutA}[fade_out];[b]${fadeInB}[fade_in];[fade_out][fade_in]overlay`,
      timing: { start, duration, end: start + duration },
      complex: true
    };
  }

  buildSlideTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, direction = 'left', easing } = transition;
    const easingFunc = this.getEasingFunction(easing);
    
    let slideFilter;
    switch (direction) {
      case 'left':
        slideFilter = `crop=iw:ih:'iw*(1-${easingFunc})':0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'right':
        slideFilter = `crop=iw:ih:'iw*${easingFunc}':0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'up':
        slideFilter = `crop=iw:ih:0:'ih*(1-${easingFunc})':enable='between(t,${start},${start + duration})'`;
        break;
      case 'down':
        slideFilter = `crop=iw:ih:0:'ih*${easingFunc}':enable='between(t,${start},${start + duration})'`;
        break;
      default:
        slideFilter = `crop=iw:ih:'iw*(1-${easingFunc})':0:enable='between(t,${start},${start + duration})'`;
    }
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[slide_${trackIndex}_${transitionIndex}]`,
      filter: slideFilter,
      timing: { start, duration, end: start + duration }
    };
  }

  buildWipeTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, direction = 'left' } = transition;
    
    let wipeFilter;
    switch (direction) {
      case 'left':
        wipeFilter = `crop='iw*t/${duration}':ih:0:0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'right':
        wipeFilter = `crop='iw*(1-t/${duration})':ih:'iw*t/${duration}':0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'up':
        wipeFilter = `crop=iw:'ih*t/${duration}':0:0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'down':
        wipeFilter = `crop=iw:'ih*(1-t/${duration})':0:'ih*t/${duration}':enable='between(t,${start},${start + duration})'`;
        break;
      default:
        wipeFilter = `crop='iw*t/${duration}':ih:0:0:enable='between(t,${start},${start + duration})'`;
    }
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[wipe_${trackIndex}_${transitionIndex}]`,
      filter: wipeFilter,
      timing: { start, duration, end: start + duration }
    };
  }

  buildDissolveTransition(transition, trackIndex, transitionIndex) {
    const { start, duration } = transition;
    
    // Usar noise para crear efecto de disolución
    const dissolveFilter = `noise=alls=20:allf=t+u,format=yuva420p,colorchannelmixer=aa='1-t/${duration}':enable='between(t,${start},${start + duration})'`;
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[dissolve_${trackIndex}_${transitionIndex}]`,
      filter: dissolveFilter,
      timing: { start, duration, end: start + duration }
    };
  }

  buildZoomTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, direction = 'in', easing } = transition;
    const easingFunc = this.getEasingFunction(easing);
    
    let zoomFilter;
    if (direction === 'in') {
      zoomFilter = `scale='iw*(1+${easingFunc})':'ih*(1+${easingFunc})':enable='between(t,${start},${start + duration})'`;
    } else {
      zoomFilter = `scale='iw*(2-${easingFunc})':'ih*(2-${easingFunc})':enable='between(t,${start},${start + duration})'`;
    }
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[zoom_${trackIndex}_${transitionIndex}]`,
      filter: zoomFilter,
      timing: { start, duration, end: start + duration }
    };
  }

  buildRotateTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, angle = 360 } = transition;
    
    const rotateFilter = `rotate='${angle}*PI/180*t/${duration}':fillcolor=black@0:enable='between(t,${start},${start + duration})'`;
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[rotate_${trackIndex}_${transitionIndex}]`,
      filter: rotateFilter,
      timing: { start, duration, end: start + duration }
    };
  }

  buildPushTransition(transition, trackIndex, transitionIndex) {
    const { start, duration, direction = 'left', clipA, clipB } = transition;
    
    if (!clipA || !clipB) {
      logger.warn('Push transition requires two clips');
      return null;
    }
    
    let pushFilter;
    switch (direction) {
      case 'left':
        pushFilter = `overlay='w*t/${duration}':0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'right':
        pushFilter = `overlay='-w*t/${duration}':0:enable='between(t,${start},${start + duration})'`;
        break;
      case 'up':
        pushFilter = `overlay=0:'h*t/${duration}':enable='between(t,${start},${start + duration})'`;
        break;
      case 'down':
        pushFilter = `overlay=0:'-h*t/${duration}':enable='between(t,${start},${start + duration})'`;
        break;
      default:
        pushFilter = `overlay='w*t/${duration}':0:enable='between(t,${start},${start + duration})'`;
    }
    
    return {
      input: `[layer_${trackIndex}]`,
      output: `[push_${trackIndex}_${transitionIndex}]`,
      filter: pushFilter,
      timing: { start, duration, end: start + duration },
      complex: true
    };
  }

  /**
   * Obtiene función de easing para FFmpeg
   */
  getEasingFunction(easing) {
    switch (easing) {
      case 'ease-in':
        return 'pow(t,2)';
      case 'ease-out':
        return '1-pow(1-t,2)';
      case 'ease-in-out':
        return 'if(lt(t,0.5),2*pow(t,2),1-2*pow(1-t,2))';
      case 'bounce':
        return 'if(lt(t,0.36),7.5625*pow(t,2),if(lt(t,0.73),7.5625*pow(t-0.545,2)+0.75,if(lt(t,0.9),7.5625*pow(t-0.818,2)+0.9375,7.5625*pow(t-0.955,2)+0.984375)))';
      case 'elastic':
        return 'pow(2,-10*t)*sin((t-0.075)*2*PI/0.3)+1';
      case 'linear':
      default:
        return 't';
    }
  }

  /**
   * Valida configuración de transición
   */
  validateTransition(transition) {
    const errors = [];
    
    if (!transition.type) {
      errors.push('Transition type is required');
    } else if (!this.supportedTransitions.includes(transition.type)) {
      errors.push(`Unsupported transition type: ${transition.type}`);
    }
    
    if (transition.duration !== undefined) {
      if (typeof transition.duration !== 'number' || transition.duration <= 0) {
        errors.push('Transition duration must be a positive number');
      }
      if (transition.duration > 10) {
        errors.push('Transition duration cannot exceed 10 seconds');
      }
    }
    
    if (transition.start !== undefined) {
      if (typeof transition.start !== 'number' || transition.start < 0) {
        errors.push('Transition start time must be a non-negative number');
      }
    }
    
    // Validaciones específicas por tipo
    if (transition.type === 'slide' || transition.type === 'wipe' || transition.type === 'push') {
      const validDirections = ['left', 'right', 'up', 'down'];
      if (transition.direction && !validDirections.includes(transition.direction)) {
        errors.push(`Invalid direction for ${transition.type} transition. Valid options: ${validDirections.join(', ')}`);
      }
    }
    
    if (transition.type === 'zoom') {
      const validDirections = ['in', 'out'];
      if (transition.direction && !validDirections.includes(transition.direction)) {
        errors.push(`Invalid direction for zoom transition. Valid options: ${validDirections.join(', ')}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtiene transiciones disponibles con sus parámetros
   */
  getAvailableTransitions() {
    return [
      {
        type: 'fade',
        description: 'Fade in/out effect',
        parameters: ['duration', 'easing']
      },
      {
        type: 'crossfade',
        description: 'Cross-fade between two clips',
        parameters: ['duration', 'easing']
      },
      {
        type: 'slide',
        description: 'Slide transition',
        parameters: ['duration', 'direction', 'easing']
      },
      {
        type: 'wipe',
        description: 'Wipe transition',
        parameters: ['duration', 'direction']
      },
      {
        type: 'dissolve',
        description: 'Dissolve effect with noise',
        parameters: ['duration']
      },
      {
        type: 'zoom',
        description: 'Zoom in/out transition',
        parameters: ['duration', 'direction', 'easing']
      },
      {
        type: 'rotate',
        description: 'Rotation transition',
        parameters: ['duration', 'angle']
      },
      {
        type: 'push',
        description: 'Push transition between clips',
        parameters: ['duration', 'direction']
      }
    ];
  }

  /**
   * Optimiza transiciones para evitar conflictos
   */
  optimizeTransitions(transitions) {
    // Ordenar por tiempo de inicio
    const sorted = transitions.sort((a, b) => a.start - b.start);
    const optimized = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      // Verificar solapamiento con la siguiente transición
      if (next && current.start + current.duration > next.start) {
        // Ajustar duración para evitar solapamiento
        current.duration = Math.max(0.1, next.start - current.start);
        logger.warn(`Adjusted transition duration to avoid overlap: ${current.id}`);
      }
      
      optimized.push(current);
    }
    
    return optimized;
  }
}

module.exports = TransitionProcessor; 