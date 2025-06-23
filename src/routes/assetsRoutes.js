const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { saveAsset, getAssetPath } = require('../utils/fileManager');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Assets
 *   description: Gestión de archivos multimedia
 */

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/mov',
      'video/avi',
      'video/webm',
      'audio/mp3',
      'audio/wav',
      'audio/aac',
      'audio/ogg',
      'font/ttf',
      'font/otf',
      'application/font-woff',
      'application/font-woff2'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

/**
 * @swagger
 * /api/assets/upload:
 *   post:
 *     summary: Subir archivo multimedia
 *     description: Sube un archivo multimedia (imagen, video, audio o fuente) al servidor
 *     tags: [Assets]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - asset
 *             properties:
 *               asset:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir (imagen, video, audio, fuente)
 *                 example: "[Seleccionar archivo desde tu dispositivo]"
 *           encoding:
 *             asset:
 *               contentType: image/*, video/*, audio/*, font/*
 *     responses:
 *       201:
 *         description: Archivo subido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 asset:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     type:
 *                       type: string
 *                     size:
 *                       type: integer
 *                     url:
 *                       type: string
 *       400:
 *         description: No se proporcionó archivo o tipo no soportado
 */

// Upload single asset
router.post('/upload', upload.single('asset'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      message: 'Please provide a file to upload'
    });
  }

  const file = req.file;
  const assetType = getAssetType(file.mimetype);
  
  try {
    const assetInfo = await saveAsset(file.buffer, file.originalname, assetType);
    
    logger.info(`Asset uploaded: ${assetInfo.filename} (${file.originalname})`);

    res.status(201).json({
      success: true,
      message: 'Asset uploaded successfully',
      asset: {
        id: path.parse(assetInfo.filename).name,
        filename: assetInfo.filename,
        originalName: assetInfo.originalName,
        type: assetType,
        size: file.size,
        mimetype: file.mimetype,
        url: assetInfo.url,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Asset upload failed:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error.message
    });
  }
}));

// Upload multiple assets
router.post('/upload-multiple', upload.array('assets', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No files uploaded',
      message: 'Please provide files to upload'
    });
  }

  const uploadPromises = req.files.map(async (file) => {
    const assetType = getAssetType(file.mimetype);
    
    try {
      const assetInfo = await saveAsset(file.buffer, file.originalname, assetType);
      
      return {
        success: true,
        asset: {
          id: path.parse(assetInfo.filename).name,
          filename: assetInfo.filename,
          originalName: assetInfo.originalName,
          type: assetType,
          size: file.size,
          mimetype: file.mimetype,
          url: assetInfo.url,
          uploadedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        originalName: file.originalname
      };
    }
  });

  const results = await Promise.all(uploadPromises);
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  logger.info(`Multiple asset upload: ${successful.length} successful, ${failed.length} failed`);

  res.status(201).json({
    success: true,
    message: `${successful.length} assets uploaded successfully`,
    assets: successful.map(r => r.asset),
    failed: failed,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length
    }
  });
}));

