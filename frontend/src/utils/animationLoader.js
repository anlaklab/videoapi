/**
 * Animation Loader - Dynamic and Robust Animation Loading System
 * 
 * Loads animations dynamically from file structure with:
 * - FFmpeg integration support
 * - JSON Schema validation
 * - Thumbnail management
 * - Category organization
 * - Error handling and fallbacks
 */

import iconMap from './iconMap';

// Animation JSON Schema for validation
const ANIMATION_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "category", "ffmpeg", "thumbnail"],
  "properties": {
    "version": { "type": "string" },
    "id": { "type": "string" },
    "name": { "type": "string" },
    "category": { "type": "string", "enum": ["camera", "transform", "effects"] },
    "description": { "type": "string" },
    "icon": { "type": "string" },
    "thumbnail": { "type": "string" },
    "author": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string" }
      }
    },
    "compatibility": {
      "type": "object",
      "properties": {
        "ffmpeg": { "type": "string" },
        "web": { "type": "boolean" },
        "minVersion": { "type": "string" }
      }
    },
    "ffmpeg": {
      "type": "object",
      "required": ["filter", "parameters"],
      "properties": {
        "filter": { "type": "string" },
        "parameters": { 
          "type": "object",
          "properties": {
            "duration": { "type": "number", "minimum": 0.1, "maximum": 300 },
            "fps": { "type": "number", "minimum": 1, "maximum": 120 },
            "easing": { "type": "string", "enum": ["linear", "easeIn", "easeOut", "easeInOut", "bounce", "elastic"] }
          }
        }
      }
    },
    "ui": {
      "type": "object",
      "properties": {
        "gradient": { "type": "string" },
        "color": { "type": "string" },
        "previewDuration": { "type": "number" }
      }
    }
  }
};

