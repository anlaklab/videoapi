const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const TransitionProcessor = require('./transitionProcessor');
const TemplateManager = require('./templateManager');

class SimpleVideoRenderer {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.outputDir = process.env.OUTPUT_DIR || './output';
    
    // Use environment variable first, then try common paths
    this.ffmpegPath = process.env.FFMPEG_PATH || 
                     (process.platform === 'darwin' ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
    
    this.transitionProcessor = new TransitionProcessor();
    this.templateManager = new TemplateManager();
    
    logger.info(`SimpleVideoRenderer initialized with FFmpeg: ${this.ffmpegPath}`);
  }

  async renderVideo(timeline, outputPath, mergeFields = {}) {
    try {
      logger.info(`Starting enhanced video render session: ${path.basename(outputPath, '.mp4')}`);
      
      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));
      
      // Calculate video parameters
      const resolution = { width: 1920, height: 1080 };
      const duration = this.calculateTotalDuration(timeline);
      const fps = 30;
      
      // Get background color (apply merge fields if needed)
      let backgroundColor = timeline.background?.color || '#000000';
      if (backgroundColor.includes('{{') && backgroundColor.includes('}}')) {
        // Apply merge fields to background color
        Object.entries(mergeFields).forEach(([key, value]) => {
          backgroundColor = backgroundColor.replace(`{{${key}}}`, String(value));
        });
      }
      
      logger.info(`Video parameters: ${resolution.width}x${resolution.height}, ${duration}s, bg: ${backgroundColor}`);

      // Start building FFmpeg command
      const args = ['-y']; // Overwrite output files
      
      // Add background video input
      args.push(
        '-f', 'lavfi',
        '-i', `color=c=${backgroundColor}:size=${resolution.width}x${resolution.height}:duration=${duration}:rate=${fps}`
      );

      // Check if we have multimedia content
      const hasMultimedia = this.hasMultimediaContent(timeline);
      
