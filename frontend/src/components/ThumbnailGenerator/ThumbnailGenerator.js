/**
 * ThumbnailGenerator - Professional Thumbnail System
 * 
 * Generates high-quality thumbnails for all asset types:
 * - Video: Frame extraction and preview
 * - Audio: Waveform visualization
 * - Images: Optimized thumbnails
 * - Fonts: Text preview samples
 * - 3D Models: Rendered previews
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

class ThumbnailGenerator {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.audioContext = null;
    this.cache = new Map();
  }

  /**
   * Generate thumbnail for any file type
   */
  async generateThumbnail(file, options = {}) {
    const {
      width = 150,
      height = 100,
      quality = 0.8,
      format = 'image/jpeg'
    } = options;

    // Check cache first
    const cacheKey = `${file.name}-${file.size}-${width}x${height}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let thumbnail;

    try {
      switch (file.type.split('/')[0]) {
        case 'video':
          thumbnail = await this.generateVideoThumbnail(file, { width, height, quality, format });
          break;
        case 'image':
          thumbnail = await this.generateImageThumbnail(file, { width, height, quality, format });
          break;
        case 'audio':
          thumbnail = await this.generateAudioThumbnail(file, { width, height, quality, format });
          break;
        default:
          if (file.name.match(/\.(ttf|otf|woff|woff2)$/i)) {
            thumbnail = await this.generateFontThumbnail(file, { width, height, quality, format });
          } else {
            thumbnail = await this.generateGenericThumbnail(file, { width, height, quality, format });
          }
      }

      // Cache the result
      this.cache.set(cacheKey, thumbnail);
      return thumbnail;

    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return this.generateErrorThumbnail({ width, height, format });
    }
  }

  /**
   * Generate video thumbnail from first frame
   */
  async generateVideoThumbnail(file, options) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.addEventListener('loadedmetadata', () => {
        canvas.width = options.width;
        canvas.height = options.height;

        // Seek to 10% of video duration for better thumbnail
        video.currentTime = video.duration * 0.1;
      });

      video.addEventListener('seeked', () => {
        try {
          // Calculate aspect ratio
          const aspectRatio = video.videoWidth / video.videoHeight;
          let drawWidth = options.width;
          let drawHeight = options.height;
          let offsetX = 0;
          let offsetY = 0;

          if (aspectRatio > options.width / options.height) {
            drawHeight = options.width / aspectRatio;
            offsetY = (options.height - drawHeight) / 2;
          } else {
            drawWidth = options.height * aspectRatio;
            offsetX = (options.width - drawWidth) / 2;
          }

          // Fill background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, options.width, options.height);

          // Draw video frame
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

          // Add play icon overlay
          this.addPlayIconOverlay(ctx, options.width, options.height);

          // Add duration overlay
          this.addDurationOverlay(ctx, video.duration, options.width, options.height);

          const thumbnail = canvas.toDataURL(options.format, options.quality);
          resolve({
            url: thumbnail,
            width: options.width,
            height: options.height,
            duration: video.duration,
            type: 'video'
          });
        } catch (error) {
          reject(error);
        }
      });

      video.addEventListener('error', reject);
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate image thumbnail with proper scaling
   */
  async generateImageThumbnail(file, options) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
          canvas.width = options.width;
          canvas.height = options.height;

          // Calculate aspect ratio
          const aspectRatio = img.width / img.height;
          let drawWidth = options.width;
          let drawHeight = options.height;
          let offsetX = 0;
          let offsetY = 0;

          if (aspectRatio > options.width / options.height) {
            drawHeight = options.width / aspectRatio;
            offsetY = (options.height - drawHeight) / 2;
          } else {
            drawWidth = options.height * aspectRatio;
            offsetX = (options.width - drawWidth) / 2;
          }

          // Fill background
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, options.width, options.height);

          // Draw image
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

          // Add image dimensions overlay
          this.addImageInfoOverlay(ctx, img.width, img.height, options.width, options.height);

          const thumbnail = canvas.toDataURL(options.format, options.quality);
          resolve({
            url: thumbnail,
            width: options.width,
            height: options.height,
            originalWidth: img.width,
            originalHeight: img.height,
            type: 'image'
          });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate audio waveform thumbnail
   */
  async generateAudioThumbnail(file, options) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = options.width;
      canvas.height = options.height;

      // Draw waveform
      this.drawWaveform(ctx, audioBuffer, options.width, options.height);

      // Add audio icon and duration
      this.addAudioInfoOverlay(ctx, audioBuffer.duration, options.width, options.height);

      const thumbnail = canvas.toDataURL(options.format, options.quality);
      return {
        url: thumbnail,
        width: options.width,
        height: options.height,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        type: 'audio'
      };
    } catch (error) {
      console.error('Audio thumbnail generation failed:', error);
      return this.generateGenericThumbnail(file, options);
    }
  }

  /**
   * Generate font preview thumbnail
   */
  async generateFontThumbnail(file, options) {
    try {
      // Create font face
      const fontFace = new FontFace('PreviewFont', `url(${URL.createObjectURL(file)})`);
      await fontFace.load();
      document.fonts.add(fontFace);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = options.width;
      canvas.height = options.height;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, options.width, options.height);

      // Font preview text
      const sampleText = 'Abc 123';
      const fontSize = Math.min(options.width / 4, options.height / 2);
      
      ctx.fillStyle = '#333333';
      ctx.font = `${fontSize}px PreviewFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.fillText(sampleText, options.width / 2, options.height / 2);

      // Add font name
      ctx.fillStyle = '#666666';
      ctx.font = `${fontSize / 4}px Arial, sans-serif`;
      ctx.fillText(file.name.replace(/\.[^/.]+$/, ""), options.width / 2, options.height - 10);

      const thumbnail = canvas.toDataURL(options.format, options.quality);
      
      // Cleanup
      document.fonts.delete(fontFace);
      
      return {
        url: thumbnail,
        width: options.width,
        height: options.height,
        fontName: file.name,
        type: 'font'
      };
    } catch (error) {
      console.error('Font thumbnail generation failed:', error);
      return this.generateGenericThumbnail(file, options);
    }
  }

  /**
   * Generate generic file thumbnail
   */
  async generateGenericThumbnail(file, options) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = options.width;
    canvas.height = options.height;

    // Background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, options.width, options.height);

    // File icon
    const iconSize = Math.min(options.width, options.height) / 3;
    ctx.fillStyle = '#666666';
    ctx.fillRect(
      (options.width - iconSize) / 2,
      (options.height - iconSize) / 2 - 10,
      iconSize,
      iconSize
    );

    // File extension
    const extension = file.name.split('.').pop().toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${iconSize / 4}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(extension, options.width / 2, options.height / 2);

    // File name
    ctx.fillStyle = '#cccccc';
    ctx.font = `${iconSize / 6}px Arial, sans-serif`;
    const truncatedName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
    ctx.fillText(truncatedName, options.width / 2, options.height - 10);

    const thumbnail = canvas.toDataURL(options.format, options.quality);
    return {
      url: thumbnail,
      width: options.width,
      height: options.height,
      fileName: file.name,
      type: 'generic'
    };
  }

  /**
   * Generate error thumbnail
   */
  generateErrorThumbnail(options) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = options.width;
    canvas.height = options.height;

    // Background
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(0, 0, options.width, options.height);

    // Error icon
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.min(options.width, options.height) / 3}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', options.width / 2, options.height / 2);

    // Error text
    ctx.font = `${Math.min(options.width, options.height) / 8}px Arial, sans-serif`;
    ctx.fillText('Error', options.width / 2, options.height / 2 + 20);

    return {
      url: canvas.toDataURL(options.format, 0.8),
      width: options.width,
      height: options.height,
      type: 'error'
    };
  }

  /**
   * Draw waveform visualization
   */
  drawWaveform(ctx, audioBuffer, width, height) {
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Waveform
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.stroke();
  }

  /**
   * Add play icon overlay for videos
   */
  addPlayIconOverlay(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 8;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Play triangle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(centerX - radius/3, centerY - radius/2);
    ctx.lineTo(centerX - radius/3, centerY + radius/2);
    ctx.lineTo(centerX + radius/2, centerY);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Add duration overlay for videos
   */
  addDurationOverlay(ctx, duration, width, height) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 45, height - 20, 40, 15);

    ctx.fillStyle = 'white';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(timeText, width - 25, height - 10);
  }

  /**
   * Add image info overlay
   */
  addImageInfoOverlay(ctx, originalWidth, originalHeight, width, height) {
    const infoText = `${originalWidth}×${originalHeight}`;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(5, height - 20, 60, 15);

    ctx.fillStyle = 'white';
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(infoText, 8, height - 10);
  }

  /**
   * Add audio info overlay
   */
  addAudioInfoOverlay(ctx, duration, width, height) {
    // Audio icon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${Math.min(width, height) / 6}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', width / 2, height / 4);

    // Duration
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 45, height - 20, 40, 15);

    ctx.fillStyle = 'white';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(timeText, width - 25, height - 10);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize() {
    return this.cache.size;
  }
}

