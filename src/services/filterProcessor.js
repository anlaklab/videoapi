const logger = require('../utils/logger');

class FilterProcessor {
  constructor() {
    this.filterMap = {
      'grayscale': this.buildGrayscaleFilter,
      'sepia': this.buildSepiaFilter,
      'blur': this.buildBlurFilter,
      'brightness': this.buildBrightnessFilter,
      'contrast': this.buildContrastFilter,
      'saturation': this.buildSaturationFilter,
      'hue': this.buildHueFilter,
      'chromakey': this.buildChromakeyFilter
    };
  }

  buildFilterChain(filters) {
    if (!filters || filters.length === 0) {
      return 'null';
    }

    const filterStrings = filters.map(filter => this.buildSingleFilter(filter));
    return filterStrings.filter(f => f !== null).join(',');
  }

  buildSingleFilter(filter) {
    const filterBuilder = this.filterMap[filter.type];
    if (!filterBuilder) {
      logger.warn(`Unknown filter type: ${filter.type}`);
      return null;
    }

    try {
      return filterBuilder.call(this, filter);
    } catch (error) {
      logger.error(`Error building filter ${filter.type}:`, error);
      return null;
    }
  }

  buildGrayscaleFilter(filter) {
    // Convert to grayscale with optional intensity
    const intensity = filter.intensity / 100;
    if (intensity >= 1) {
      return 'colorchannelmixer=.299:.587:.114:0:.299:.587:.114:0:.299:.587:.114';
    } else {
      // Partial grayscale using saturation
      return `hue=s=${1 - intensity}`;
    }
  }

  buildSepiaFilter(filter) {
    const intensity = filter.intensity / 100;
    // Sepia tone matrix
    const r = 0.393 * intensity + 1 * (1 - intensity);
    const g = 0.769 * intensity;
    const b = 0.189 * intensity;
    
    return `colorchannelmixer=${r}:${g}:${b}:0:${r}:${g}:${b}:0:${r}:${g}:${b}`;
  }

  buildBlurFilter(filter) {
    // Gaussian blur - intensity maps to blur radius
    const radius = (filter.intensity / 100) * 10; // Max blur radius of 10
    return `gblur=sigma=${radius}`;
  }

  buildBrightnessFilter(filter) {
    // Brightness adjustment: -1 to +1 range
    const brightness = ((filter.intensity - 50) / 50) * 0.5; // -0.5 to +0.5
    return `eq=brightness=${brightness}`;
  }

  buildContrastFilter(filter) {
    // Contrast adjustment: 0.5 to 2.0 range
    const contrast = 0.5 + (filter.intensity / 100) * 1.5;
    return `eq=contrast=${contrast}`;
  }

  buildSaturationFilter(filter) {
    // Saturation adjustment: 0 to 2.0 range
    const saturation = (filter.intensity / 100) * 2;
    return `eq=saturation=${saturation}`;
  }

  buildHueFilter(filter) {
    // Hue shift: -180 to +180 degrees
    const hueShift = ((filter.intensity - 50) / 50) * 180;
    return `hue=h=${hueShift}`;
  }

  buildChromakeyFilter(filter) {
    if (!filter.color) {
      throw new Error('Chroma key filter requires a color parameter');
    }

    // Convert hex color to RGB
    const rgb = this.hexToRgb(filter.color);
    if (!rgb) {
      throw new Error(`Invalid color format: ${filter.color}`);
    }

    const threshold = (filter.threshold || 10) / 100;
    const smoothing = (filter.smoothing || 5) / 100;

    // Build chromakey filter
    // This creates a complex filter for green screen removal
    return `chromakey=color=${filter.color}:similarity=${threshold}:blend=${smoothing}`;
  }

  buildCustomFilter(filterString) {
    // Allow custom FFmpeg filter strings
    return filterString;
  }

  buildTransitionFilter(transition, progress) {
    switch (transition.type) {
      case 'fade':
        return this.buildFadeTransition(transition, progress);
      case 'slide':
        return this.buildSlideTransition(transition, progress);
      case 'wipe':
        return this.buildWipeTransition(transition, progress);
      case 'crossfade':
        return this.buildCrossfadeTransition(transition, progress);
      case 'dissolve':
        return this.buildDissolveTransition(transition, progress);
      default:
        return 'null';
    }
  }

  buildFadeTransition(transition, progress) {
    const alpha = this.applyEasing(progress, transition.easing);
    return `fade=t=in:st=0:d=1:alpha=1,format=yuva420p,colorchannelmixer=aa=${alpha}`;
  }

