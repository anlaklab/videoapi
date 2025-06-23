const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { generateTempPath } = require('../utils/fileManager');

class AssetManager {
  constructor() {
    this.cache = new Map(); // URL -> local path cache
    this.downloadPromises = new Map(); // Track ongoing downloads
  }

  async downloadAsset(url) {
    // Check if already cached
    if (this.cache.has(url)) {
      const cachedPath = this.cache.get(url);
      if (await fs.pathExists(cachedPath)) {
        return cachedPath;
      } else {
        // Remove stale cache entry
        this.cache.delete(url);
      }
    }

    // Check if download is already in progress
    if (this.downloadPromises.has(url)) {
      return await this.downloadPromises.get(url);
    }

    // Start new download
    const downloadPromise = this._downloadAsset(url);
    this.downloadPromises.set(url, downloadPromise);

    try {
      const localPath = await downloadPromise;
      this.cache.set(url, localPath);
      return localPath;
    } finally {
      this.downloadPromises.delete(url);
    }
  }

  async _downloadAsset(url) {
    try {
      logger.info(`Downloading asset: ${url}`);
      
      // Generate filename based on URL
      const urlHash = crypto.createHash('md5').update(url).digest('hex');
      const extension = this.getFileExtension(url);
      const filename = `${urlHash}${extension}`;
      const localPath = generateTempPath(`_${filename}`);

      // Download with streaming to handle large files
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'JSON2VIDEO-API/1.0'
        }
      });

      // Validate content type
      const contentType = response.headers['content-type'];
      if (!this.isValidContentType(contentType)) {
        throw new Error(`Invalid content type: ${contentType} for URL: ${url}`);
      }

      // Stream to file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      // Validate file size
      const stats = await fs.stat(localPath);
      if (stats.size === 0) {
        await fs.remove(localPath);
        throw new Error(`Downloaded file is empty: ${url}`);
      }

      logger.info(`Asset downloaded successfully: ${url} -> ${localPath}`);
      return localPath;

    } catch (error) {
      logger.error(`Failed to download asset: ${url}`, error);
      throw new Error(`Failed to download asset: ${url} - ${error.message}`);
    }
  }

  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = path.extname(pathname);
      
      if (extension) {
        return extension;
      }

      // Try to determine extension from content type
      // This would be handled in the actual download
      return '.tmp';
    } catch (error) {
      return '.tmp';
    }
  }

  isValidContentType(contentType) {
    if (!contentType) return true; // Allow if no content type specified

    const validTypes = [
      'image/',
      'video/',
      'audio/',
      'application/octet-stream' // Generic binary
    ];

    return validTypes.some(type => contentType.startsWith(type));
  }

  getAssetPath(url) {
    const cachedPath = this.cache.get(url);
    if (cachedPath && fs.pathExistsSync(cachedPath)) {
      return cachedPath;
    }
    throw new Error(`Asset not found in cache: ${url}`);
  }

  async validateAsset(filePath, expectedType = null) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size === 0) {
        throw new Error('File is empty');
      }

      // Additional validation based on type could be added here
      // For example, checking file headers for image/video files
      
      return true;
    } catch (error) {
      logger.error(`Asset validation failed: ${filePath}`, error);
      return false;
    }
  }

  async cleanupCache(maxAgeHours = 24) {
    try {
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      const cleanupPromises = [];

      for (const [url, filePath] of this.cache.entries()) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() < cutoffTime) {
            cleanupPromises.push(
              fs.remove(filePath).then(() => {
                this.cache.delete(url);
                logger.info(`Cleaned up cached asset: ${url}`);
              })
            );
          }
        } catch (error) {
          // File doesn't exist, remove from cache
          this.cache.delete(url);
        }
      }

      await Promise.all(cleanupPromises);
    } catch (error) {
      logger.error('Error cleaning up asset cache:', error);
    }
  }

  getCacheStats() {
    return {
      cachedAssets: this.cache.size,
      activeDownloads: this.downloadPromises.size
    };
  }

  async preloadAssets(urls) {
    const downloadPromises = urls.map(url => this.downloadAsset(url));
    return await Promise.allSettled(downloadPromises);
  }

  clearCache() {
    this.cache.clear();
    this.downloadPromises.clear();
  }
}

module.exports = AssetManager; 