const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { generateTempPath, generateOutputPath, ensureFileExists } = require('../utils/fileManager');
const AssetManager = require('./assetManager');
const TextRenderer = require('./textRenderer');
const HtmlRenderer = require('./htmlRenderer');
const FilterProcessor = require('./filterProcessor');

class VideoProcessor {
  constructor() {
    this.assetManager = new AssetManager();
    this.textRenderer = new TextRenderer();
    this.htmlRenderer = new HtmlRenderer();
    this.filterProcessor = new FilterProcessor();
    this.jobs = new Map(); // Track processing jobs
  }

  async processTimeline(timelineData, jobId = null) {
    const processingId = jobId || uuidv4();
    
    try {
      logger.info(`Starting video processing for job: ${processingId}`);
      
      // Update job status
      this.updateJobStatus(processingId, 'processing', 'Validating timeline data');
      
      // Validate and normalize timeline
      const normalizedTimeline = await this.normalizeTimeline(timelineData);
      
      // Calculate total duration
      const totalDuration = this.calculateTotalDuration(normalizedTimeline);
      
      // Process merge fields if provided
      if (timelineData.mergeFields) {
        this.processMergeFields(normalizedTimeline, timelineData.mergeFields);
      }
      
      // Download and prepare all assets
      this.updateJobStatus(processingId, 'processing', 'Downloading assets');
      await this.prepareAssets(normalizedTimeline);
      
      // Create video tracks
      this.updateJobStatus(processingId, 'processing', 'Processing video tracks');
      const processedTracks = await this.processAllTracks(normalizedTimeline, totalDuration);
      
      // Composite all tracks
      this.updateJobStatus(processingId, 'processing', 'Compositing video');
      const finalVideoPath = await this.compositeVideo(processedTracks, normalizedTimeline, totalDuration);
      
      // Add soundtrack if provided
      if (normalizedTimeline.soundtrack) {
        this.updateJobStatus(processingId, 'processing', 'Adding soundtrack');
        const videoWithAudio = await this.addSoundtrack(finalVideoPath, normalizedTimeline.soundtrack, totalDuration);
        await fs.remove(finalVideoPath);
        finalVideoPath = videoWithAudio;
      }
      
      // Apply global filters
      if (normalizedTimeline.filters && normalizedTimeline.filters.length > 0) {
        this.updateJobStatus(processingId, 'processing', 'Applying filters');
        const filteredVideo = await this.applyGlobalFilters(finalVideoPath, normalizedTimeline.filters);
        await fs.remove(finalVideoPath);
        finalVideoPath = filteredVideo;
      }
      
      // Generate final output
      this.updateJobStatus(processingId, 'processing', 'Generating final output');
      const outputPath = await this.generateFinalOutput(finalVideoPath, timelineData.output, processingId);
      
      // Clean up temporary files
      await this.cleanupTempFiles(processedTracks);
      await fs.remove(finalVideoPath);
      
      const result = {
        jobId: processingId,
        status: 'completed',
        url: `/output/${path.basename(outputPath)}`,
        filename: path.basename(outputPath),
        duration: totalDuration,
        size: await this.getFileSize(outputPath),
        format: timelineData.output?.format || 'mp4',
        resolution: timelineData.output?.resolution || { width: 1920, height: 1080 }
      };
      
      this.updateJobStatus(processingId, 'completed', 'Video processing completed', result);
      
      logger.info(`Video processing completed for job: ${processingId}`);
      return result;
      
    } catch (error) {
      logger.error(`Video processing failed for job: ${processingId}`, error);
      this.updateJobStatus(processingId, 'failed', error.message);
      throw error;
    }
  }

