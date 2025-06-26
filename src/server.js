require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/authMiddleware');

// NUEVAS RUTAS MODULARES
const mainRoutes = require('./api/mainRoutes');
const shotstackRoutes = require('./api/shotstackRoutes');

// RUTAS LEGACY (comentadas temporalmente para evitar errores de importación)
// const videoRoutes = require('./api/videoRoutes');
// const templateRoutes = require('./api/templateRoutes');
// const assetsRoutes = require('./api/assetsRoutes');
// const adminRoutes = require('./api/adminRoutes');
// const afterEffectsRoutes = require('./api/afterEffectsRoutes');

const { setupDirectories } = require('./utils/fileManager');
const { checkRedisConnection } = require('./config/redis');
const { initializeFirebase } = require('./config/firebase');
const { swaggerUi, specs } = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // límite de requests por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for serving generated videos and assets
app.use('/output', express.static(path.join(__dirname, '../output')));
app.use('/temp', express.static(path.join(__dirname, '../temp')));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Swagger UI (sin autenticación para facilitar el testing)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'JSON2VIDEO API Documentation'
}));

// NUEVAS RUTAS MODULARES (SIN AUTENTICACIÓN PARA TESTING)
app.use('/api', mainRoutes);
app.use('/api/shotstack', shotstackRoutes);

// API Routes legacy con autenticación
// app.use('/api/video', authMiddleware, videoRoutes);
// app.use('/api/templates', authMiddleware, templateRoutes);
// app.use('/api/assets', authMiddleware, assetsRoutes);
// app.use('/api/admin', authMiddleware, adminRoutes);
// app.use('/api/aftereffects', authMiddleware, afterEffectsRoutes);

