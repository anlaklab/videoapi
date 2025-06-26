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

// Import simplified routes
const simpleRoutes = require('./api/simpleRoutes');

const { setupDirectories } = require('./utils/fileManager');
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for serving generated videos
app.use('/output', express.static(path.join(__dirname, '../output')));
app.use('/temp', express.static(path.join(__dirname, '../temp')));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Swagger UI for API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'JSON2VIDEO API Documentation'
}));

// Use simplified API routes
app.use('/api', simpleRoutes);

// Frontend React Routes (if build exists)
app.get(['/cloud', '/studio', '/editor'], (req, res) => {
  const frontendBuildPath = path.join(__dirname, '../frontend/build/index.html');
  
  if (!fs.existsSync(frontendBuildPath)) {
    return res.status(503).send(`
      <!DOCTYPE html>
      <html lang="en">
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

// Home page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
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
            .endpoint {
                background: rgba(255, 255, 255, 0.1);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border-left: 4px solid #00d4ff;
            }
            .method {
                display: inline-block;
                background: #00d4ff;
                color: #000;
                padding: 4px 12px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 0.8em;
                margin-right: 10px;
            }
            .path {
                font-family: Monaco, monospace;
                font-weight: bold;
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
            <p class="subtitle">Simple API to convert JSON timelines into professional videos</p>
            
            <div class="endpoint">
                <h3><span class="method">POST</span> <span class="path">/api/render</span></h3>
                <p>Convert JSON timeline specifications to videos with support for text, images, videos, and audio tracks.</p>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span> <span class="path">/api/health</span></h3>
                <p>Check the health status of the JSON2VIDEO service.</p>
            </div>

            <div class="endpoint">
                <h3><span class="method">GET</span> <span class="path">/api/info</span></h3>
                <p>Get detailed information about the API endpoints and capabilities.</p>
            </div>

            <div style="background: rgba(0, 0, 0, 0.2); padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ffd700;">
                <h3>🔑 API Key</h3>
                <p>Include this header in your requests:</p>
                <code>x-api-key: dev-key-12345</code>
            </div>

            <div class="cta">
                <a href="/api-docs" class="btn">📚 API Documentation</a>
                <a href="/api/health" class="btn secondary">❤️ Health Check</a>
                <a href="/api/info" class="btn secondary">ℹ️ API Info</a>
            </div>

            <div style="text-align: center; margin-top: 40px; opacity: 0.7;">
                <p>🚀 JSON2VIDEO API | Port ${PORT} | Node.js ${process.version}</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'POST /api/render',
      'GET /api/health', 
      'GET /api/info',
      'GET /api-docs'
    ]
  });
});

// Initialize server
async function startServer() {
  try {
    logger.info('Starting JSON2VIDEO API Server...');
    
    // Setup required directories
    await setupDirectories();
    logger.info('✅ Directories configured');
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 JSON2VIDEO API Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`ℹ️ API Information: http://localhost:${PORT}/api/info`);
      logger.info(`🎬 Main endpoint: POST http://localhost:${PORT}/api/render`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received signal ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          logger.info('Cleanup completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup:', error);
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

startServer();

module.exports = app; 