  async normalizeTimeline(timelineData) {
    // Deep clone and set defaults
    const timeline = JSON.parse(JSON.stringify(timelineData.timeline));
    
    // Sort clips by start time and z-index
    timeline.tracks.forEach(track => {
      track.clips.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return (a.zIndex || 0) - (b.zIndex || 0);
      });
    });
    
    return timeline;
  }

  calculateTotalDuration(timeline) {
    let maxDuration = 0;
    
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd > maxDuration) {
          maxDuration = clipEnd;
        }
      });
    });
    
    // Add soundtrack duration if longer
    if (timeline.soundtrack) {
      const soundtrackEnd = timeline.soundtrack.start + (timeline.soundtrack.duration || maxDuration);
      if (soundtrackEnd > maxDuration) {
        maxDuration = soundtrackEnd;
      }
    }
    
    return Math.max(maxDuration, 1); // Minimum 1 second
  }

  processMergeFields(timeline, mergeFields) {
    const processValue = (value) => {
      if (typeof value === 'string') {
        return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return mergeFields[key] !== undefined ? mergeFields[key] : match;
        });
      }
      return value;
    };

    const processObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          processObject(obj[key]);
        } else {
          obj[key] = processValue(obj[key]);
        }
      }
    };

    processObject(timeline);
  }

  async prepareAssets(timeline) {
    const assetPromises = [];

    // Collect all asset URLs
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.src) {
          assetPromises.push(this.assetManager.downloadAsset(clip.src));
        }
      });
    });

    if (timeline.soundtrack?.src) {
      assetPromises.push(this.assetManager.downloadAsset(timeline.soundtrack.src));
    }

    if (timeline.background?.image) {
      assetPromises.push(this.assetManager.downloadAsset(timeline.background.image));
    }

    // Download all assets in parallel
    await Promise.all(assetPromises);
  }

  async processAllTracks(timeline, totalDuration) {
    const trackPromises = timeline.tracks.map((track, index) => 
      this.processTrack(track, index, totalDuration, timeline.background)
    );
    
    return await Promise.all(trackPromises);
  }

  async processTrack(track, trackIndex, totalDuration, background) {
    const trackId = `track_${trackIndex}_${uuidv4()}`;
    const trackPath = generateTempPath('.mp4');
    
    // Create base video with background
    await this.createBaseVideo(trackPath, totalDuration, background);
    
    // Process each clip in the track
    for (const clip of track.clips) {
      const processedClip = await this.processClip(clip, totalDuration);
      await this.overlayClip(trackPath, processedClip, clip);
    }
    
    return {
      id: trackId,
      path: trackPath,
      index: trackIndex
    };
  }

  async createBaseVideo(outputPath, duration, background) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      if (background.image) {
        // Use background image
        const imagePath = this.assetManager.getAssetPath(background.image);
        command = command.input(imagePath)
          .inputOptions(['-loop 1', `-t ${duration}`]);
      } else {
        // Create solid color background
        command = command.input(`color=${background.color}:size=1920x1080:duration=${duration}`)
          .inputOptions(['-f lavfi']);
      }
      
      command
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 30'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  async processClip(clip, totalDuration) {
    switch (clip.type) {
      case 'image':
        return await this.processImageClip(clip, totalDuration);
      case 'video':
        return await this.processVideoClip(clip, totalDuration);
      case 'text':
        return await this.processTextClip(clip, totalDuration);
      case 'html':
        return await this.processHtmlClip(clip, totalDuration);
      case 'audio':
        return await this.processAudioClip(clip, totalDuration);
      default:
        throw new Error(`Unsupported clip type: ${clip.type}`);
    }
  }

  async processImageClip(clip, totalDuration) {
    const imagePath = this.assetManager.getAssetPath(clip.src);
    const outputPath = generateTempPath('.mp4');
    
    return new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .inputOptions(['-loop 1', `-t ${clip.duration}`])
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 30',
          `-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2`
        ])
        .output(outputPath)
        .on('end', () => resolve({ path: outputPath, type: 'video' }))
        .on('error', reject)
        .run();
    });
  }

  async processVideoClip(clip, totalDuration) {
    const videoPath = this.assetManager.getAssetPath(clip.src);
    const outputPath = generateTempPath('.mp4');
    
    let inputOptions = [];
    let filterOptions = [];
    
    // Handle trim
    if (clip.trim) {
      inputOptions.push(`-ss ${clip.trim.start}`);
      if (clip.trim.end) {
        inputOptions.push(`-t ${clip.trim.end - clip.trim.start}`);
      }
    }
    
    // Handle scaling and positioning
    filterOptions.push(`scale=1920:1080:force_original_aspect_ratio=decrease`);
    filterOptions.push(`pad=1920:1080:(ow-iw)/2:(oh-ih)/2`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .inputOptions(inputOptions)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 30',
          `-vf ${filterOptions.join(',')}`
        ])
        .output(outputPath)
        .on('end', () => resolve({ path: outputPath, type: 'video' }))
        .on('error', reject)
        .run();
    });
  }

  async processTextClip(clip, totalDuration) {
    const textImagePath = await this.textRenderer.renderText(clip);
    return await this.processImageClip({ ...clip, src: textImagePath }, totalDuration);
  }

  async processHtmlClip(clip, totalDuration) {
    const htmlImagePath = await this.htmlRenderer.renderHtml(clip);
    return await this.processImageClip({ ...clip, src: htmlImagePath }, totalDuration);
  }

  async processAudioClip(clip, totalDuration) {
    const audioPath = this.assetManager.getAssetPath(clip.src);
    return { path: audioPath, type: 'audio' };
  }

  async overlayClip(basePath, processedClip, clipConfig) {
    if (processedClip.type === 'audio') {
      // Handle audio overlay separately
      return await this.overlayAudio(basePath, processedClip.path, clipConfig);
    }
    
    const outputPath = generateTempPath('.mp4');
    
    return new Promise((resolve, reject) => {
      const overlayFilter = this.buildOverlayFilter(clipConfig);
      
      ffmpeg(basePath)
        .input(processedClip.path)
        .complexFilter([
          `[1:v]${overlayFilter}[overlay]`,
          `[0:v][overlay]overlay=${clipConfig.position.x}:${clipConfig.position.y}:enable='between(t,${clipConfig.start},${clipConfig.start + clipConfig.duration})'`
        ])
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
        .output(outputPath)
        .on('end', () => {
          fs.move(outputPath, basePath)
            .then(resolve)
            .catch(reject);
        })
        .on('error', reject)
        .run();
    });
  }

  buildOverlayFilter(clip) {
    const filters = [];
    
    // Scale
    if (clip.scale !== 1) {
      filters.push(`scale=iw*${clip.scale}:ih*${clip.scale}`);
    }
    
    // Opacity
    if (clip.opacity < 100) {
      filters.push(`format=yuva420p,colorchannelmixer=aa=${clip.opacity / 100}`);
    }
    
    // Rotation
    if (clip.rotation !== 0) {
      filters.push(`rotate=${clip.rotation * Math.PI / 180}:fillcolor=none:bilinear=0`);
    }
    
    return filters.join(',') || 'null';
  }

  async compositeVideo(tracks, timeline, totalDuration) {
    if (tracks.length === 1) {
      return tracks[0].path;
    }
    
    const outputPath = generateTempPath('.mp4');
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Add all track inputs
      tracks.forEach(track => {
        command = command.input(track.path);
      });
      
      // Build complex filter for compositing
      const filterChain = this.buildCompositeFilter(tracks.length);
      
      command
        .complexFilter(filterChain)
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  buildCompositeFilter(trackCount) {
    if (trackCount === 2) {
      return '[0:v][1:v]overlay[out]';
    }
    
    const filters = [];
    for (let i = 1; i < trackCount; i++) {
      if (i === 1) {
        filters.push(`[0:v][1:v]overlay[tmp1]`);
      } else if (i === trackCount - 1) {
        filters.push(`[tmp${i-1}][${i}:v]overlay[out]`);
      } else {
        filters.push(`[tmp${i-1}][${i}:v]overlay[tmp${i}]`);
      }
    }
    
    return filters.join(';');
  }

  async addSoundtrack(videoPath, soundtrack, totalDuration) {
    const audioPath = this.assetManager.getAssetPath(soundtrack.src);
    const outputPath = generateTempPath('.mp4');
    
    return new Promise((resolve, reject) => {
      let audioFilter = `volume=${soundtrack.volume / 100}`;
      
      if (soundtrack.fadeIn > 0) {
        audioFilter += `,afade=t=in:st=0:d=${soundtrack.fadeIn}`;
      }
      
      if (soundtrack.fadeOut > 0) {
        audioFilter += `,afade=t=out:st=${totalDuration - soundtrack.fadeOut}:d=${soundtrack.fadeOut}`;
      }
      
      ffmpeg(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v copy',
          '-c:a aac',
          `-af ${audioFilter}`,
          '-shortest'
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async applyGlobalFilters(videoPath, filters) {
    const outputPath = generateTempPath('.mp4');
    const videoFilters = this.filterProcessor.buildFilterChain(filters);
    
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          '-c:a copy',
          `-vf ${videoFilters}`
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async generateFinalOutput(videoPath, outputConfig, jobId) {
    const outputFilename = `video_${jobId}.${outputConfig.format}`;
    const outputPath = generateOutputPath(outputFilename);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath);
      
      // Set codec based on format
      let videoCodec = outputConfig.codec;
      if (outputConfig.format === 'webm') {
        videoCodec = 'libvpx-vp9';
      }
      
      command
        .outputOptions([
          `-c:v ${videoCodec}`,
          '-c:a aac',
          `-b:v ${outputConfig.bitrate}`,
          `-r ${outputConfig.fps}`,
          `-s ${outputConfig.resolution.width}x${outputConfig.resolution.height}`
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  updateJobStatus(jobId, status, message, result = null) {
    this.jobs.set(jobId, {
      id: jobId,
      status,
      message,
      result,
      updatedAt: new Date().toISOString()
    });
  }

  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  async cleanupTempFiles(tracks) {
    const cleanupPromises = tracks.map(track => fs.remove(track.path));
    await Promise.all(cleanupPromises);
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = VideoProcessor; 