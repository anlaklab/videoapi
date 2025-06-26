const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../utils/logger');

class VideoRenderer {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.outputDir = process.env.OUTPUT_DIR || './output';
    
    // Configurar paths de FFmpeg
    const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
    const ffprobePath = process.env.FFPROBE_PATH || '/opt/homebrew/bin/ffprobe';
    
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    
    logger.info(`FFmpeg configurado: ${ffmpegPath}`);
    logger.info(`FFprobe configurado: ${ffprobePath}`);
  }

  async validateTimeline(timeline) {
    const errors = [];
    const warnings = [];

    try {
      // Validar estructura básica
      if (!timeline.tracks || !Array.isArray(timeline.tracks)) {
        errors.push('Timeline debe contener un array de tracks');
      }

      if (timeline.tracks?.length === 0) {
        errors.push('Timeline debe contener al menos un track');
      }

      // Validar cada track
      timeline.tracks?.forEach((track, trackIndex) => {
        if (!track.clips || !Array.isArray(track.clips)) {
          errors.push(`Track ${trackIndex} debe contener un array de clips`);
        }

        track.clips?.forEach((clip, clipIndex) => {
          // Validar clip
          if (!clip.type) {
            errors.push(`Track ${trackIndex}, clip ${clipIndex}: type requerido`);
          }

          if (['video', 'image', 'audio'].includes(clip.type) && !clip.src) {
            errors.push(`Track ${trackIndex}, clip ${clipIndex}: src requerido para tipo ${clip.type}`);
          }

          if (clip.type === 'text' && !clip.text && !clip.content) {
            errors.push(`Track ${trackIndex}, clip ${clipIndex}: text o content requerido para tipo text`);
          }

          // Validar timing
          if (typeof clip.start !== 'number' || clip.start < 0) {
            errors.push(`Track ${trackIndex}, clip ${clipIndex}: start debe ser un número >= 0`);
          }

          if (!clip.duration && !clip.length) {
            errors.push(`Track ${trackIndex}, clip ${clipIndex}: duration o length requerido`);
          }

          const duration = clip.duration || clip.length;
          if (typeof duration !== 'number' || duration <= 0) {
            errors.push(`Track ${trackIndex}, clip ${clipIndex}: duration debe ser un número > 0`);
          }
        });
      });

      // Validar soundtrack si existe
      if (timeline.soundtrack && !timeline.soundtrack.src) {
        errors.push('Soundtrack debe tener src definido');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Error validating timeline:', error);
      return {
        valid: false,
        errors: ['Error interno en validación'],
        warnings: []
      };
    }
  }

  async processMergeFields(timeline, mergeFields = {}) {
    try {
      // Convertir timeline a string, reemplazar placeholders, y convertir de vuelta
      let timelineStr = JSON.stringify(timeline);

      Object.entries(mergeFields).forEach(([key, value]) => {
        // Support multiple placeholder formats
        const patterns = [
          `{{${key}}}`,     // {{KEY}} - double braces (templates)
          `{${key}}`,       // {KEY} - single braces (legacy)
          `\${${key}}`,     // ${KEY} - dollar syntax
          `[${key}]`,       // [KEY] - bracket syntax
          `%${key}%`        // %KEY% - percent syntax
        ];
        
        patterns.forEach(pattern => {
          const regex = new RegExp(pattern.replace(/[{}$[\]%]/g, '\\$&'), 'g');
          const beforeReplace = timelineStr;
          timelineStr = timelineStr.replace(regex, String(value));
          if (beforeReplace !== timelineStr) {
            logger.info(`VideoRenderer: Replaced ${pattern} with ${value}`);
          }
        });
      });

      return JSON.parse(timelineStr);

    } catch (error) {
      logger.error('Error processing merge fields:', error);
      throw new Error('Error procesando campos de fusión');
    }
  }

  async renderVideo(timeline, assets, output, progressCallback) {
    const sessionId = uuidv4();
    const outputPath = path.join(this.outputDir, `${sessionId}.${output.format || 'mp4'}`);
    
    try {
      logger.info(`Starting video render session: ${sessionId}`);

      // Crear directorio de salida si no existe
      await fs.ensureDir(this.outputDir);

      // Construir comando FFmpeg
      const command = await this.buildFFmpegCommand(timeline, assets, output, outputPath);

      // Ejecutar FFmpeg con monitoreo de progreso
      return await this.executeFFmpeg(command, progressCallback);

    } catch (error) {
      logger.error(`Error in video render session ${sessionId}:`, error);
      throw error;
    }
  }

  async buildFFmpegCommand(timeline, assets, output, outputPath) {
    const command = ffmpeg();
    
    // Para casos simples (solo texto y/o background), usar un enfoque más directo
    const hasOnlySimpleContent = timeline.tracks.every(track => 
      track.clips.every(clip => ['text', 'background'].includes(clip.type))
    );

    if (hasOnlySimpleContent) {
      return this.buildSimpleTextCommand(timeline, output, outputPath);
    }

    // Para casos más complejos, usar el enfoque con filtros complejos
    return this.buildComplexCommand(timeline, assets, output, outputPath);
  }

  buildSimpleTextCommand(timeline, output, outputPath) {
    const command = ffmpeg();
    const resolution = output.resolution || { width: 1920, height: 1080 };
    const duration = this.calculateTotalDuration(timeline);
    
    // Obtener color de fondo desde los clips de background o usar negro por defecto
    let backgroundColor = '#000000';
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.type === 'background' && clip.color) {
          backgroundColor = clip.color;
        }
      });
    });
    
    // Si hay background en el timeline, usarlo
    if (timeline.background?.color) {
      backgroundColor = timeline.background.color;
    }
    
    // Crear filtro base de color
    let filterString = `color=c=${backgroundColor}:size=${resolution.width}x${resolution.height}:duration=${duration}:rate=${output.fps || 30}[bg]`;
    
    // Agregar filtros de texto encadenados
    let lastOutput = 'bg';
    let textIndex = 0;
    
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.type === 'text') {
          const textOptions = this.buildTextOptions(clip);
          const currentOutput = `text${textIndex}`;
          filterString += `;[${lastOutput}]drawtext=${textOptions}[${currentOutput}]`;
          lastOutput = currentOutput;
          textIndex++;
        }
      });
    });
    
    // Configurar el comando
    command.addOption('-f', 'lavfi')
           .addOption('-i', filterString)
           .addOption('-f', 'lavfi')
           .addOption('-i', `anullsrc=channel_layout=stereo:sample_rate=48000:duration=${duration}`)
           .addOption('-c:v', 'libx264')
           .addOption('-c:a', 'aac')
           .addOption('-t', duration)
           .addOption('-pix_fmt', 'yuv420p')
           .addOption('-map', '0:v')
           .addOption('-map', '1:a');

    // Configurar output
    command.output(outputPath);

    return command;
  }

  buildComplexCommand(timeline, assets, output, outputPath) {
    // Implementación para casos más complejos (videos, imágenes, etc.)
    const command = ffmpeg();
    const resolution = output.resolution || { width: 1920, height: 1080 };
    const fps = output.fps || 30;
    const duration = this.calculateTotalDuration(timeline);
    
    logger.info('Building complex FFmpeg command for timeline with media assets');
    
    // Collect all input files
    const inputs = [];
    let inputIndex = 0;
    
    // Add background color or video
    if (timeline.background?.type === 'video' && timeline.background.src) {
      command.input(timeline.background.src);
      inputs.push({ type: 'background', index: inputIndex++, src: timeline.background.src });
    }
    
    // Process all clips and add as inputs
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (['video', 'image', 'audio'].includes(clip.type) && clip.src) {
          command.input(clip.src);
          inputs.push({ 
            type: clip.type, 
            index: inputIndex++, 
            src: clip.src, 
            clip: clip 
          });
        }
      });
    });
    
    // Add soundtrack if exists
    let soundtrackIndex = null;
    if (timeline.soundtrack?.src) {
      command.input(timeline.soundtrack.src);
      soundtrackIndex = inputIndex++;
    }
    
    // Build filter complex
    const filterComplex = [];
    const videoLayers = [];
    
    // Create base layer (background color or first video)
    if (inputs.find(i => i.type === 'background')) {
      const bgInput = inputs.find(i => i.type === 'background');
      filterComplex.push(`[${bgInput.index}:v]scale=${resolution.width}:${resolution.height}[bg]`);
    } else {
      filterComplex.push(`color=c=black:size=${resolution.width}x${resolution.height}:duration=${duration}:rate=${fps}[bg]`);
    }
    
    let currentLayer = 'bg';
    let layerIndex = 0;
    
    // Process video and image clips
    const mediaClips = inputs.filter(i => ['video', 'image'].includes(i.type));
    mediaClips.forEach((input, idx) => {
      const clip = input.clip;
      const nextLayer = `layer${layerIndex++}`;
      
      // Scale and position the input
      let inputFilter = `[${input.index}:v]`;
      
      // Apply scaling if needed
      if (clip.scale && clip.scale !== 1) {
        inputFilter += `scale=iw*${clip.scale}:ih*${clip.scale}[scaled${idx}];[scaled${idx}]`;
      }
      
      // Build overlay filter with timing
      const start = clip.start || 0;
      const clipDuration = clip.duration || clip.length || 5;
      const end = start + clipDuration;
      
      const x = clip.position?.x || 0;
      const y = clip.position?.y || 0;
      
      filterComplex.push(
        `[${currentLayer}]${inputFilter}overlay=${x}:${y}:enable='between(t,${start},${end})'[${nextLayer}]`
      );
      
      currentLayer = nextLayer;
    });
    
    // Add text overlays
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.type === 'text') {
          const nextLayer = `layer${layerIndex++}`;
          const textOptions = this.buildTextOptions(clip);
          const start = clip.start || 0;
          const clipDuration = clip.duration || clip.length || 3;
          const end = start + clipDuration;
          
          filterComplex.push(
            `[${currentLayer}]drawtext=${textOptions}:enable='between(t,${start},${end})'[${nextLayer}]`
          );
          
          currentLayer = nextLayer;
        }
      });
    });
    
    // Handle audio mixing
    const audioInputs = [];
    
    // Add soundtrack
    if (soundtrackIndex !== null) {
      audioInputs.push(`[${soundtrackIndex}:a]`);
    }
    
    // Add audio from video clips
    inputs.filter(i => ['video', 'audio'].includes(i.type)).forEach(input => {
      const clip = input.clip;
      const start = clip.start || 0;
      const clipDuration = clip.duration || clip.length || 5;
      
      // Trim audio to clip duration
      audioInputs.push(`[${input.index}:a]atrim=start=${start}:duration=${clipDuration}[a${input.index}]`);
    });
    
    // Mix audio or create silence
    if (audioInputs.length > 0) {
      const audioMixInputs = audioInputs.map((_, idx) => `[a${idx}]`).join('');
      filterComplex.push(`${audioMixInputs}amix=inputs=${audioInputs.length}:duration=longest[audio]`);
    } else {
      filterComplex.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${duration}[audio]`);
    }
    
    // Apply filter complex
    if (filterComplex.length > 0) {
      command.complexFilter(filterComplex.join(';'));
      command.map(`[${currentLayer}]`);
      command.map('[audio]');
    }
    
    // Configure output
    command
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-preset medium',
        '-crf 23'
      ])
      .duration(duration)
      .output(outputPath);
    
    return command;
  }

  buildVideoFilters(timeline, inputs, filterComplex, videoLayers) {
    const resolution = timeline.output?.resolution || { width: 1920, height: 1080 };
    let layerIndex = 0;

    // Crear base de video negro
    filterComplex.push({
      filter: 'color',
      options: {
        color: 'black',
        size: `${resolution.width}x${resolution.height}`,
        duration: this.calculateTotalDuration(timeline)
      },
      outputs: 'base'
    });

    // Procesar cada clip
    inputs.forEach(input => {
      if (['video', 'image'].includes(input.type) && input.index >= 0) {
        const clip = input.clip;
        const inputLabel = `${input.index}:v`;
        let currentLabel = inputLabel;

        // Aplicar transformaciones
        if (clip.scale && clip.scale !== 1) {
          const scaleLabel = `scaled_${layerIndex}`;
          filterComplex.push({
            filter: 'scale',
            options: `iw*${clip.scale}:ih*${clip.scale}`,
            inputs: currentLabel,
            outputs: scaleLabel
          });
          currentLabel = scaleLabel;
        }

        // Aplicar filtros de color
        if (clip.filter) {
          const filterLabel = `filtered_${layerIndex}`;
          this.applyColorFilter(clip.filter, currentLabel, filterLabel, filterComplex);
          currentLabel = filterLabel;
        }

        // Aplicar chroma key si está definido
        if (clip.chromaKey) {
          const chromaLabel = `chroma_${layerIndex}`;
          filterComplex.push({
            filter: 'chromakey',
            options: {
              color: clip.chromaKey.color || '0x00ff00',
              similarity: clip.chromaKey.threshold || 0.1,
              blend: clip.chromaKey.halo || 0.1
            },
            inputs: currentLabel,
            outputs: chromaLabel
          });
          currentLabel = chromaLabel;
        }

        // Overlay en la posición correcta
        const overlayLabel = layerIndex === 0 ? 'layer_0' : `layer_${layerIndex}`;
        const baseInput = layerIndex === 0 ? 'base' : `layer_${layerIndex - 1}`;
        
        filterComplex.push({
          filter: 'overlay',
          options: this.buildOverlayOptions(clip),
          inputs: [baseInput, currentLabel],
          outputs: overlayLabel
        });

        videoLayers.push(overlayLabel);
        layerIndex++;
      } else if (input.type === 'text') {
        // Procesar clips de texto creando un overlay de texto
        const clip = input.clip;
        const textLabel = `text_${layerIndex}`;
        const overlayLabel = layerIndex === 0 ? 'layer_0' : `layer_${layerIndex}`;
        const baseInput = layerIndex === 0 ? 'base' : `layer_${layerIndex - 1}`;
        
        // Crear filtro de texto
        const textOptions = this.buildTextOptions(clip);
        filterComplex.push({
          filter: 'drawtext',
          options: textOptions,
          inputs: baseInput,
          outputs: overlayLabel
        });

        videoLayers.push(overlayLabel);
        layerIndex++;
      }
    });

    // Output final de video
    const finalLayer = videoLayers[videoLayers.length - 1] || 'base';
    filterComplex.push({
      filter: 'format',
      options: 'yuv420p',
      inputs: finalLayer,
      outputs: 'video_out'
    });
  }

  buildAudioFilters(timeline, inputs, soundtrackIndex, filterComplex) {
    const audioInputs = [];

    // Agregar soundtrack si existe
    if (soundtrackIndex !== null) {
      audioInputs.push(`${soundtrackIndex}:a`);
    }

    // Agregar audio de clips de video
    inputs.forEach(input => {
      if (input.type === 'video' || input.type === 'audio') {
        audioInputs.push(`${input.index}:a`);
      }
    });

    if (audioInputs.length > 1) {
      // Mezclar múltiples fuentes de audio
      filterComplex.push({
        filter: 'amix',
        options: {
          inputs: audioInputs.length,
          duration: 'longest'
        },
        inputs: audioInputs,
        outputs: 'audio_out'
      });
    } else if (audioInputs.length === 1) {
      // Una sola fuente de audio
      filterComplex.push({
        filter: 'anull',
        inputs: audioInputs[0],
        outputs: 'audio_out'
      });
    } else {
      // Sin audio, crear silencio
      filterComplex.push({
        filter: 'anullsrc',
        options: 'channel_layout=stereo:sample_rate=48000',
        outputs: 'audio_out'
      });
    }
  }

  applyColorFilter(filterType, input, output, filterComplex) {
    switch (filterType) {
      case 'grayscale':
      case 'greyscale':
        filterComplex.push({
          filter: 'hue',
          options: 's=0',
          inputs: input,
          outputs: output
        });
        break;
      
      case 'sepia':
        filterComplex.push({
          filter: 'colorchannelmixer',
          options: '.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
          inputs: input,
          outputs: output
        });
        break;
      
      case 'blur':
        filterComplex.push({
          filter: 'gblur',
          options: 'sigma=2',
          inputs: input,
          outputs: output
        });
        break;
      
      default:
        // Sin filtro, pasar directamente
        filterComplex.push({
          filter: 'null',
          inputs: input,
          outputs: output
        });
    }
  }

  buildOverlayOptions(clip) {
    let x = 0, y = 0;

    // Posicionamiento
    if (clip.position) {
      if (typeof clip.position === 'object' && clip.position.x !== undefined && clip.position.y !== undefined) {
        // Posición con coordenadas x, y
        x = clip.position.x;
        y = clip.position.y;
      } else if (typeof clip.position === 'string') {
        // Posición con nombres predefinidos
        switch (clip.position) {
          case 'center':
            x = '(main_w-overlay_w)/2';
            y = '(main_h-overlay_h)/2';
            break;
          case 'top':
            x = '(main_w-overlay_w)/2';
            y = 0;
            break;
          case 'bottom':
            x = '(main_w-overlay_w)/2';
            y = 'main_h-overlay_h';
            break;
          case 'left':
            x = 0;
            y = '(main_h-overlay_h)/2';
            break;
          case 'right':
            x = 'main_w-overlay_w';
            y = '(main_h-overlay_h)/2';
            break;
          case 'top-left':
            x = 0;
            y = 0;
            break;
          case 'top-right':
            x = 'main_w-overlay_w';
            y = 0;
            break;
          case 'bottom-left':
            x = 0;
            y = 'main_h-overlay_h';
            break;
          case 'bottom-right':
            x = 'main_w-overlay_w';
            y = 'main_h-overlay_h';
            break;
        }
      }
    }

    // Offset adicional
    if (clip.offset) {
      if (typeof x === 'string') {
        x = `${x}+${clip.offset.x || 0}`;
      } else {
        x += clip.offset.x || 0;
      }
      
      if (typeof y === 'string') {
        y = `${y}+${clip.offset.y || 0}`;
      } else {
        y += clip.offset.y || 0;
      }
    }

    let options = `${x}:${y}`;

    // Enable/disable basado en tiempo
    if (clip.start || clip.duration || clip.length) {
      const start = clip.start || 0;
      const duration = clip.duration || clip.length;
      const end = start + duration;
      options += `:enable='between(t,${start},${end})'`;
    }

    return options;
  }

  buildTextOptions(clip) {
    const text = clip.text || clip.content || '';
    const fontSize = clip.fontSize || clip.style?.fontSize || 48;
    const fontColor = clip.color || clip.style?.color || '#ffffff';
    const x = clip.position?.x || 100;
    const y = clip.position?.y || 100;
    
    let options = `text='${text.replace(/'/g, "\\'")}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`;
    
    // Agregar timing si está disponible
    if (clip.start !== undefined && clip.duration !== undefined) {
      const start = clip.start;
      const end = clip.start + clip.duration;
      options += `:enable='between(t,${start},${end})'`;
    }
    
    return options;
  }

  async createBackgroundImage(timeline, resolution) {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(resolution.width, resolution.height);
    const ctx = canvas.getContext('2d');
    
    // Establecer color de fondo
    const backgroundColor = timeline.background?.color || '#000000';
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, resolution.width, resolution.height);
    
    // Guardar imagen temporal
    const tempImagePath = path.join(this.tempDir, `bg_${Date.now()}.png`);
    await fs.ensureDir(this.tempDir);
    
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(tempImagePath, buffer);
    
    return tempImagePath;
  }

  configureOutput(command, output, outputPath) {
    // Formato y codec
    const format = output.format || 'mp4';
    command.format(format);

    if (format === 'mp4') {
      command.videoCodec('libx264');
      command.audioCodec('aac');
    } else if (format === 'webm') {
      command.videoCodec('libvpx-vp9');
      command.audioCodec('libopus');
    }

    // Resolución
    if (output.resolution) {
      command.size(`${output.resolution.width}x${output.resolution.height}`);
    }

    // Bitrate
    if (output.bitrate) {
      const bitrate = output.bitrate.toString().replace(/[^\d]/g, '');
      command.videoBitrate(bitrate);
    }

    // FPS
    if (output.fps) {
      command.fps(output.fps);
    }

    // Calidad
    if (output.quality) {
      const crfMap = {
        low: 28,
        medium: 23,
        high: 18,
        ultra: 15
      };
      const crf = crfMap[output.quality] || 23;
      command.addOption('-crf', crf);
    }

    // Mapear outputs de filtros complejos
    command.addOption('-map', '[video_out]');
    command.addOption('-map', '[audio_out]');

    command.output(outputPath);
  }

  configureSimpleOutput(command, output, outputPath, timeline) {
    // Formato y codec
    const format = output.format || 'mp4';
    command.format(format);

    if (format === 'mp4') {
      command.videoCodec('libx264');
      command.audioCodec('aac');
    } else if (format === 'webm') {
      command.videoCodec('libvpx-vp9');
      command.audioCodec('libopus');
    }

    // Resolución
    if (output.resolution) {
      command.size(`${output.resolution.width}x${output.resolution.height}`);
    }

    // Bitrate
    if (output.bitrate) {
      const bitrate = output.bitrate.toString().replace(/[^\d]/g, '');
      command.videoBitrate(bitrate);
    }

    // FPS
    if (output.fps) {
      command.fps(output.fps);
    }

    // Calidad
    if (output.quality) {
      const crfMap = {
        low: 28,
        medium: 23,
        high: 18,
        ultra: 15
      };
      const crf = crfMap[output.quality] || 23;
      command.addOption('-crf', crf);
    }

    // Duración máxima para evitar videos infinitos
    const duration = this.calculateTotalDuration(timeline);
    command.duration(duration);

    command.output(outputPath);
  }

  async executeFFmpeg(command, progressCallback) {
    return new Promise((resolve, reject) => {
      let outputPath;

      command
        .on('start', (commandLine) => {
          logger.info('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progressCallback && progress.percent) {
            progressCallback(Math.round(progress.percent));
          }
        })
        .on('end', () => {
          logger.info('FFmpeg processing completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('FFmpeg error:', err);
          reject(new Error(`Error de procesamiento FFmpeg: ${err.message}`));
        });

      // Extraer path de salida
      const outputs = command._outputs;
      if (outputs && outputs.length > 0) {
        outputPath = outputs[0].target;
      }

      command.run();
    });
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

  async generateThumbnail(videoUrl, timestamp = 1, options = {}) {
    const sessionId = uuidv4();
    const thumbnailPath = path.join(this.tempDir, `thumbnail_${sessionId}.jpg`);
    
    try {
      await fs.ensureDir(this.tempDir);

      return new Promise((resolve, reject) => {
        ffmpeg(videoUrl)
          .seekInput(timestamp)
          .frames(1)
          .size(`${options.width || 1920}x${options.height || 1080}`)
          .output(thumbnailPath)
          .on('end', () => {
            logger.info(`Thumbnail generated: ${thumbnailPath}`);
            resolve(thumbnailPath);
          })
          .on('error', (err) => {
            logger.error('Thumbnail generation error:', err);
            reject(new Error(`Error generando thumbnail: ${err.message}`));
          })
          .run();
      });

    } catch (error) {
      logger.error('Error in thumbnail generation:', error);
      throw error;
    }
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

module.exports = VideoRenderer; 