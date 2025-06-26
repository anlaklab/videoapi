/**
 * System Statistics Routes
 * Separated from mainRoutes.js for better organization
 */

const express = require('express');
const { execSync } = require('child_process');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Estadísticas del Sistema
 *     description: |
 *       Obtiene estadísticas detalladas de procesamiento y rendimiento:
 *       - Estadísticas de conversión AE → Template
 *       - Estadísticas de renderizado Template → Video
 *       - Métricas del sistema (memoria, uptime, etc.)
 *       - Trabajos activos en cola
 *     tags:
 *       - sistema
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcessingStats'
 */
router.get('/', async (req, res) => {
  try {
    const stats = {
      aeToTemplate: getAEToTemplateStats(),
      templateToVideo: getTemplateToVideoStats(),
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        ffmpegVersion: await getFFmpegVersion(),
        activeJobs: 0 // Will be updated when processors are available
      }
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas del sistema',
      message: error.message
    });
  }
});

// Helper functions
function getAEToTemplateStats() {
  // Default stats if processor not available
  return {
    totalProcessed: 0,
    averageProcessingTime: 0,
    successRate: 100,
    lastProcessed: null
  };
}

function getTemplateToVideoStats() {
  // Default stats if processor not available
  return {
    totalRendered: 0,
    averageRenderTime: 0,
    successRate: 100,
    lastRendered: null
  };
}

async function getFFmpegVersion() {
  try {
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const output = execSync(`"${ffmpegPath}" -version`, { 
      timeout: 5000, 
      encoding: 'utf8' 
    });
    const versionMatch = output.match(/ffmpeg version ([^\s]+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  } catch (error) {
    return 'not available';
  }
}

module.exports = router; 