// Default animations fallback (embedded)
const DEFAULT_ANIMATIONS = {
  camera: [
    {
      id: "ken-burns",
      name: "Ken Burns",
      category: "camera",
      description: "Classic cinematic effect with zoom and pan",
      icon: "Camera",
      thumbnail: "/animations/camera/ken-burns/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true,
        minVersion: "4.3"
      },
      ffmpeg: {
        filter: "zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1920x1080",
        parameters: {
          duration: 5,
          fps: 25,
          zoomStart: 1.0,
          zoomEnd: 1.2,
          xStart: 0,
          yStart: 0,
          xEnd: -50,
          yEnd: -30,
          easing: "easeOut"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #667eea, #764ba2)",
        previewDuration: 2
      }
    },
    {
      id: "camera-shake",
      name: "Camera Shake",
      category: "camera",
      description: "Handheld camera shake effect",
      icon: "Vibrate",
      thumbnail: "/animations/camera/camera-shake/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "vidstabdetect=stepsize=4:shakiness=8:accuracy=9:result=transforms.trf,vidstabtransform=input=transforms.trf:zoom=0:smoothing=10",
        parameters: {
          duration: 3,
          intensity: 0.02,
          frequency: 8,
          easing: "linear"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #ff6b6b, #ffa726)"
      }
    },
    {
      id: "dolly-zoom",
      name: "Dolly Zoom",
      category: "camera",
      description: "Vertigo effect with counter-zoom",
      icon: "Focus",
      thumbnail: "/animations/camera/dolly-zoom/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "zoompan=z='if(lte(zoom,1.0),1.5-0.5*on/25,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125",
        parameters: {
          duration: 4,
          zoomDirection: "in",
          intensity: 0.5,
          easing: "easeInOut"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #4facfe, #00f2fe)"
      }
    }
  ],
  transform: [
    {
      id: "zoom-in",
      name: "Zoom In",
      category: "transform",
      description: "Smooth zoom in animation",
      icon: "ZoomIn",
      thumbnail: "/animations/transform/zoom-in/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "scale=w='iw*min(1+(t/duration)*0.2,1.2)':h='ih*min(1+(t/duration)*0.2,1.2)':eval=frame",
        parameters: {
          duration: 2,
          scale: 1.2,
          centerX: 0.5,
          centerY: 0.5,
          easing: "easeOut"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #a8edea, #fed6e3)"
      }
    },
    {
      id: "zoom-out",
      name: "Zoom Out",
      category: "transform",
      description: "Smooth zoom out animation",
      icon: "ZoomOut",
      thumbnail: "/animations/transform/zoom-out/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "scale=w='iw*max(1-(t/duration)*0.2,0.8)':h='ih*max(1-(t/duration)*0.2,0.8)':eval=frame",
        parameters: {
          duration: 2,
          scale: 0.8,
          centerX: 0.5,
          centerY: 0.5,
          easing: "easeIn"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #ffecd2, #fcb69f)"
      }
    },
    {
      id: "rotation",
      name: "Rotation",
      category: "transform",
      description: "Smooth rotation animation",
      icon: "RotateCw",
      thumbnail: "/animations/transform/rotation/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "rotate='2*PI*t/duration':fillcolor=black:eval=frame",
        parameters: {
          duration: 3,
          angle: 360,
          direction: "clockwise",
          easing: "linear"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #a18cd1, #fbc2eb)"
      }
    },
    {
      id: "slide-reveal",
      name: "Slide Reveal",
      category: "transform",
      description: "Slide-in reveal effect",
      icon: "ArrowRight",
      thumbnail: "/animations/transform/slide-reveal/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "crop=w='iw*min(t/duration,1)':h=ih:x=0:y=0",
        parameters: {
          duration: 1.5,
          direction: "left",
          easing: "easeOut"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #fa709a, #fee140)"
      }
    }
  ],
  effects: [
    {
      id: "parallax",
      name: "Parallax",
      category: "effects",
      description: "Multi-layer parallax scrolling",
      icon: "Layers",
      thumbnail: "/animations/effects/parallax/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "overlay=x='t*50':y=0:enable='between(t,0,duration)'",
        parameters: {
          duration: 4,
          speed: 50,
          layers: 3,
          easing: "linear"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #667eea, #764ba2)"
      }
    },
    {
      id: "morph",
      name: "Morph",
      category: "effects",
      description: "Shape morphing transition",
      icon: "Shuffle",
      thumbnail: "/animations/effects/morph/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: false
      },
      ffmpeg: {
        filter: "blend=all_mode=difference:all_opacity=0.5",
        parameters: {
          duration: 2,
          intensity: 0.7,
          easing: "easeInOut"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #ff9a9e, #fecfef)"
      }
    },
    {
      id: "glitch",
      name: "Glitch",
      category: "effects",
      description: "Digital glitch distortion",
      icon: "Zap",
      thumbnail: "/animations/effects/glitch/thumbnail.jpg",
      version: "1.0.0",
      compatibility: {
        ffmpeg: ">=4.3",
        web: true
      },
      ffmpeg: {
        filter: "noise=alls=20:allf=t+u,hue=h=sin(2*PI*t)*360:s=sin(2*PI*t)+1",
        parameters: {
          duration: 1,
          intensity: 0.3,
          frequency: 10,
          easing: "linear"
        }
      },
      ui: {
        gradient: "linear-gradient(45deg, #ff6b6b, #4ecdc4)"
      }
    }
  ]
};

/**
 * Schema validation using a simple validator
 */