      if (hasMultimedia) {
        return await this.renderWithMultimedia(timeline, outputPath, args, resolution, duration, mergeFields);
      } else {
        return await this.renderTextOnly(timeline, outputPath, args, resolution, duration, mergeFields);
      }

    } catch (error) {
      logger.error(`Error in video render session ${path.basename(outputPath, '.mp4')}: ${error.message}`);
      throw error;
    }
  }

  hasMultimediaContent(timeline) {
    return timeline.tracks.some(track =>
      track.clips.some(clip => ['image', 'video', 'audio'].includes(clip.type))
    ) || timeline.soundtrack;
  }

  async renderTextOnly(timeline, outputPath, args, resolution, duration, mergeFields) {
    // Add silent audio input immediately after video input
    args.push(
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`
    );

    // Collect all text clips
    const textClips = [];
    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        if (clip.type === 'text') {
          textClips.push(clip);
        }
      });
    });

    if (textClips.length > 0) {
      // Build filter complex for text overlays
      const filters = [];
      let currentInput = '0:v';
      
      textClips.forEach((clip, index) => {
        const text = (clip.text || clip.content || '').replace(/'/g, "\\'");
        const fontSize = clip.fontSize || clip.style?.fontSize || 48;
        const fontColor = clip.color || clip.style?.color || 'white';
        
        // Handle positioning - default to center if not specified
        let x = clip.position?.x || (resolution.width / 2);
        let y = clip.position?.y || (resolution.height / 2);
        
        // If x,y are specified as center values, calculate actual center
        if (x === 960) x = '(w-text_w)/2';  // Center horizontally
        if (y === 540) y = '(h-text_h)/2';  // Center vertically
        
        let filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;
        
        // Add timing if available
        if (clip.start !== undefined && clip.duration !== undefined) {
          const start = clip.start;
          const end = clip.start + clip.duration;
          filter += `:enable='between(t,${start},${end})'`;
        }
        
        const outputLabel = index === textClips.length - 1 ? 'final_video' : `text_${index}`;
        filters.push(`[${currentInput}]${filter}[${outputLabel}]`);
        currentInput = `text_${index}`;
      });

      args.push('-filter_complex', filters.join(';'));
      args.push('-map', '[final_video]');
    } else {
      // No text, just map video directly
      args.push('-map', '0:v');
    }

    // Map audio from second input
    args.push('-map', '1:a');

    // Output settings
    args.push(
      '-c:v', 'libx264',
      '-c:a', 'aac', 
      '-pix_fmt', 'yuv420p',
      '-t', duration.toString(),
      '-shortest',
      outputPath
    );

    logger.info(`Text-only FFmpeg command: ${this.ffmpegPath} ${args.join(' ')}`);

    const result = await this.executeFFmpeg(args);
    
    if (result.success) {
      logger.info(`Text-only video render completed: ${outputPath}`);
      return outputPath;
    } else {
      throw new Error(`FFmpeg failed: ${result.error}`);
    }
  }

  async renderWithMultimedia(timeline, outputPath, args, resolution, duration, mergeFields) {
    // Add multimedia inputs
    const mediaInputs = [];
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        if (['image', 'video'].includes(clip.type) && clip.src) {
          // Validate that the path doesn't have unprocessed placeholders
          if (clip.src.includes('{{') || clip.src.includes('}}')) {
            logger.warn(`Skipping clip with unprocessed merge fields: ${clip.src}`);
            continue;
          }
          
          // Ensure the file path is clean and absolute
          let cleanPath = clip.src;
          
          // Remove any extra braces that might have been added
          cleanPath = cleanPath.replace(/[{}]/g, '');
          
          // Make path absolute if it's relative
          if (!path.isAbsolute(cleanPath)) {
            cleanPath = path.resolve(cleanPath);
          }

          // Check if file exists
          if (!(await fs.pathExists(cleanPath))) {
            logger.error(`Media file not found: ${cleanPath}`);
            continue;
          }

          logger.info(`Adding media input: ${cleanPath} (type: ${clip.type})`);
          args.push('-i', cleanPath);
          mediaInputs.push({
            index: mediaInputs.length + 1, // +1 because background is index 0
            ...clip
          });
        }
      }
    }

    // Add silent audio input after all media inputs
    args.push(
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=48000`
    );
    
    const audioInputIndex = mediaInputs.length + 1; // Audio comes after all media

    // Build complex filter
    const filters = [];
    let currentLayer = '0:v'; // Start with background

    // Process media overlays
    mediaInputs.forEach((input, i) => {
      const scaleFilter = this.buildScaleFilter(input, resolution);
      filters.push(scaleFilter);
      
      const overlayFilter = this.buildOverlayFilter(input, i, currentLayer === '0:v' ? '0:v' : currentLayer.replace(/[\[\]]/g, ''));
      filters.push(overlayFilter);
      
      currentLayer = `layer_${i}`;
    });

    // Add text overlays
    const textFilters = this.buildTextFiltersForComplex(timeline, currentLayer);
    filters.push(...textFilters);

    // Ensure we end with final_video
    if (!textFilters.length || !filters.some(f => f.includes('final_text'))) {
      filters.push(`[${currentLayer}]null[final_video]`);
    } else {
      // Replace final_text with final_video
      const lastFilterIndex = filters.length - 1;
      filters[lastFilterIndex] = filters[lastFilterIndex].replace('[final_text]', '[final_video]');
    }

    // Add filter complex
    args.push('-filter_complex', filters.join(';'));
    args.push('-map', '[final_video]');

    // Map audio
    args.push('-map', `${audioInputIndex}:a`);

    // Output settings
    args.push(
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-t', duration.toString(),
      '-shortest',
      outputPath
    );

    logger.info(`Complex FFmpeg command: ${this.ffmpegPath} ${args.join(' ')}`);

    const result = await this.executeFFmpeg(args);
    
    if (result.success) {
      logger.info(`Multimedia video render completed: ${outputPath}`);
      return outputPath;
    } else {
      throw new Error(`FFmpeg failed: ${result.error}`);
    }
  }

  buildTextFilters(timeline, resolution, duration) {
    const filters = [];
    
    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        if (clip.type === 'text') {
          const text = (clip.text || clip.content || '').replace(/'/g, "\\'");
          const fontSize = clip.fontSize || clip.style?.fontSize || 48;
          const fontColor = clip.color || clip.style?.color || 'white';
          const x = clip.position?.x || 100;
          const y = clip.position?.y || 100;
          
          let filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;
          
          // Add timing if available
          if (clip.start !== undefined && clip.duration !== undefined) {
            const start = clip.start;
            const end = clip.start + clip.duration;
            filter += `:enable='between(t,${start},${end})'`;
          }
          
          filters.push(filter);
        }
      });
    });

    return filters;
  }

  buildScaleFilter(clip, resolution) {
    const scale = clip.scale || 1;
    const width = clip.width || (clip.type === 'image' ? resolution.width : null);
    const height = clip.height || (clip.type === 'image' ? resolution.height : null);
    
    if (scale !== 1) {
      return `[${clip.index}:v]scale=iw*${scale}:ih*${scale}[scaled_${clip.index - 1}]`;
    } else if (width && height) {
      return `[${clip.index}:v]scale=${width}:${height}[scaled_${clip.index - 1}]`;
    } else {
      // Default scaling for images
      return `[${clip.index}:v]scale=iw*0.8:ih*0.8[scaled_${clip.index - 1}]`;
    }
  }

  buildOverlayFilter(clip, index, currentLayer) {
    const x = clip.position?.x || 960;  // Default to center
    const y = clip.position?.y || 540;  // Default to center
    const start = clip.start || 0;
    const duration = clip.duration || clip.length || 0;
    const end = start + duration;
    
    let filter = `[${currentLayer}][scaled_${index}]overlay=${x}:${y}`;
    
    if (start > 0 || duration > 0) {
      filter += `:enable='between(t,${start},${end})'`;
    }
    
    return `${filter}[layer_${index}]`;
  }

  buildTextFiltersForComplex(timeline, inputLabel) {
    const filters = [];
    let currentLabel = inputLabel;
    let textIndex = 0;
    
    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        if (clip.type === 'text') {
          const text = (clip.text || clip.content || '').replace(/'/g, "\\'");
          const fontSize = clip.fontSize || clip.style?.fontSize || 48;
          const fontColor = clip.color || clip.style?.color || 'white';
          const x = clip.position?.x || 100;
          const y = clip.position?.y || 100;
          
          let filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;
          
          // Add timing if available
          if (clip.start !== undefined && clip.duration !== undefined) {
            const start = clip.start;
            const end = clip.start + clip.duration;
            filter += `:enable='between(t,${start},${end})'`;
          }
          
          const outputLabel = `text_${textIndex}`;
          
          // Build filter with proper labels
          filters.push(`[${currentLabel}]${filter}[${outputLabel}]`);
          
          currentLabel = outputLabel;
          textIndex++;
        }
      });
    });
    
    // Ensure we have a final_text label
    if (textIndex > 0) {
      filters.push(`[${currentLabel}]null[final_text]`);
    }
    
    return filters;
  }

  calculateTotalDuration(timeline) {
    let maxDuration = 0;
    
    timeline.tracks?.forEach(track => {
      track.clips?.forEach(clip => {
        const clipEnd = (clip.start || 0) + (clip.duration || clip.length || 0);
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });

    return Math.max(maxDuration, 1);
  }

  executeFFmpeg(args) {
    return new Promise((resolve) => {
      const ffmpeg = spawn(this.ffmpegPath, args);
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          logger.error(`FFmpeg stderr: ${stderr}`);
          resolve({ success: false, error: stderr });
        }
      });

      ffmpeg.on('error', (error) => {
        logger.error(`FFmpeg spawn error: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }

  async validateTimeline(timeline) {
    const errors = [];
    
    if (!timeline.tracks || !Array.isArray(timeline.tracks)) {
      errors.push('Timeline debe contener un array de tracks');
    }

    if (timeline.tracks?.length === 0) {
      errors.push('Timeline debe contener al menos un track');
    }

    timeline.tracks?.forEach((track, trackIndex) => {
      if (!track.clips || !Array.isArray(track.clips)) {
        errors.push(`Track ${trackIndex} debe contener un array de clips`);
      }

      track.clips?.forEach((clip, clipIndex) => {
        if (!clip.type) {
          errors.push(`Track ${trackIndex}, clip ${clipIndex}: type requerido`);
        }

        if (clip.type === 'text' && !clip.text && !clip.content) {
          errors.push(`Track ${trackIndex}, clip ${clipIndex}: text o content requerido para tipo text`);
        }

        if (typeof clip.start !== 'number' || clip.start < 0) {
          errors.push(`Track ${trackIndex}, clip ${clipIndex}: start debe ser un número >= 0`);
        }

        if (!clip.duration && !clip.length) {
          errors.push(`Track ${trackIndex}, clip ${clipIndex}: duration o length requerido`);
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  async cleanup(filePath) {
    try {
      if (filePath && await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.debug(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}

module.exports = SimpleVideoRenderer; 