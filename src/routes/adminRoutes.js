const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { 
  addApiKey, 
  revokeApiKey, 
  listApiKeys, 
  getUsageStats 
} = require('../middleware/authMiddleware');
const { 
  getQueueStats, 
  cleanOldJobs, 
  pauseQueue, 
  resumeQueue 
} = require('../queues/videoQueue');
const { checkRedisConnection } = require('../config/redis');
const { getBucket, listFiles } = require('../config/firebase');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Panel de administración y monitoreo del sistema
 */

// Middleware para verificar permisos de admin
const requireAdmin = (req, res, next) => {
  if (!req.client.permissions.includes('*') && !req.client.permissions.includes('admin:*')) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'Se requieren permisos de administrador'
    });
  }
  next();
};

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Dashboard principal de administración
 *     tags: [Admin]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Información del dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 dashboard:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: object
 *                     queue:
 *                       type: object
 *                     uptime:
 *                       type: number
 *                     memory:
 *                       type: object
 *       403:
 *         description: Permisos de administrador requeridos
 */

// Dashboard principal
router.get('/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const [queueStats, redisConnected] = await Promise.all([
      getQueueStats(),
      checkRedisConnection()
    ]);

    const systemStatus = {
      timestamp: new Date().toISOString(),
      services: {
        redis: redisConnected ? 'connected' : 'disconnected',
        firebase: getBucket() ? 'connected' : 'disconnected',
        queue: queueStats.total > 0 || redisConnected ? 'operational' : 'idle'
      },
      queue: queueStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json({
      success: true,
      dashboard: systemStatus
    });

  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo datos del dashboard'
    });
  }
}));

// Gestión de API Keys

// Listar todas las API keys
router.get('/api-keys', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const apiKeys = listApiKeys();
    
    res.json({
      success: true,
      apiKeys: apiKeys.map(key => ({
        ...key,
        id: key.id.substring(0, 8) + '...' // Ocultar la key completa
      })),
      total: apiKeys.length
    });

  } catch (error) {
    logger.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error listando API keys'
    });
  }
}));

// Crear nueva API key
router.post('/api-keys', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { name, clientId, permissions, rateLimit } = req.body;

    if (!name || !clientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Los campos name y clientId son requeridos'
      });
    }

    const newKey = await addApiKey({
      name,
      clientId,
      permissions: permissions || ['*'],
      rateLimit: rateLimit || 100
    });

    logger.info(`Admin created new API key: ${clientId}`, {
      admin: req.client.id,
      newClientId: clientId
    });

    res.status(201).json({
      success: true,
      message: 'API key creada exitosamente',
      apiKey: newKey
    });

  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error creando API key'
    });
  }
}));

// Revocar API key
router.delete('/api-keys/:keyId', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { keyId } = req.params;

    await revokeApiKey(keyId);

    logger.info(`Admin revoked API key: ${keyId}`, {
      admin: req.client.id,
      revokedKey: keyId
    });

    res.json({
      success: true,
      message: 'API key revocada exitosamente'
    });

  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}));

// Obtener estadísticas de uso de una API key
router.get('/api-keys/:keyId/usage', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { keyId } = req.params;
    const stats = await getUsageStats(keyId);

    res.json({
      success: true,
      usage: stats
    });

  } catch (error) {
    logger.error('Error getting API key usage:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}));

// Gestión de Cola

// Obtener estadísticas detalladas de la cola
router.get('/queue/detailed', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const stats = await getQueueStats();
    
    res.json({
      success: true,
      queue: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting detailed queue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo estadísticas de cola'
    });
  }
}));

// Pausar cola de procesamiento
router.post('/queue/pause', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const success = await pauseQueue();

    if (success) {
      logger.info('Queue paused by admin', { admin: req.client.id });
      res.json({
        success: true,
        message: 'Cola pausada exitosamente'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to pause queue',
        message: 'Error pausando la cola'
      });
    }

  } catch (error) {
    logger.error('Error pausing queue:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error pausando la cola'
    });
  }
}));

