const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Configuración de seguridad centralizada
 */
class SecurityConfig {
  constructor() {
    this.apiKeys = new Map();
    this.rateLimits = new Map();
    this.initializeDefaultKeys();
  }

  /**
   * Inicializar claves API por defecto
   */
  initializeDefaultKeys() {
    // Clave de desarrollo (solo para desarrollo local)
    if (process.env.NODE_ENV === 'development') {
      this.apiKeys.set('dev-client', {
        key: 'dev-api-key-2024',
        name: 'Development Client',
        permissions: ['read', 'write', 'admin'],
        rateLimit: {
          requests: 1000,
          window: 3600000 // 1 hora
        },
        createdAt: new Date().toISOString(),
        lastUsed: null
      });
    }

    // Cargar claves desde variables de entorno
    this.loadKeysFromEnvironment();
  }

  /**
   * Cargar claves API desde variables de entorno
   */
  loadKeysFromEnvironment() {
    const envKeys = process.env.API_KEYS;
    if (envKeys) {
      try {
        const keys = JSON.parse(envKeys);
        Object.entries(keys).forEach(([clientId, config]) => {
          this.apiKeys.set(clientId, {
            ...config,
            createdAt: config.createdAt || new Date().toISOString(),
            lastUsed: null
          });
        });
        logger.info(`Security: ${Object.keys(keys).length} claves API cargadas desde variables de entorno`);
      } catch (error) {
        logger.error('Security: Error parseando API_KEYS desde variables de entorno', error);
      }
    }
  }

  /**
   * Generar nueva clave API
   */
  generateApiKey(clientId, permissions = ['read'], rateLimit = null) {
    const key = this.generateSecureKey();
    const config = {
      key,
      name: `Client ${clientId}`,
      permissions,
      rateLimit: rateLimit || {
        requests: 100,
        window: 3600000 // 1 hora por defecto
      },
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    this.apiKeys.set(clientId, config);
    
    logger.info(`Security: Nueva clave API generada para ${clientId}`, {
      clientId,
      permissions,
      rateLimit: config.rateLimit
    });

    return {
      clientId,
      apiKey: key,
      permissions,
      rateLimit: config.rateLimit
    };
  }

  /**
   * Validar clave API
   */
  validateApiKey(clientId, providedKey) {
    const client = this.apiKeys.get(clientId);
    
    if (!client) {
      logger.warn(`Security: Cliente no encontrado: ${clientId}`);
      return { valid: false, error: 'CLIENT_NOT_FOUND' };
    }

    if (client.key !== providedKey) {
      logger.warn(`Security: Clave API inválida para ${clientId}`);
      return { valid: false, error: 'INVALID_API_KEY' };
    }

    // Actualizar último uso
    client.lastUsed = new Date().toISOString();
    
    return {
      valid: true,
      client: {
        id: clientId,
        name: client.name,
        permissions: client.permissions,
        rateLimit: client.rateLimit
      }
    };
  }

  /**
   * Verificar permisos
   */
  hasPermission(clientId, permission) {
    const client = this.apiKeys.get(clientId);
    return client && client.permissions.includes(permission);
  }

  /**
   * Verificar rate limiting
   */
  checkRateLimit(clientId, ip) {
    const client = this.apiKeys.get(clientId);
    if (!client) return { allowed: false, error: 'CLIENT_NOT_FOUND' };

    const key = `${clientId}:${ip}`;
    const now = Date.now();
    const window = client.rateLimit.window;
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, {
        requests: 1,
        windowStart: now,
        resetTime: now + window
      });
      return { allowed: true, remaining: client.rateLimit.requests - 1 };
    }

    const limit = this.rateLimits.get(key);
    
    // Resetear ventana si ha pasado el tiempo
    if (now >= limit.resetTime) {
      limit.requests = 1;
      limit.windowStart = now;
      limit.resetTime = now + window;
      return { allowed: true, remaining: client.rateLimit.requests - 1 };
    }

    // Verificar si excede el límite
    if (limit.requests >= client.rateLimit.requests) {
      return {
        allowed: false,
        error: 'RATE_LIMIT_EXCEEDED',
        resetTime: limit.resetTime,
        retryAfter: Math.ceil((limit.resetTime - now) / 1000)
      };
    }

    // Incrementar contador
    limit.requests++;
    
    return {
      allowed: true,
      remaining: client.rateLimit.requests - limit.requests
    };
  }

  /**
   * Generar clave segura
   */
  generateSecureKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Rotar clave API
   */
  rotateApiKey(clientId) {
    const client = this.apiKeys.get(clientId);
    if (!client) {
      throw new Error(`Cliente no encontrado: ${clientId}`);
    }

    const oldKey = client.key;
    const newKey = this.generateSecureKey();
    
    client.key = newKey;
    client.rotatedAt = new Date().toISOString();
    
    logger.info(`Security: Clave API rotada para ${clientId}`, {
      clientId,
      oldKeyPrefix: oldKey.substring(0, 8) + '...',
      newKeyPrefix: newKey.substring(0, 8) + '...'
    });

    return {
      clientId,
      oldKey: oldKey.substring(0, 8) + '...',
      newKey,
      rotatedAt: client.rotatedAt
    };
  }

  /**
   * Obtener estadísticas de uso
   */
  getUsageStats() {
    const stats = {
      totalClients: this.apiKeys.size,
      activeClients: 0,
      rateLimitHits: this.rateLimits.size,
      clientDetails: []
    };

    this.apiKeys.forEach((client, clientId) => {
      if (client.lastUsed) {
        stats.activeClients++;
      }
      
      stats.clientDetails.push({
        clientId,
        name: client.name,
        permissions: client.permissions,
        lastUsed: client.lastUsed,
        createdAt: client.createdAt,
        rateLimit: client.rateLimit
      });
    });

    return stats;
  }

  /**
   * Limpiar rate limits expirados
   */
  cleanupRateLimits() {
    const now = Date.now();
    let cleaned = 0;

    this.rateLimits.forEach((limit, key) => {
      if (now >= limit.resetTime) {
        this.rateLimits.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.debug(`Security: ${cleaned} rate limits limpiados`);
    }

    return cleaned;
  }
}

// Instancia singleton
const securityConfig = new SecurityConfig();

// Limpiar rate limits cada 5 minutos
setInterval(() => {
  securityConfig.cleanupRateLimits();
}, 5 * 60 * 1000);

module.exports = securityConfig; 