const validateAnimationSchema = (animation) => {
  const errors = [];
  
  // Required fields validation
  const required = ["id", "name", "category", "ffmpeg", "thumbnail"];
  for (const field of required) {
    if (!animation[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Category validation
  if (animation.category && !["camera", "transform", "effects"].includes(animation.category)) {
    errors.push(`Invalid category: ${animation.category}`);
  }
  
  // FFmpeg validation
  if (animation.ffmpeg) {
    if (!animation.ffmpeg.filter) {
      errors.push("Missing FFmpeg filter");
    }
    if (!animation.ffmpeg.parameters) {
      errors.push("Missing FFmpeg parameters");
    }
  }
  
  return errors;
};

/**
 * Load animations from dynamic file structure
 * Supports both dynamic imports and fallback to defaults
 */
export const loadAnimations = async () => {
  const animations = { camera: [], transform: [], effects: [] };
  let loadedCount = 0;
  let errorCount = 0;
  
  try {
    // Try to load from dynamic file structure (Vite/Webpack)
    if (typeof import.meta !== 'undefined' && import.meta.glob) {
      const animationFiles = import.meta.glob('/animations/**/animation.json', { eager: false });
      
      for (const path in animationFiles) {
        try {
          const pathSegments = path.split('/');
          const category = pathSegments[2];
          const animationFolder = pathSegments[3];
          
          const animationModule = await animationFiles[path]();
          const animationData = animationModule.default;
          
          // Validate schema
          const validationErrors = validateAnimationSchema(animationData);
          if (validationErrors.length > 0) {
            console.warn(`Animation validation failed for ${path}:`, validationErrors);
            errorCount++;
            continue;
          }
          
          // Construct full URL for thumbnail
          animationData.thumbnail = `/animations/${category}/${animationFolder}/${animationData.thumbnail}`;
          
          // Add icon component reference
          if (animationData.icon && iconMap[animationData.icon]) {
            animationData.iconComponent = iconMap[animationData.icon];
          }
          
          // Add to appropriate category
          if (animations[category]) {
            animations[category].push(animationData);
            loadedCount++;
          }
          
        } catch (error) {
          console.error(`Failed to load animation from ${path}:`, error);
          errorCount++;
        }
      }
    }
  } catch (error) {
    console.warn('Dynamic loading failed, using default animations:', error);
  }
  
  // Fallback to default animations if dynamic loading failed or no animations found
  if (loadedCount === 0) {
    console.log('Using default embedded animations');
    
    Object.keys(DEFAULT_ANIMATIONS).forEach(category => {
      DEFAULT_ANIMATIONS[category].forEach(animation => {
        // Add icon component reference
        if (animation.icon && iconMap[animation.icon]) {
          animation.iconComponent = iconMap[animation.icon];
        }
        
        animations[category].push(animation);
        loadedCount++;
      });
    });
  }
  
  console.log(`✅ Animation Loader: ${loadedCount} animations loaded, ${errorCount} errors`);
  
  return {
    animations,
    stats: {
      loaded: loadedCount,
      errors: errorCount,
      categories: Object.keys(animations).length,
      source: loadedCount > 0 && errorCount === 0 ? 'dynamic' : 'fallback'
    }
  };
};

/**
 * Get animation by ID across all categories
 */
export const getAnimationById = (animations, animationId) => {
  for (const category of Object.keys(animations)) {
    const animation = animations[category].find(anim => anim.id === animationId);
    if (animation) {
      return animation;
    }
  }
  return null;
};

/**
 * Generate FFmpeg command for animation
 */
export const generateFFmpegCommand = (animation, inputFile, outputFile, customParams = {}) => {
  if (!animation.ffmpeg) {
    throw new Error(`Animation ${animation.id} has no FFmpeg configuration`);
  }
  
  const params = { ...animation.ffmpeg.parameters, ...customParams };
  let filter = animation.ffmpeg.filter;
  
  // Replace parameter placeholders in filter
  Object.keys(params).forEach(key => {
    const placeholder = new RegExp(`\\b${key}\\b`, 'g');
    filter = filter.replace(placeholder, params[key]);
  });
  
  return `ffmpeg -i "${inputFile}" -vf "${filter}" -c:a copy "${outputFile}"`;
};

/**
 * Validate FFmpeg compatibility
 */
export const validateFFmpegCompatibility = (animation, ffmpegVersion = "4.3") => {
  if (!animation.compatibility || !animation.compatibility.ffmpeg) {
    return { compatible: true, warnings: [] };
  }
  
  const requiredVersion = animation.compatibility.ffmpeg.replace('>=', '');
  const warnings = [];
  
  // Simple version comparison (would need semver for production)
  const isCompatible = parseFloat(ffmpegVersion) >= parseFloat(requiredVersion);
  
  if (!isCompatible) {
    warnings.push(`Requires FFmpeg ${animation.compatibility.ffmpeg}, found ${ffmpegVersion}`);
  }
  
  if (!animation.compatibility.web && typeof window !== 'undefined') {
    warnings.push('This animation is not optimized for web playback');
  }
  
  return {
    compatible: isCompatible,
    warnings
  };
};

/**
 * Create animation thumbnails programmatically
 */
export const generateAnimationThumbnail = async (animation, size = { width: 150, height: 100 }) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = size.width;
  canvas.height = size.height;
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, size.width, size.height);
  if (animation.ui && animation.ui.gradient) {
    // Parse CSS gradient (simplified)
    const gradientMatch = animation.ui.gradient.match(/linear-gradient\(.*?,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i);
    if (gradientMatch) {
      gradient.addColorStop(0, gradientMatch[1]);
      gradient.addColorStop(1, gradientMatch[2]);
    } else {
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
    }
  } else {
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.width, size.height);
  
  // Add animation name
  ctx.fillStyle = 'white';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(animation.name, size.width / 2, size.height / 2);
  
  return canvas.toDataURL('image/jpeg', 0.8);
};

export default {
  loadAnimations,
  getAnimationById,
  generateFFmpegCommand,
  validateFFmpegCompatibility,
  generateAnimationThumbnail,
  DEFAULT_ANIMATIONS,
  ANIMATION_SCHEMA
}; 