// Reanudar cola de procesamiento
router.post('/queue/resume', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const success = await resumeQueue();

    if (success) {
      logger.info('Queue resumed by admin', { admin: req.client.id });
      res.json({
        success: true,
        message: 'Cola reanudada exitosamente'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to resume queue',
        message: 'Error reanudando la cola'
      });
    }

  } catch (error) {
    logger.error('Error resuming queue:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error reanudando la cola'
    });
  }
}));

// Limpiar trabajos antiguos
router.post('/queue/clean', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { olderThan = 24 } = req.body; // horas
    const olderThanMs = olderThan * 60 * 60 * 1000;

    const cleaned = await cleanOldJobs(olderThanMs);

    logger.info('Queue cleaned by admin', { 
      admin: req.client.id, 
      cleaned 
    });

    res.json({
      success: true,
      message: 'Limpieza completada',
      cleaned
    });

  } catch (error) {
    logger.error('Error cleaning queue:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error limpiando la cola'
    });
  }
}));

// Gestión de Storage

// Listar archivos en Firebase Storage
router.get('/storage/files', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { prefix = '', limit = 100 } = req.query;
    
    const files = await listFiles(prefix, parseInt(limit));

    res.json({
      success: true,
      files,
      total: files.length,
      prefix
    });

  } catch (error) {
    logger.error('Error listing storage files:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error listando archivos de almacenamiento'
    });
  }
}));

// Estadísticas de almacenamiento
router.get('/storage/stats', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const [outputs, inputs, thumbnails] = await Promise.all([
      listFiles('outputs/', 1000),
      listFiles('inputs/', 1000),
      listFiles('thumbnails/', 1000)
    ]);

    const calculateSize = (files) => files.reduce((sum, file) => sum + (parseInt(file.size) || 0), 0);

    const stats = {
      outputs: {
        count: outputs.length,
        totalSize: calculateSize(outputs)
      },
      inputs: {
        count: inputs.length,
        totalSize: calculateSize(inputs)
      },
      thumbnails: {
        count: thumbnails.length,
        totalSize: calculateSize(thumbnails)
      },
      total: {
        count: outputs.length + inputs.length + thumbnails.length,
        totalSize: calculateSize([...outputs, ...inputs, ...thumbnails])
      }
    };

    res.json({
      success: true,
      storage: stats
    });

  } catch (error) {
    logger.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo estadísticas de almacenamiento'
    });
  }
}));

// Sistema y Monitoreo

// Obtener logs del sistema
router.get('/logs', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;
    
    // Aquí se implementaría la lectura de logs
    // Por simplicidad, devolvemos un mensaje
    res.json({
      success: true,
      message: 'Funcionalidad de logs pendiente de implementar',
      logs: [],
      level,
      limit: parseInt(limit)
    });

  } catch (error) {
    logger.error('Error getting logs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo logs'
    });
  }
}));

// Información del sistema
router.get('/system/info', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const info = {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        workerConcurrency: process.env.WORKER_CONCURRENCY
      },
      services: {
        redis: await checkRedisConnection(),
        firebase: !!getBucket()
      }
    };

    res.json({
      success: true,
      system: info
    });

  } catch (error) {
    logger.error('Error getting system info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Error obteniendo información del sistema'
    });
  }
}));

// Salud del sistema
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const [redisConnected, queueStats] = await Promise.all([
      checkRedisConnection(),
      getQueueStats()
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisConnected ? 'up' : 'down',
        firebase: getBucket() ? 'up' : 'down',
        queue: redisConnected ? 'up' : 'down'
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        queueSize: queueStats.total
      }
    };

    // Determinar estado general
    const servicesDown = Object.values(health.services).filter(status => status === 'down').length;
    if (servicesDown > 0) {
      health.status = servicesDown === Object.keys(health.services).length ? 'unhealthy' : 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      health
    });

  } catch (error) {
    logger.error('Error checking health:', error);
    res.status(503).json({
      success: false,
      health: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }
    });
  }
}));

module.exports = router; 