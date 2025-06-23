const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { uploadFile, fileExists } = require('../config/firebase');
const logger = require('../utils/logger');

class AssetProcessor {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.downloadTimeout = parseInt(process.env.ASSET_DOWNLOAD_TIMEOUT) || 30000;
    this.maxAssetSize = this.parseSize(process.env.ASSET_MAX_SIZE || '500MB');
  }

  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 500 * 1024 * 1024; // Default 500MB
    return parseFloat(match[1]) * units[match[2].toUpperCase()];
  }

  async processTimelineAssets(timeline, progressCallback) {
    const assets = new Map();
    const totalAssets = this.countAssets(timeline);
    let processedCount = 0;

    try {
      // Procesar soundtrack si existe
      if (timeline.soundtrack?.src) {
        const asset = await this.processAsset({
          src: timeline.soundtrack.src,
          type: 'audio'
        });
        assets.set(timeline.soundtrack.src, asset);
        processedCount++;
        if (progressCallback) {
          progressCallback((processedCount / totalAssets) * 100);
        }
      }

      // Procesar assets de clips
      for (const track of timeline.tracks || []) {
        for (const clip of track.clips || []) {
          if (clip.asset?.src && !assets.has(clip.asset.src)) {
            try {
              const asset = await this.processAsset(clip.asset);
              assets.set(clip.asset.src, asset);
            } catch (error) {
              logger.error(`Error processing asset ${clip.asset.src}:`, error);
              // Continuar con otros assets en caso de error
            }
            
            processedCount++;
            if (progressCallback) {
              progressCallback((processedCount / totalAssets) * 100);
            }
          }
        }
      }

      return assets;

    } catch (error) {
      logger.error('Error processing timeline assets:', error);
      throw error;
    }
  }

  async processAsset(asset) {
    try {
      const { src, type } = asset;
      
      // Validar URL
      if (!this.isValidUrl(src)) {
        throw new Error(`URL inválida: ${src}`);
      }

      // Verificar si ya existe en cache local
      const cachedPath = await this.getCachedAsset(src);
      if (cachedPath) {
        return {
          originalUrl: src,
          localPath: cachedPath,
          type,
          cached: true
        };
      }

      // Descargar asset
      const localPath = await this.downloadAsset(src, type);

      // Validar asset descargado
      await this.validateAsset(localPath, type);

      // Cachear para futuros usos
      await this.cacheAsset(src, localPath);

      return {
        originalUrl: src,
        localPath,
        type,
        cached: false
      };

    } catch (error) {
      logger.error(`Error processing asset:`, error);
      throw error;
    }
  }

  async downloadAsset(url, type) {
    const sessionId = uuidv4();
    const extension = this.getExtensionFromUrl(url) || this.getDefaultExtension(type);
    const fileName = `asset_${sessionId}${extension}`;
    const localPath = path.join(this.tempDir, fileName);

    try {
      await fs.ensureDir(this.tempDir);

      logger.info(`Downloading asset: ${url}`);

      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: this.downloadTimeout,
        maxContentLength: this.maxAssetSize,
        headers: {
          'User-Agent': 'JSON2VIDEO-API/1.0'
        }
      });

      // Verificar tamaño del contenido
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > this.maxAssetSize) {
        throw new Error(`Asset demasiado grande: ${contentLength} bytes`);
      }

      // Escribir archivo
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`Asset downloaded: ${localPath}`);
          resolve(localPath);
        });
        
        writer.on('error', (error) => {
          logger.error(`Download error for ${url}:`, error);
          reject(new Error(`Error descargando asset: ${error.message}`));
        });

        // Timeout adicional para escritura
        setTimeout(() => {
          writer.destroy();
          reject(new Error('Timeout descargando asset'));
        }, this.downloadTimeout);
      });

    } catch (error) {
      logger.error(`Error downloading asset ${url}:`, error);
      
      // Limpiar archivo parcial si existe
      try {
        await fs.remove(localPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup partial download: ${cleanupError.message}`);
      }

      throw new Error(`Error descargando asset: ${error.message}`);
    }
  }

  async validateAsset(filePath, type) {
    try {
      const stats = await fs.stat(filePath);
      
      // Verificar que el archivo no esté vacío
      if (stats.size === 0) {
        throw new Error('Asset está vacío');
      }

      // Verificar tamaño máximo
      if (stats.size > this.maxAssetSize) {
        throw new Error(`Asset demasiado grande: ${stats.size} bytes`);
      }

      // Validaciones específicas por tipo
      switch (type) {
        case 'video':
          await this.validateVideoAsset(filePath);
          break;
        case 'image':
          await this.validateImageAsset(filePath);
          break;
        case 'audio':
          await this.validateAudioAsset(filePath);
          break;
      }

      return true;

    } catch (error) {
      logger.error(`Asset validation failed for ${filePath}:`, error);
      throw error;
    }
  }

  async validateVideoAsset(filePath) {
    // Aquí se podría usar ffprobe para validar el video
    // Por simplicidad, verificamos solo la extensión
    const supportedExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    const extension = path.extname(filePath).toLowerCase();
    
    if (!supportedExtensions.includes(extension)) {
      throw new Error(`Formato de video no soportado: ${extension}`);
    }
  }

  async validateImageAsset(filePath) {
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const extension = path.extname(filePath).toLowerCase();
    
    if (!supportedExtensions.includes(extension)) {
      throw new Error(`Formato de imagen no soportado: ${extension}`);
    }
  }

  async validateAudioAsset(filePath) {
    const supportedExtensions = ['.mp3', '.wav', '.aac', '.ogg', '.flac'];
    const extension = path.extname(filePath).toLowerCase();
    
    if (!supportedExtensions.includes(extension)) {
      throw new Error(`Formato de audio no soportado: ${extension}`);
    }
  }

  async validateAssets(timeline) {
    const errors = [];
    const warnings = [];

    try {
      // Validar soundtrack
      if (timeline.soundtrack?.src) {
        try {
          await this.validateAssetUrl(timeline.soundtrack.src);
        } catch (error) {
          errors.push(`Soundtrack: ${error.message}`);
        }
      }

      // Validar assets de clips
      for (const [trackIndex, track] of (timeline.tracks || []).entries()) {
        for (const [clipIndex, clip] of (track.clips || []).entries()) {
          if (clip.asset?.src) {
            try {
              await this.validateAssetUrl(clip.asset.src);
            } catch (error) {
              errors.push(`Track ${trackIndex}, Clip ${clipIndex}: ${error.message}`);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Error validating assets:', error);
      return {
        valid: false,
        errors: ['Error interno validando assets'],
        warnings: []
      };
    }
  }

  async validateAssetUrl(url) {
    try {
      if (!this.isValidUrl(url)) {
        throw new Error(`URL inválida: ${url}`);
      }

      // Hacer HEAD request para verificar que el asset existe
      const response = await axios.head(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'JSON2VIDEO-API/1.0'
        }
      });

      // Verificar tamaño si está disponible
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength > this.maxAssetSize) {
        throw new Error(`Asset demasiado grande: ${contentLength} bytes`);
      }

      return true;

    } catch (error) {
      if (error.response) {
        throw new Error(`Asset no accesible: HTTP ${error.response.status}`);
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('Asset no encontrado');
      } else {
        throw new Error(`Error verificando asset: ${error.message}`);
      }
    }
  }

  async uploadToFirebase(filePath, destination, metadata = {}) {
    try {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      const stats = await fs.stat(filePath);
      
      const result = await uploadFile(filePath, destination, {
        ...metadata,
        size: stats.size,
        uploadedAt: new Date().toISOString()
      });

      logger.info(`File uploaded to Firebase: ${destination}`);
      
      return {
        ...result,
        size: stats.size
      };

    } catch (error) {
      logger.error(`Error uploading to Firebase:`, error);
      throw error;
    }
  }

  async getCachedAsset(url) {
    // Implementación simple de cache basado en hash de URL
    const hash = this.hashUrl(url);
    const cacheDir = path.join(this.tempDir, 'cache');
    const cachedFiles = await fs.readdir(cacheDir).catch(() => []);
    
    const cachedFile = cachedFiles.find(file => file.startsWith(hash));
    if (cachedFile) {
      const cachedPath = path.join(cacheDir, cachedFile);
      if (await fs.pathExists(cachedPath)) {
        logger.info(`Using cached asset: ${cachedPath}`);
        return cachedPath;
      }
    }

    return null;
  }

  async cacheAsset(url, localPath) {
    try {
      const hash = this.hashUrl(url);
      const extension = path.extname(localPath);
      const cacheDir = path.join(this.tempDir, 'cache');
      const cachedPath = path.join(cacheDir, `${hash}${extension}`);

      await fs.ensureDir(cacheDir);
      await fs.copy(localPath, cachedPath);
      
      logger.debug(`Asset cached: ${cachedPath}`);

    } catch (error) {
      logger.warn(`Failed to cache asset:`, error);
      // No es crítico si falla el cache
    }
  }

  hashUrl(url) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
      return false;
    }
  }

  getExtensionFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = path.extname(pathname);
      return extension || null;
    } catch (_) {
      return null;
    }
  }

  getDefaultExtension(type) {
    const defaults = {
      video: '.mp4',
      image: '.jpg',
      audio: '.mp3'
    };
    return defaults[type] || '.bin';
  }

  countAssets(timeline) {
    let count = 0;
    
    if (timeline.soundtrack?.src) {
      count++;
    }

    for (const track of timeline.tracks || []) {
      for (const clip of track.clips || []) {
        if (clip.asset?.src) {
          count++;
        }
      }
    }

    return count;
  }

  async cleanup(filePath) {
    try {
      if (filePath && await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.debug(`Cleaned up asset: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup asset ${filePath}:`, error);
    }
  }

  async cleanupCache(olderThanMs = 24 * 60 * 60 * 1000) {
    try {
      const cacheDir = path.join(this.tempDir, 'cache');
      const files = await fs.readdir(cacheDir).catch(() => []);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        const stats = await fs.stat(filePath).catch(() => null);
        
        if (stats && (now - stats.mtime.getTime()) > olderThanMs) {
          await fs.remove(filePath);
          cleaned++;
        }
      }

      logger.info(`Cache cleanup completed: ${cleaned} files removed`);
      return cleaned;

    } catch (error) {
      logger.error('Error cleaning cache:', error);
      return 0;
    }
  }
}

module.exports = AssetProcessor; 