// Create singleton instance
const thumbnailGenerator = new ThumbnailGenerator();

/**
 * React Hook for thumbnail generation
 */
export const useThumbnailGenerator = () => {
  const [thumbnails, setThumbnails] = useState(new Map());
  const [loading, setLoading] = useState(new Set());

  const generateThumbnail = useCallback(async (file, options = {}) => {
    const fileKey = `${file.name}-${file.size}`;
    
    if (thumbnails.has(fileKey)) {
      return thumbnails.get(fileKey);
    }

    if (loading.has(fileKey)) {
      return null; // Already generating
    }

    setLoading(prev => new Set(prev).add(fileKey));

    try {
      const thumbnail = await thumbnailGenerator.generateThumbnail(file, options);
      
      setThumbnails(prev => new Map(prev).set(fileKey, thumbnail));
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileKey);
        return newSet;
      });

      return thumbnail;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileKey);
        return newSet;
      });
      return null;
    }
  }, [thumbnails, loading]);

  const isGenerating = useCallback((file) => {
    const fileKey = `${file.name}-${file.size}`;
    return loading.has(fileKey);
  }, [loading]);

  const getThumbnail = useCallback((file) => {
    const fileKey = `${file.name}-${file.size}`;
    return thumbnails.get(fileKey);
  }, [thumbnails]);

  return {
    generateThumbnail,
    getThumbnail,
    isGenerating,
    clearCache: () => {
      thumbnailGenerator.clearCache();
      setThumbnails(new Map());
    }
  };
};

export default thumbnailGenerator; 