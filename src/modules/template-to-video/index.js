/**
 * Módulo Template-to-Video - RENDERIZADO REAL CON FFMPEG
 * Responsabilidad única: Convertir templates JSON a videos MP4 reales
 * 
 * Pipeline: Template JSON → FFmpeg Processing → Real MP4 Video
 */

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const logger = require('../../utils/logger');

class TemplateToVideoProcessor {
  constructor() {
    this.stats = {
      totalRendered: 0,
      totalErrors: 0,
      averageRenderTime: 0,
      successRate: 0,
      lastRendered: null
    };
    this.outputDir = path.join(__dirname, '../../../output');
    this.tempDir = path.join(__dirname, '../../../temp');
    this.assetsDir = path.join(__dirname, '../../../assets');
    this.outputCleaned = false; // Flag para evitar múltiples limpiezas
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(this.tempDir);
    await fs.ensureDir(this.assetsDir);
  }

  /**
   * Proceso principal: Template → Video REAL
   */
  async processTemplate(template, options = {}) {
    const correlationId = options.correlationId || logger.generateCorrelationId();
    const jobId = `video-render-${uuidv4()}`;
    const startTime = Date.now();

    logger.info('🎥 Iniciando renderizado REAL Template → Video', {
      correlationId,
      jobId,
      templateId: template?.metadata?.id || 'unknown'
    });

    this.stats.totalRendered++;

    try {
      // Paso 0: Limpiar carpeta output una sola vez por sesión
      this.clearOutputFolder();

      // Paso 1: Validar template
      await this.validateTemplate(template, correlationId);
      
      // Paso 2: Aplicar merge fields
      const processedTemplate = await this.applyMergeFields(template, options.mergeFields || {}, correlationId);
      
      // Paso 3: Generar comandos FFmpeg
      const ffmpegConfig = await this.generateFFmpegCommands(processedTemplate, options, correlationId);
      
      // Paso 4: Renderizar video REAL con FFmpeg
      const videoResult = await this.renderVideoWithFFmpeg(ffmpegConfig, correlationId);

      const renderTime = (Date.now() - startTime) / 1000;
      this.updateStats(renderTime, true);
      
      logger.info('✅ Video REAL renderizado exitosamente', {
        correlationId,
        jobId,
        renderTime,
        outputFile: videoResult.filename,
        fileSize: videoResult.size
      });

      return {
        success: true,
        data: {
          id: jobId,
          status: 'completed',
          result: videoResult,
          processingTime: renderTime,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      const renderTime = (Date.now() - startTime) / 1000;
      this.updateStats(renderTime, false);
      
      logger.error('❌ Error en renderizado REAL Template → Video', {
        correlationId,
        jobId,
        error: error.message,
        renderTime
      });

      throw error;
    }
  }

  /**
   * Validar template
   */
  async validateTemplate(template, correlationId) {
    logger.info('🔍 Validando template', {
      correlationId,
      hasTemplate: !!template,
      templateKeys: template ? Object.keys(template) : [],
      hasTimeline: template?.timeline ? true : false,
      timelineKeys: template?.timeline ? Object.keys(template.timeline) : []
    });

    if (!template) {
      throw new Error('Template es requerido');
    }

    if (!template.timeline) {
      throw new Error('Template debe tener timeline');
    }

    if (!template.timeline.tracks || template.timeline.tracks.length === 0) {
      throw new Error('Timeline debe tener al menos una pista');
    }

    // Validar que cada track tenga clips
    for (let i = 0; i < template.timeline.tracks.length; i++) {
      const track = template.timeline.tracks[i];
      if (!track.clips || track.clips.length === 0) {
        throw new Error(`Track ${i} debe tener al menos un clip`);
      }
    }

    logger.info('✅ Template validado', {
      correlationId,
      tracks: template.timeline.tracks.length,
      totalClips: template.timeline.tracks.reduce((sum, track) => sum + track.clips.length, 0)
    });
  }

  /**
   * Aplicar merge fields al template
   */
  async applyMergeFields(template, mergeFields, correlationId) {
    logger.info('🔄 Aplicando merge fields', {
      correlationId,
      fieldsCount: Object.keys(mergeFields).length
    });

    const processedTemplate = JSON.parse(JSON.stringify(template));

    // Aplicar merge fields a todos los clips de texto
    processedTemplate.timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.type === 'text' && clip.text) {
          let processedText = clip.text;
          
          // Reemplazar placeholders
          Object.entries(mergeFields).forEach(([key, value]) => {
            const patterns = [
              new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
              new RegExp(`\\$\\{${key}\\}`, 'g'),
              new RegExp(`%${key}%`, 'g')
            ];
            
            patterns.forEach(pattern => {
              processedText = processedText.replace(pattern, value);
            });
          });
          
          clip.text = processedText;
        }
      });
    });

    logger.info('✅ Merge fields aplicados', { correlationId });
    return processedTemplate;
  }

  /**
   * Generar comandos FFmpeg para renderizado real
   */
  async generateFFmpegCommands(template, options, correlationId) {
    logger.info('🔧 Generando comandos FFmpeg', { correlationId });

    const duration = this.calculateDuration(template);
    const output = options.output || {};
    const resolution = output.resolution || { width: 1920, height: 1080 };
    const fps = output.fps || 30;
    const format = output.format || 'mp4';

    // Generar nombre de archivo
    const timestamp = Date.now();
    const filename = `video_${timestamp}.${format}`;
    const outputPath = path.join(this.outputDir, filename);

    // Configuración base de FFmpeg
    const ffmpegConfig = {
      filename,
      outputPath,
      duration,
      resolution,
      fps,
      format,
      tracks: template.timeline.tracks,
      background: template.timeline.background || { color: '#000000' }
    };

    logger.info('✅ Comandos FFmpeg generados', {
      correlationId,
      duration,
      resolution: `${resolution.width}x${resolution.height}`,
      fps,
      outputFile: filename
    });

    return ffmpegConfig;
  }

  /**
   * Renderizar video REAL con FFmpeg
   */
  async renderVideoWithFFmpeg(config, correlationId) {
    logger.info('🎬 Iniciando renderizado REAL con FFmpeg', { correlationId });

    return new Promise((resolve, reject) => {
      // Recopilar assets de imágenes y videos
      const assets = this.collectAssets(config.tracks);
      
      // Comando FFmpeg para generar video real con contenido
      const ffmpegArgs = [
        '-f', 'lavfi',
        '-i', `color=${config.background.color}:size=${config.resolution.width}x${config.resolution.height}:duration=${config.duration}:rate=${config.fps}`
      ];

      // Agregar inputs de imágenes y videos
      assets.forEach(asset => {
        if (asset.path && fs.existsSync(asset.path)) {
          ffmpegArgs.push('-i', asset.path);
          logger.info(`📎 Asset agregado: ${asset.type} - ${asset.path}`, { correlationId });
        }
      });

      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-r', config.fps.toString(),
        '-t', config.duration.toString()
      );

      // Generar filtros complejos incluyendo texto, imágenes, etc.
      const complexFilters = this.generateComplexFilters(config.tracks, config.resolution, config.duration, assets);
      if (complexFilters.length > 0) {
        ffmpegArgs.push('-filter_complex', complexFilters.join(';'));
        ffmpegArgs.push('-map', '[final]');
      }

      // Agregar opciones finales
      ffmpegArgs.push('-y'); // Sobrescribir archivo si existe
      ffmpegArgs.push(config.outputPath);

      logger.info('🔨 Ejecutando FFmpeg', {
        correlationId,
        command: `ffmpeg ${ffmpegArgs.join(' ')}`,
        outputPath: config.outputPath
      });

      const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
      const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
      let ffmpegOutput = '';
      let ffmpegError = '';

      ffmpeg.stdout.on('data', (data) => {
        ffmpegOutput += data.toString();
      });

      ffmpeg.stderr.on('data', (data) => {
        ffmpegError += data.toString();
        // Log progreso de FFmpeg
        if (data.toString().includes('time=')) {
          const timeMatch = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
          if (timeMatch) {
            logger.info(`⏱️ FFmpeg progreso: ${timeMatch[1]}`, { correlationId });
          }
        }
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          try {
            // Verificar que el archivo se creó correctamente
            const stats = await fs.stat(config.outputPath);
            
            const videoResult = {
              url: `/output/${config.filename}`,
              filename: config.filename,
              path: config.outputPath,
              duration: config.duration,
              size: stats.size,
              format: config.format,
              resolution: config.resolution,
              fps: config.fps,
              quality: 'high',
              createdAt: new Date().toISOString(),
              metadata: {
                tracks: config.tracks.length,
                clips: config.tracks.reduce((sum, track) => sum + track.clips.length, 0),
                renderEngine: 'FFmpeg',
                codec: 'H.264'
              }
            };

            logger.info('✅ Video REAL generado exitosamente', {
              correlationId,
              filename: config.filename,
              duration: config.duration,
              size: stats.size,
              path: config.outputPath
            });

            resolve(videoResult);
          } catch (error) {
            logger.error('❌ Error verificando archivo de video', {
              correlationId,
              error: error.message
            });
            reject(new Error(`Error verificando archivo de video: ${error.message}`));
          }
        } else {
          logger.error('❌ FFmpeg falló', {
            correlationId,
            exitCode: code,
            stderr: ffmpegError.slice(-500) // Últimos 500 caracteres del error
          });
          reject(new Error(`FFmpeg falló con código ${code}: ${ffmpegError.slice(-200)}`));
        }
      });

      ffmpeg.on('error', (error) => {
        logger.error('❌ Error ejecutando FFmpeg', {
          correlationId,
          error: error.message
        });
        reject(new Error(`Error ejecutando FFmpeg: ${error.message}`));
      });
    });
  }

  /**
   * Recopilar assets de imágenes y videos
   */
  collectAssets(tracks) {
    const assets = [];
    let assetIndex = 1; // El index 0 es el background
    
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if ((clip.type === 'image' || clip.type === 'video') && clip.source) {
          const assetPath = this.getAssetPath(clip.source);
          if (assetPath && fs.existsSync(assetPath)) {
            assets.push({
              type: clip.type,
              source: clip.source,
              path: assetPath,
              index: assetIndex,
              clip: clip
            });
            assetIndex++;
          } else {
            logger.warn(`🔍 Asset no encontrado: ${clip.source}`);
          }
        }
      });
    });
    
    return assets;
  }

  /**
   * Generar filtros complejos para FFmpeg (texto, imágenes, efectos, capas)
   */
  generateComplexFilters(tracks, resolution, duration, assets = []) {
    const filters = [];
    let currentStream = '[0:v]';
    let streamIndex = 1;
    
    logger.info('🎨 Generando filtros complejos', {
      tracks: tracks.length,
      totalClips: tracks.reduce((sum, track) => sum + track.clips.length, 0)
    });
    
    // Procesar cada track y sus clips manteniendo el orden de capas
    tracks.forEach((track, trackIndex) => {
      track.clips.forEach((clip, clipIndex) => {
        
        // PROCESAR CLIPS DE BACKGROUND
        if (clip.type === 'background' && clip.color) {
          // El background se maneja en el input base, pero podemos agregar overlays
          logger.info(`📄 Background encontrado: ${clip.color}`);
        }
        
        // PROCESAR CLIPS DE TEXTO con tipografía completa
        if (clip.type === 'text' && (clip.text || clip.content)) {
          const text = clip.text || clip.content || 'Sin texto';
          
          // TIPOGRAFÍA COMPLETA
          const fontSize = clip.style?.fontSize || 48;
          const fontColor = clip.style?.color || '#ffffff';
          const fontFamily = clip.style?.fontFamily || 'Arial';
          
          // POSICIONAMIENTO ABSOLUTO
          let x, y;
          if (clip.position && typeof clip.position === 'object') {
            // Usar posiciones absolutas del JSON
            x = clip.position.x;
            y = clip.position.y;
            
            // Ajustar coordenadas para centrado si es necesario
            if (x === 960 && resolution.width === 1920) {
              x = '(w-tw)/2'; // Centrado horizontal
            }
            if (y === 540 && resolution.height === 1080) {
              y = '(h-th)/2'; // Centrado vertical
            }
          } else {
            // Fallback a centrado
            x = '(w-tw)/2';
            y = '(h-th)/2';
          }
          
          // EFECTOS Y PROPIEDADES
          const opacity = clip.opacity ? (clip.opacity / 100) : 1.0;
          const scale = clip.scale || 1.0;
          
          // Escapar texto para FFmpeg
          const escapedText = text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/:/g, '\\:').replace(/\n/g, '\\n');
          
          // GENERAR FILTRO DE TEXTO AVANZADO
          let textFilter = `${currentStream}drawtext=`;
          textFilter += `text='${escapedText}':`;
          textFilter += `fontsize=${Math.round(fontSize * scale)}:`;
          textFilter += `fontcolor=${fontColor}@${opacity}:`;
          textFilter += `x=${x}:y=${y}:`;
          
          // Agregar fuente si está disponible
          const fontPath = this.getFontPath(fontFamily);
          if (fontPath) {
            textFilter += `fontfile=${fontPath}:`;
          }
          
          // Agregar timing
          textFilter += `enable='between(t,${clip.start},${clip.start + clip.duration})'`;
          textFilter += `[stream${streamIndex}]`;
          
          filters.push(textFilter);
          
          logger.info(`📝 Texto añadido: "${text.substring(0, 20)}" @ (${x},${y}) size:${fontSize} color:${fontColor}`);
          
          currentStream = `[stream${streamIndex}]`;
          streamIndex++;
        }
        
        // PROCESAR CLIPS DE IMAGEN
        if (clip.type === 'image' && clip.source) {
          const asset = assets.find(a => a.source === clip.source);
          if (asset) {
            // Generar filtro de overlay de imagen
            const scale = clip.scale || 1.0;
            const opacity = (clip.opacity || 100) / 100;
            
            let imageFilter = `${currentStream}[${asset.index}:v]`;
            
            // Aplicar escala si es necesario
            if (scale !== 1.0) {
              imageFilter += `scale=${Math.round(asset.clip.originalWidth * scale || 400 * scale)}:${Math.round(asset.clip.originalHeight * scale || 300 * scale)}[scaled${streamIndex}];[scaled${streamIndex}]`;
            }
            
            imageFilter += `overlay=`;
            imageFilter += `x=${clip.position?.x || 0}:y=${clip.position?.y || 0}:`;
            imageFilter += `enable='between(t,${clip.start},${clip.start + clip.duration})'`;
            imageFilter += `[stream${streamIndex}]`;
            
            filters.push(imageFilter);
            logger.info(`🖼️ Imagen añadida: ${clip.source} @ (${clip.position?.x || 0},${clip.position?.y || 0}) input:[${asset.index}:v]`);
            
            currentStream = `[stream${streamIndex}]`;
            streamIndex++;
          } else {
            logger.warn(`🖼️ Asset de imagen no encontrado: ${clip.source}`);
            }
          }

        // PROCESAR CLIPS DE VIDEO
        if (clip.type === 'video' && clip.source) {
          const asset = assets.find(a => a.source === clip.source);
          if (asset) {
            // Generar filtro de overlay de video
            const scale = clip.scale || 1.0;
            const opacity = (clip.opacity || 100) / 100;
            
            let videoFilter = `${currentStream}[${asset.index}:v]`;
            
            // Aplicar escala si es necesario
            if (scale !== 1.0) {
              videoFilter += `scale=${Math.round(1920 * scale)}:${Math.round(1080 * scale)}[scaled${streamIndex}];[scaled${streamIndex}]`;
            }
            
            videoFilter += `overlay=`;
            videoFilter += `x=${clip.position?.x || 0}:y=${clip.position?.y || 0}:`;
            videoFilter += `enable='between(t,${clip.start},${clip.start + clip.duration})'`;
            videoFilter += `[stream${streamIndex}]`;
            
            filters.push(videoFilter);
            logger.info(`🎥 Video añadido: ${clip.source} @ (${clip.position?.x || 0},${clip.position?.y || 0}) input:[${asset.index}:v]`);
            
            currentStream = `[stream${streamIndex}]`;
            streamIndex++;
          } else {
            logger.warn(`🎥 Asset de video no encontrado: ${clip.source}`);
          }
        }
        
        // PROCESAR CLIPS DE FORMA/SHAPE
        if (clip.type === 'shape') {
          // Generar formas geométricas con drawbox
          const shape = clip.shape || { type: 'rectangle', width: 200, height: 100 };
          let shapeFilter = `${currentStream}drawbox=`;
          shapeFilter += `x=${clip.position?.x || 100}:y=${clip.position?.y || 100}:`;
          shapeFilter += `w=${shape.width || 200}:h=${shape.height || 100}:`;
          shapeFilter += `color=${shape.fillColor || '#ff0000'}@${(clip.opacity || 100) / 100}:`;
          shapeFilter += `t=${shape.strokeWidth || 2}:`;
          shapeFilter += `enable='between(t,${clip.start},${clip.start + clip.duration})'`;
          shapeFilter += `[stream${streamIndex}]`;
          
          filters.push(shapeFilter);
          logger.info(`🔷 Forma añadida: ${shape.type} ${shape.width}x${shape.height} @ (${clip.position?.x || 100},${clip.position?.y || 100})`);
          
          currentStream = `[stream${streamIndex}]`;
          streamIndex++;
        }
      });
    });

    // Si se agregaron filtros, marcar el stream final
    if (filters.length > 0) {
      // Renombrar el último stream como 'final'
      const lastFilter = filters[filters.length - 1];
      filters[filters.length - 1] = lastFilter.replace(/\[stream\d+\]$/, '[final]');
      logger.info(`✅ ${filters.length} filtros generados`);
    } else {
      // Si no hay filtros, usar el stream base como final
      filters.push(`${currentStream}copy[final]`);
      logger.info('⚠️ No se generaron filtros, usando stream base');
    }

    return filters;
  }

  /**
   * Obtener ruta de fuente tipográfica
   */
  getFontPath(fontFamily) {
    const fontMappings = {
      'Arial': '/System/Library/Fonts/Arial.ttf',
      'Arial Black': '/System/Library/Fonts/Arial Black.ttf',
      'Arial Bold': '/System/Library/Fonts/Arial Bold.ttf',
      'Helvetica': '/System/Library/Fonts/Helvetica.ttc',
      'Times': '/System/Library/Fonts/Times.ttc',
      'Times New Roman': '/Library/Fonts/Times New Roman.ttf',
      'Courier': '/System/Library/Fonts/Courier.ttc',
      'Impact': '/System/Library/Fonts/Impact.ttf',
      'Comic Sans MS': '/Library/Fonts/Comic Sans MS.ttf',
      'Papyrus': '/System/Library/Fonts/Papyrus.ttc'
    };
    
    return fontMappings[fontFamily] || fontMappings['Arial'];
  }

  /**
   * Obtener ruta de asset (imagen/video)
   */
  getAssetPath(assetSource) {
    if (!assetSource) return null;
    
    // Si ya es una ruta absoluta, usarla directamente
    if (assetSource.startsWith('/')) {
      return assetSource;
    }
    
    // Buscar en directorios de assets
    const possiblePaths = [
      path.join(this.assetsDir, assetSource),
      path.join(this.assetsDir, 'images', assetSource),
      path.join(this.assetsDir, 'videos', assetSource),
      path.join(this.assetsDir, 'unsplash/images', assetSource),
      path.join(this.assetsDir, 'unsplash/videos', assetSource)
    ];
    
    for (const assetPath of possiblePaths) {
      if (fs.existsSync(assetPath)) {
        return assetPath;
      }
    }
    
    logger.warn(`🔍 Asset no encontrado: ${assetSource}`);
    return null;
  }

  /**
   * Calcular duración del video
   */
  calculateDuration(template) {
    if (template.timeline.duration) {
      return template.timeline.duration;
    }

    // Calcular duración basada en clips
    let maxDuration = 0;
    template.timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });

    return maxDuration || 10; // Duración mínima de 10 segundos
  }

  /**
   * Actualizar estadísticas
   */
  updateStats(renderTime, success) {
    if (!success) {
      this.stats.totalErrors++;
    }

    // Calcular promedio de tiempo de renderizado
    if (this.stats.averageRenderTime === 0) {
      this.stats.averageRenderTime = renderTime;
    } else {
      this.stats.averageRenderTime = (this.stats.averageRenderTime + renderTime) / 2;
    }

    // Calcular tasa de éxito
    const successful = this.stats.totalRendered - this.stats.totalErrors;
    this.stats.successRate = (successful / this.stats.totalRendered) * 100;
    
    this.stats.lastRendered = new Date().toISOString();
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      totalRendered: this.stats.totalRendered,
      totalErrors: this.stats.totalErrors,
      averageRenderTime: this.stats.averageRenderTime,
      successRate: this.stats.successRate,
      lastRendered: this.stats.lastRendered
    };
  }

  /**
   * Obtener número de trabajos activos
   */
  getActiveJobsCount() {
    return 0; // TODO: Implementar contador real de trabajos activos
  }

  /**
   * Limpia automáticamente la carpeta output eliminando videos y JSONs anteriores
   */
  clearOutputFolder() {
    // Evitar múltiples limpiezas en la misma sesión
    if (this.outputCleaned) {
      logger.info('🧹 Carpeta output ya limpiada en esta sesión');
      return;
    }

    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        logger.info('📁 Carpeta output creada');
        this.outputCleaned = true;
        return;
      }

      const files = fs.readdirSync(this.outputDir);
      const targetFiles = files.filter(file => 
        file.endsWith('.mp4') || 
        file.endsWith('.json') || 
        file.endsWith('.mov') ||
        file.endsWith('.avi')
      );

      if (targetFiles.length === 0) {
        logger.info('🧹 Carpeta output ya está limpia');
        this.outputCleaned = true;
        return;
      }

      targetFiles.forEach(file => {
        const filePath = path.join(this.outputDir, file);
        try {
          fs.unlinkSync(filePath);
          logger.info(`🗑️ Archivo eliminado: ${file}`);
        } catch (error) {
          logger.warn(`⚠️ No se pudo eliminar: ${file} - ${error.message}`);
        }
      });

      logger.info(`✅ Limpieza completada: ${targetFiles.length} archivos eliminados`);
      this.outputCleaned = true;
      
    } catch (error) {
      logger.warn(`⚠️ Error en limpieza de output: ${error.message}`);
    }
  }
}

module.exports = TemplateToVideoProcessor; 