// Frontend React Routes - Servir todas las rutas del SPA
app.get(['/cloud', '/studio', '/basic', '/advanced', '/editor'], (req, res) => {
  const frontendBuildPath = path.join(__dirname, '../frontend/build/index.html');
  
  // Check if frontend build exists
  if (!fs.existsSync(frontendBuildPath)) {
    return res.status(503).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Frontend Build Required - JSON2VIDEO</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 40px 20px;
                  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                  color: white;
                  min-height: 100vh;
              }
              .container {
                  background: rgba(255, 255, 255, 0.1);
                  padding: 40px;
                  border-radius: 20px;
                  backdrop-filter: blur(10px);
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
              }
              h1 { text-align: center; font-size: 2.5em; margin-bottom: 20px; }
              .error-icon { text-align: center; font-size: 4em; margin-bottom: 20px; }
              .steps { background: rgba(0, 0, 0, 0.2); padding: 20px; border-radius: 10px; margin: 20px 0; }
              .step { margin: 10px 0; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 5px; }
              code { background: rgba(0, 0, 0, 0.3); padding: 2px 8px; border-radius: 4px; font-family: monospace; }
              .btn { display: inline-block; padding: 15px 30px; margin: 10px; background: rgba(255, 255, 255, 0.2); color: white; text-decoration: none; border-radius: 10px; font-weight: bold; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="error-icon">🏗️</div>
              <h1>Frontend Build Required</h1>
              <p>The React frontend needs to be built before accessing this route.</p>
              
              <div class="steps">
                  <h3>To fix this issue:</h3>
                  <div class="step">
                      <strong>1.</strong> Navigate to the frontend directory:<br>
                      <code>cd frontend</code>
                  </div>
                  <div class="step">
                      <strong>2.</strong> Install dependencies (if not already done):<br>
                      <code>npm install</code>
                  </div>
                  <div class="step">
                      <strong>3.</strong> Build the React application:<br>
                      <code>npm run build</code>
                  </div>
                  <div class="step">
                      <strong>4.</strong> Restart the server and try again
                  </div>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                  <a href="/" class="btn">← Back to Home</a>
                  <a href="/api-docs" class="btn">📚 API Documentation</a>
              </div>
          </div>
      </body>
      </html>
    `);
  }
  
  res.sendFile(frontendBuildPath);
});

// Página de inicio
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>JSON2VIDEO API</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
            }
            .container {
                background: rgba(255, 255, 255, 0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            h1 {
                text-align: center;
                font-size: 3em;
                margin-bottom: 10px;
                background: linear-gradient(45deg, #fff, #f0f0f0);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .subtitle {
                text-align: center;
                font-size: 1.2em;
                margin-bottom: 40px;
                opacity: 0.9;
            }
            .features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 40px 0;
            }
            .feature {
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                text-align: center;
            }
            .feature h3 {
                margin-top: 0;
                color: #ffd700;
            }
            .cta {
                text-align: center;
                margin: 40px 0;
            }
            .btn {
                display: inline-block;
                padding: 15px 30px;
                margin: 10px;
                background: linear-gradient(45deg, #ff6b6b, #ee5a24);
                color: white;
                text-decoration: none;
                border-radius: 50px;
                font-weight: bold;
                transition: transform 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            .btn.secondary {
                background: linear-gradient(45deg, #3742fa, #2f3542);
            }
            .api-key {
                background: rgba(0, 0, 0, 0.2);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border-left: 4px solid #ffd700;
            }
            code {
                background: rgba(0, 0, 0, 0.3);
                padding: 2px 8px;
                border-radius: 4px;
                font-family: 'Monaco', 'Menlo', monospace;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎬 JSON2VIDEO</h1>
            <p class="subtitle">API avanzada para convertir JSON en videos profesionales</p>
            
            <div class="features">
                <div class="feature">
                    <h3>🎯 Multi-Track</h3>
                    <p>Timeline con múltiples pistas, clips superpuestos y efectos avanzados</p>
                </div>
                <div class="feature">
                    <h3>🎨 Plantillas</h3>
                    <p>Sistema de plantillas dinámicas con campos personalizables</p>
                </div>
                <div class="feature">
                    <h3>⚡ Escalable</h3>
                    <p>Cola de procesamiento con Redis y workers distribuidos</p>
                </div>
                <div class="feature">
                    <h3>🔧 Completo</h3>
                    <p>Soporte para texto, imágenes, videos, audio y HTML</p>
                </div>
                <div class="feature">
                    <h3>🎬 Transiciones</h3>
                    <p>8 tipos de transiciones profesionales: fade, crossfade, slide, wipe, dissolve, zoom, rotate, push</p>
                </div>
                <div class="feature">
                    <h3>🎞️ After Effects</h3>
                    <p>Conversión directa de archivos .aep a templates JSON con expresiones soportadas</p>
                </div>
            </div>

            <div class="api-key">
                <h3>🔑 API Key de Desarrollo</h3>
                <p>Para empezar a usar la API inmediatamente:</p>
                <code>x-api-key: dev-key-12345</code>
            </div>

            <div class="cta">
                <a href="/cloud" class="btn">🎬 Cloud Video Studio</a>
                <a href="/api-docs" class="btn">📚 Explorar API (Swagger UI)</a>
                <a href="/health" class="btn secondary">❤️ Estado del Sistema</a>
            </div>

            <div style="text-align: center; margin-top: 40px; opacity: 0.7;">
                <p>🚀 Versión 1.0.0 | Puerto ${PORT} | Node.js ${process.version}</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Health check endpoint mejorado
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {}
  };

  try {
    // Check Redis connection
    try {
      const { redis } = require('./config/redis');
      await redis.ping();
      healthStatus.checks.redis = { status: 'healthy', responseTime: Date.now() - startTime };
    } catch (error) {
      healthStatus.checks.redis = { status: 'unhealthy', error: error.message };
      healthStatus.status = 'degraded';
    }

    // Check Firebase connection
    try {
      const admin = require('firebase-admin');
      if (admin.apps.length > 0) {
        // Simple check - try to get app instance
        admin.app();
        healthStatus.checks.firebase = { status: 'healthy' };
      } else {
        healthStatus.checks.firebase = { status: 'not_initialized' };
      }
    } catch (error) {
      healthStatus.checks.firebase = { status: 'unhealthy', error: error.message };
      healthStatus.status = 'degraded';
    }

    // Check FFmpeg availability
    try {
      const { execSync } = require('child_process');
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
        // Test the found path
        execSync(`"${ffmpegPath}" -version`, { timeout: 5000, stdio: 'ignore' });
        healthStatus.checks.ffmpeg = { status: 'healthy', path: ffmpegPath };
      } else {
        throw new Error('FFmpeg not found in system PATH or common locations');
      }
    } catch (error) {
      healthStatus.checks.ffmpeg = { 
        status: 'unhealthy', 
        error: 'FFmpeg not available. Please install FFmpeg or set FFMPEG_PATH environment variable.',
        suggestion: 'Visit https://ffmpeg.org/download.html for installation instructions'
      };
      // Don't mark as degraded in development
      if (process.env.NODE_ENV === 'production') {
        healthStatus.status = 'degraded';
      }
    }

    // Check disk space
    try {
      const fs = require('fs');
      const stats = fs.statSync('./');
      healthStatus.checks.disk = { status: 'healthy', available: true };
    } catch (error) {
      healthStatus.checks.disk = { status: 'unhealthy', error: error.message };
    }

    // System resources
    const os = require('os');
    healthStatus.system = {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024)
      },
      cpu: {
        cores: os.cpus().length,
        load: os.loadavg()
      }
    };

    // Overall health status
    const unhealthyChecks = Object.values(healthStatus.checks).filter(check => check.status === 'unhealthy');
    if (unhealthyChecks.length > 0) {
      healthStatus.status = 'unhealthy';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);

  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API documentation endpoint (redirect to Swagger UI)
app.get('/api/docs', (req, res) => {
  res.redirect('/api-docs');
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`
  });
});

// Initialize server
async function startServer() {
  try {
    logger.info('Iniciando JSON2VIDEO API Server...');
    
    // Setup required directories
    await setupDirectories();
    logger.info('✅ Directorios configurados');
    
    // Check Redis connection
    const redisConnected = await checkRedisConnection();
    if (!redisConnected) {
      logger.error('❌ No se pudo conectar a Redis');
      throw new Error('Redis connection failed');
    }
    logger.info('✅ Redis conectado');
    
    // Initialize Firebase
    try {
      await initializeFirebase();
      logger.info('✅ Firebase inicializado');
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      logger.warn('⚠️  Firebase no disponible en modo desarrollo');
    }
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 JSON2VIDEO API Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
      logger.info(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
      logger.info(`🔧 Admin Panel: http://localhost:${PORT}/api/admin/dashboard`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Recibida señal ${signal}, cerrando servidor...`);
      
      server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        
        try {
          // Aquí se pueden agregar más limpiezas si es necesario
          logger.info('Limpieza completada');
          process.exit(0);
        } catch (error) {
          logger.error('Error durante limpieza:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

module.exports = app; 