// Get asset information
router.get('/:assetId', asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  
  // Try to find asset in different type directories
  const assetTypes = ['images', 'videos', 'audio', 'fonts', 'general'];
  let assetPath = null;
  let assetType = null;

  for (const type of assetTypes) {
    try {
      const testPath = await getAssetPath(`${assetId}.*`, type);
      if (testPath) {
        assetPath = testPath;
        assetType = type;
        break;
      }
    } catch (error) {
      // Continue searching
    }
  }

  if (!assetPath) {
    return res.status(404).json({
      success: false,
      error: 'Asset not found',
      message: `No asset found with ID: ${assetId}`
    });
  }

  try {
    const stats = await fs.stat(assetPath);
    const filename = path.basename(assetPath);
    
    res.json({
      success: true,
      asset: {
        id: assetId,
        filename: filename,
        type: assetType,
        size: stats.size,
        url: `/assets/${assetType}/${filename}`,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error retrieving asset information',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: Listar archivos multimedia
 *     tags: [Assets]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [images, videos, audio, fonts, general]
 *         description: Filtrar por tipo de archivo
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de resultados a omitir
 *     responses:
 *       200:
 *         description: Lista de archivos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 assets:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 */

// List assets
router.get('/', asyncHandler(async (req, res) => {
  const { type, limit = 50, offset = 0 } = req.query;
  const assetsDir = path.join(__dirname, '../../assets');
  
  try {
    const assetTypes = type ? [type] : ['images', 'videos', 'audio', 'fonts', 'general'];
    const allAssets = [];

    for (const assetType of assetTypes) {
      const typeDir = path.join(assetsDir, assetType);
      
      if (await fs.pathExists(typeDir)) {
        const files = await fs.readdir(typeDir);
        
        for (const file of files) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            allAssets.push({
              id: path.parse(file).name,
              filename: file,
              type: assetType,
              size: stats.size,
              url: `/assets/${assetType}/${file}`,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString()
            });
          }
        }
      }
    }

    // Sort by creation date (newest first)
    allAssets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedAssets = allAssets.slice(startIndex, endIndex);

    res.json({
      success: true,
      assets: paginatedAssets,
      pagination: {
        total: allAssets.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: endIndex < allAssets.length
      }
    });

  } catch (error) {
    logger.error('Error listing assets:', error);
    res.status(500).json({
      success: false,
      error: 'Error listing assets',
      message: error.message
    });
  }
}));

// Delete asset
router.delete('/:assetId', asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  
  // Find and delete asset
  const assetTypes = ['images', 'videos', 'audio', 'fonts', 'general'];
  let deleted = false;

  for (const type of assetTypes) {
    const typeDir = path.join(__dirname, '../../assets', type);
    
    if (await fs.pathExists(typeDir)) {
      const files = await fs.readdir(typeDir);
      const matchingFile = files.find(file => 
        path.parse(file).name === assetId
      );

      if (matchingFile) {
        const filePath = path.join(typeDir, matchingFile);
        await fs.remove(filePath);
        deleted = true;
        
        logger.info(`Asset deleted: ${assetId} (${matchingFile})`);
        break;
      }
    }
  }

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Asset not found',
      message: `No asset found with ID: ${assetId}`
    });
  }

  res.json({
    success: true,
    message: 'Asset deleted successfully',
    assetId: assetId
  });
}));

// Get asset types and statistics
router.get('/meta/stats', asyncHandler(async (req, res) => {
  const assetsDir = path.join(__dirname, '../../assets');
  const stats = {};

  try {
    const assetTypes = ['images', 'videos', 'audio', 'fonts', 'general'];
    
    for (const type of assetTypes) {
      const typeDir = path.join(assetsDir, type);
      
      if (await fs.pathExists(typeDir)) {
        const files = await fs.readdir(typeDir);
        const fileStats = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(typeDir, file);
            const stat = await fs.stat(filePath);
            return stat.isFile() ? stat.size : 0;
          })
        );

        stats[type] = {
          count: fileStats.length,
          totalSize: fileStats.reduce((sum, size) => sum + size, 0)
        };
      } else {
        stats[type] = {
          count: 0,
          totalSize: 0
        };
      }
    }

    const totalCount = Object.values(stats).reduce((sum, s) => sum + s.count, 0);
    const totalSize = Object.values(stats).reduce((sum, s) => sum + s.totalSize, 0);

    res.json({
      success: true,
      statistics: {
        byType: stats,
        total: {
          count: totalCount,
          size: totalSize,
          sizeFormatted: formatBytes(totalSize)
        }
      }
    });

  } catch (error) {
    logger.error('Error getting asset statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Error retrieving statistics',
      message: error.message
    });
  }
}));

// Cleanup old assets
router.post('/cleanup', asyncHandler(async (req, res) => {
  const { olderThanDays = 30 } = req.body;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const assetsDir = path.join(__dirname, '../../assets');
  const assetTypes = ['images', 'videos', 'audio', 'fonts', 'general'];
  let deletedCount = 0;
  let deletedSize = 0;

  try {
    for (const type of assetTypes) {
      const typeDir = path.join(assetsDir, type);
      
      if (await fs.pathExists(typeDir)) {
        const files = await fs.readdir(typeDir);
        
        for (const file of files) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile() && stats.mtime < cutoffDate) {
            deletedSize += stats.size;
            await fs.remove(filePath);
            deletedCount++;
          }
        }
      }
    }

    logger.info(`Asset cleanup completed: ${deletedCount} files deleted, ${formatBytes(deletedSize)} freed`);

    res.json({
      success: true,
      message: 'Asset cleanup completed',
      summary: {
        deletedFiles: deletedCount,
        freedSpace: formatBytes(deletedSize),
        cutoffDate: cutoffDate.toISOString()
      }
    });

  } catch (error) {
    logger.error('Error during asset cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      message: error.message
    });
  }
}));

// Helper functions
function getAssetType(mimetype) {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('font')) return 'fonts';
  return 'general';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router; 