  buildSlideTransition(transition, progress) {
    const slideProgress = this.applyEasing(progress, transition.easing);
    const direction = transition.direction || 'left';
    
    let x = 0, y = 0;
    switch (direction) {
      case 'left':
        x = `iw*(1-${slideProgress})`;
        break;
      case 'right':
        x = `iw*${slideProgress}`;
        break;
      case 'up':
        y = `ih*(1-${slideProgress})`;
        break;
      case 'down':
        y = `ih*${slideProgress}`;
        break;
    }
    
    return `crop=iw:ih:${x}:${y}`;
  }

  buildWipeTransition(transition, progress) {
    const wipeProgress = this.applyEasing(progress, transition.easing);
    const direction = transition.direction || 'left';
    
    let width = 'iw', height = 'ih', x = 0, y = 0;
    
    switch (direction) {
      case 'left':
        width = `iw*${wipeProgress}`;
        break;
      case 'right':
        width = `iw*${wipeProgress}`;
        x = `iw*(1-${wipeProgress})`;
        break;
      case 'up':
        height = `ih*${wipeProgress}`;
        break;
      case 'down':
        height = `ih*${wipeProgress}`;
        y = `ih*(1-${wipeProgress})`;
        break;
    }
    
    return `crop=${width}:${height}:${x}:${y}`;
  }

  buildCrossfadeTransition(transition, progress) {
    const alpha = this.applyEasing(progress, transition.easing);
    return `format=yuva420p,colorchannelmixer=aa=${alpha}`;
  }

  buildDissolveTransition(transition, progress) {
    const dissolveAmount = this.applyEasing(progress, transition.easing);
    // Create a dissolve effect using noise
    return `noise=alls=20:allf=t+u,format=yuva420p,colorchannelmixer=aa=${dissolveAmount}`;
  }

  applyEasing(progress, easing) {
    switch (easing) {
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - Math.pow(1 - progress, 2);
      case 'ease-in-out':
        return progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      case 'linear':
      default:
        return progress;
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  buildComplexFilter(inputs, filters) {
    // Build complex filter graph for multiple inputs and filters
    const filterGraph = [];
    
    inputs.forEach((input, index) => {
      const inputLabel = `[${index}:v]`;
      const outputLabel = `[v${index}]`;
      
      if (filters[index] && filters[index].length > 0) {
        const filterChain = this.buildFilterChain(filters[index]);
        filterGraph.push(`${inputLabel}${filterChain}${outputLabel}`);
      } else {
        filterGraph.push(`${inputLabel}null${outputLabel}`);
      }
    });
    
    return filterGraph.join(';');
  }

  validateFilter(filter) {
    if (!filter.type) {
      throw new Error('Filter type is required');
    }

    if (!this.filterMap[filter.type]) {
      throw new Error(`Unsupported filter type: ${filter.type}`);
    }

    if (filter.intensity !== undefined) {
      if (typeof filter.intensity !== 'number' || filter.intensity < 0 || filter.intensity > 100) {
        throw new Error('Filter intensity must be a number between 0 and 100');
      }
    }

    // Type-specific validations
    if (filter.type === 'chromakey') {
      if (!filter.color) {
        throw new Error('Chroma key filter requires a color parameter');
      }
      if (!this.hexToRgb(filter.color)) {
        throw new Error('Invalid color format for chroma key filter');
      }
    }

    return true;
  }

  getAvailableFilters() {
    return Object.keys(this.filterMap).map(type => ({
      type,
      description: this.getFilterDescription(type),
      parameters: this.getFilterParameters(type)
    }));
  }

  getFilterDescription(type) {
    const descriptions = {
      'grayscale': 'Convert video to grayscale',
      'sepia': 'Apply sepia tone effect',
      'blur': 'Apply Gaussian blur',
      'brightness': 'Adjust brightness levels',
      'contrast': 'Adjust contrast levels',
      'saturation': 'Adjust color saturation',
      'hue': 'Shift color hue',
      'chromakey': 'Remove background color (green screen)'
    };
    return descriptions[type] || 'Unknown filter';
  }

  getFilterParameters(type) {
    const parameters = {
      'grayscale': ['intensity'],
      'sepia': ['intensity'],
      'blur': ['intensity'],
      'brightness': ['intensity'],
      'contrast': ['intensity'],
      'saturation': ['intensity'],
      'hue': ['intensity'],
      'chromakey': ['color', 'threshold', 'smoothing']
    };
    return parameters[type] || [];
  }
}

module.exports = FilterProcessor; 