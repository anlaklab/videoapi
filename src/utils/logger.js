/**
 * Logger simple para el servidor principal
 * Sin dependencias externas, compatible con el sistema existente
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class SimpleLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDir();
    this.operations = new Map(); // Para tracking de operaciones
  }

  ensureLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // Silenciar errores de creación de directorio
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  log(level, message, meta = {}) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Log a consola
    console.log(formattedMessage);
    
    // Log a archivo (opcional, no crítico)
    try {
      const logFile = path.join(this.logDir, 'server.log');
      fs.appendFileSync(logFile, formattedMessage + '\n');
    } catch (error) {
      // Silenciar errores de escritura de logs
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, meta);
    }
  }

  // Métodos faltantes para compatibilidad
  generateCorrelationId() {
    return `corr-${uuidv4().substring(0, 8)}`;
  }

  timeOperation(operationName, correlationId = null) {
    const id = correlationId || this.generateCorrelationId();
    const startTime = Date.now();
    
    this.operations.set(id, {
      name: operationName,
      startTime,
      correlationId: id
    });
    
    this.info(`⏱️  Starting operation: ${operationName}`, { correlationId: id });
    
    return {
      end: (meta = {}) => {
        const operation = this.operations.get(id);
        if (operation) {
          const duration = Date.now() - operation.startTime;
          this.info(`✅ Completed operation: ${operationName} (${duration}ms)`, {
            correlationId: id,
            duration,
            ...meta
          });
          this.operations.delete(id);
          return duration;
        }
        return 0;
      }
    };
  }
}

// Crear instancia singleton
const logger = new SimpleLogger();

module.exports = logger; 