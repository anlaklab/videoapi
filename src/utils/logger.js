const winston = require('winston');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
require('fs-extra').ensureDirSync(logsDir);

// Generar correlation ID para seguimiento de requests
const generateCorrelationId = () => uuidv4();

// Formatter personalizado para logging estructurado
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, correlationId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: service || 'json2video-api',
      correlationId,
      ...meta
    };
    
    // Agregar información de performance si está disponible
    if (meta.duration) {
      logEntry.performance = {
        duration: meta.duration,
        slow: meta.duration > 1000 // Marcar como lento si toma más de 1 segundo
      };
    }
    
    // Agregar información de memoria si está disponible
    if (process.memoryUsage && level === 'debug') {
      const memUsage = process.memoryUsage();
      logEntry.memory = {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      };
    }
    
    return JSON.stringify(logEntry);
  })
);

// Configuración del logger mejorado
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: { 
    service: 'json2video-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid,
    hostname: require('os').hostname()
  },
  transports: [
    // Archivo de errores críticos
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Archivo de warnings
    new winston.transports.File({ 
      filename: path.join(logsDir, 'warn.log'), 
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Archivo combinado
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 20971520, // 20MB
      maxFiles: 15,
      tailable: true
    }),
    
    // Archivo de performance para métricas
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, duration, ...meta }) => {
          if (!duration) return null; // Solo logs con información de performance
          return JSON.stringify({
            timestamp,
            level,
            message,
            duration,
            ...meta
          });
        })
      )
    })
  ],
});

// En desarrollo, también log a consola con formato legible
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, correlationId, duration, ...meta }) => {
        let output = `${timestamp} ${level}: ${message}`;
        
        if (correlationId) {
          output += ` [${correlationId.substring(0, 8)}]`;
        }
        
        if (duration) {
          output += ` (${duration}ms)`;
        }
        
        // Agregar metadata importante en desarrollo
        if (Object.keys(meta).length > 0) {
          const filteredMeta = { ...meta };
          delete filteredMeta.service;
          delete filteredMeta.version;
          delete filteredMeta.environment;
          delete filteredMeta.pid;
          delete filteredMeta.hostname;
          
          if (Object.keys(filteredMeta).length > 0) {
            output += ` ${JSON.stringify(filteredMeta)}`;
          }
        }
        
        return output;
      })
    )
  }));
}

// Wrapper para agregar correlation ID automáticamente
const createLoggerWithCorrelation = (correlationId) => {
  return {
    error: (message, meta = {}) => logger.error(message, { correlationId, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { correlationId, ...meta }),
    info: (message, meta = {}) => logger.info(message, { correlationId, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { correlationId, ...meta }),
    correlationId
  };
};

// Función para timing de operaciones
const timeOperation = (operationName, correlationId) => {
  const startTime = Date.now();
  
  return {
    end: (additionalMeta = {}) => {
      const duration = Date.now() - startTime;
      logger.info(`Operation completed: ${operationName}`, {
        correlationId,
        duration,
        operationName,
        ...additionalMeta
      });
      return duration;
    }
  };
};

// Función para logging de requests HTTP
const logHttpRequest = (req, res, correlationId) => {
  const startTime = Date.now();
  
  // Log inicial del request
  logger.info(`HTTP Request: ${req.method} ${req.originalUrl}`, {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    clientId: req.headers['x-client-id']
  });
  
  // Hook para response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info(`HTTP Response: ${req.method} ${req.originalUrl}`, {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      responseSize: data ? Buffer.byteLength(data, 'utf8') : 0,
      clientId: req.headers['x-client-id']
    });
    
    originalSend.call(this, data);
  };
  
  return correlationId;
};

// Función para logging de errores con contexto
const logError = (error, context = {}, correlationId = null) => {
  const errorInfo = {
    correlationId,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    },
    context,
    timestamp: new Date().toISOString()
  };
  
  logger.error('Application Error', errorInfo);
  
  return errorInfo;
};

// Middleware para agregar correlation ID a requests
const correlationMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Crear logger con correlation ID para este request
  req.logger = createLoggerWithCorrelation(correlationId);
  
  // Log del request
  logHttpRequest(req, res, correlationId);
  
  next();
};

// Exportar logger principal y utilidades
module.exports = logger;
module.exports.generateCorrelationId = generateCorrelationId;
module.exports.createLoggerWithCorrelation = createLoggerWithCorrelation;
module.exports.timeOperation = timeOperation;
module.exports.logHttpRequest = logHttpRequest;
module.exports.logError = logError;
module.exports.correlationMiddleware = correlationMiddleware; 