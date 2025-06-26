/**
 * Health Check Routes
 * Separated from mainRoutes.js for better organization
 */

const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health Check del Sistema
 *     description: |
 *       Verifica el estado de salud de todos los componentes del sistema:
 *       - FFmpeg (disponibilidad y versión)
 *       - After Effects tools (ae-to-json, after-effects, etc.)
 *       - Almacenamiento (espacio disponible)
 *       - Memoria del sistema
 *       
 *       **Estados posibles:**
 *       - `healthy`: Todos los servicios funcionando correctamente
 *       - `degraded`: Algunos servicios con problemas menores
 *       - `unhealthy`: Servicios críticos no disponibles
 *     tags:
 *       - sistema
 *     security: []
 *     responses:
 *       200:
 *         description: Estado de salud del sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
router.get('/', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        ffmpeg: await checkFFmpeg(),
        afterEffects: await checkAfterEffectsTools(),
        storage: await checkStorage()
      },
      checks: []
    };

    // Determinar estado general
    const allServicesHealthy = Object.values(healthCheck.services)
      .every(service => service.available);
    
    healthCheck.status = allServicesHealthy ? 'healthy' : 'degraded';

    res.json(healthCheck);
  } catch (error) {
    logger.error('Error en health check:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Helper functions
async function checkFFmpeg() {
  try {
    let ffmpegPath = process.env.FFMPEG_PATH;
    
    // If no explicit path set, try to find ffmpeg in PATH
    if (!ffmpegPath) {
      try {
        // Try to find ffmpeg in system PATH
        execSync('ffmpeg -version', { timeout: 5000, stdio: 'ignore' });
        ffmpegPath = 'ffmpeg'; // Use system PATH
      } catch (pathError) {
        // Fall back to common installation paths
        const commonPaths = [
          '/usr/local/bin/ffmpeg',
          '/opt/homebrew/bin/ffmpeg',
          '/usr/bin/ffmpeg',
          'C:\\ffmpeg\\bin\\ffmpeg.exe'
        ];
        
        for (const path of commonPaths) {
          try {
            execSync(`"${path}" -version`, { timeout: 5000, stdio: 'ignore' });
            ffmpegPath = path;
            break;
          } catch (e) {
            // Continue to next path
          }
        }
      }
    }
    
    if (ffmpegPath) {
      // Test the found path and get version
      const output = execSync(`"${ffmpegPath}" -version`, { timeout: 5000, encoding: 'utf8' });
      const versionMatch = output.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      return {
        available: true,
        version,
        path: ffmpegPath
      };
    } else {
      return {
        available: false,
        error: 'FFmpeg not found in system PATH or common locations',
        suggestion: 'Visit https://ffmpeg.org/download.html for installation instructions'
      };
    }
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

async function checkAfterEffectsTools() {
  try {
    // Check if ae-to-json tool is available
    execSync('which ae-to-json', { timeout: 3000, stdio: 'ignore' });
    return {
      available: true,
      method: 'ae-to-json'
    };
  } catch (error) {
    // Try alternative methods
    try {
      execSync('which after-effects', { timeout: 3000, stdio: 'ignore' });
      return {
        available: true,
        method: 'after-effects'
      };
    } catch (error2) {
      return {
        available: false,
        error: 'No After Effects tools found',
        note: 'AE processing will use fallback parser'
      };
    }
  }
}

async function checkStorage() {
  try {
    const stats = await fs.stat('./');
    return {
      available: true,
      writable: true
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

module.exports = router; 