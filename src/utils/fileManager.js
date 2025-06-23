const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

class FileManager {
  constructor() {
    this.baseDir = path.join(__dirname, '../..');
    this.tempDir = path.join(this.baseDir, 'temp');
    this.outputDir = path.join(this.baseDir, 'output');
    this.assetsDir = path.join(this.baseDir, 'assets');
    this.fontsDir = path.join(this.baseDir, 'fonts');
  }

  async setupDirectories() {
    try {
      const directories = [
        this.tempDir,
        this.outputDir,
        this.assetsDir,
        this.fontsDir,
        path.join(this.baseDir, 'logs')
      ];

      for (const dir of directories) {
        await fs.ensureDir(dir);
        logger.info(`Directory ensured: ${dir}`);
      }
    } catch (error) {
      logger.error('Error setting up directories:', error);
      throw error;
    }
  }

  generateTempPath(extension = '') {
    const filename = `${uuidv4()}${extension}`;
    return path.join(this.tempDir, filename);
  }

  generateOutputPath(filename) {
    return path.join(this.outputDir, filename);
  }

  async cleanupTempFiles(olderThanHours = 24) {
    try {
      const files = await fs.readdir(this.tempDir);
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.remove(filePath);
          logger.info(`Cleaned up temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
    }
  }

  async saveAsset(buffer, originalName, type = 'general') {
    try {
      const extension = path.extname(originalName);
      const filename = `${uuidv4()}${extension}`;
      const assetPath = path.join(this.assetsDir, type, filename);
      
      await fs.ensureDir(path.dirname(assetPath));
      await fs.writeFile(assetPath, buffer);
      
      return {
        filename,
        path: assetPath,
        url: `/assets/${type}/${filename}`,
        originalName
      };
    } catch (error) {
      logger.error('Error saving asset:', error);
      throw error;
    }
  }

  async getAssetPath(filename, type = 'general') {
    const assetPath = path.join(this.assetsDir, type, filename);
    const exists = await fs.pathExists(assetPath);
    return exists ? assetPath : null;
  }

  async deleteFile(filePath) {
    try {
      await fs.remove(filePath);
      logger.info(`File deleted: ${filePath}`);
    } catch (error) {
      logger.error(`Error deleting file ${filePath}:`, error);
    }
  }

  async copyFile(source, destination) {
    try {
      await fs.ensureDir(path.dirname(destination));
      await fs.copy(source, destination);
      return destination;
    } catch (error) {
      logger.error(`Error copying file from ${source} to ${destination}:`, error);
      throw error;
    }
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      logger.error(`Error getting file size for ${filePath}:`, error);
      return 0;
    }
  }

  async ensureFileExists(filePath) {
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }
    return filePath;
  }
}

const fileManager = new FileManager();

module.exports = {
  fileManager,
  setupDirectories: () => fileManager.setupDirectories(),
  generateTempPath: (ext) => fileManager.generateTempPath(ext),
  generateOutputPath: (filename) => fileManager.generateOutputPath(filename),
  cleanupTempFiles: (hours) => fileManager.cleanupTempFiles(hours),
  saveAsset: (buffer, name, type) => fileManager.saveAsset(buffer, name, type),
  getAssetPath: (filename, type) => fileManager.getAssetPath(filename, type),
  deleteFile: (path) => fileManager.deleteFile(path),
  copyFile: (src, dest) => fileManager.copyFile(src, dest),
  getFileSize: (path) => fileManager.getFileSize(path),
  ensureFileExists: (path) => fileManager.ensureFileExists(path)
}; 