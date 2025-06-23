const crypto = require('crypto');
const logger = require('../utils/logger');
const { redis } = require('../config/redis');

// Simulación de base de datos de API Keys (en producción usar base de datos real)
const API_KEYS = new Map();

// Cargar API keys desde variables de entorno o Redis
async function loadApiKeys() {
  try {
    // Cargar desde Redis si está disponible
    if (redis) {
      const keys = await redis.hgetall('api_keys');
      for (const [keyId, keyData] of Object.entries(keys)) {
        API_KEYS.set(keyId, JSON.parse(keyData));
      }
    }

    // API key de desarrollo desde variables de entorno
    if (process.env.DEV_API_KEY) {
      API_KEYS.set(process.env.DEV_API_KEY, {
        id: process.env.DEV_API_KEY,
        name: 'Development Key',
        clientId: 'dev-client',
        permissions: ['*'],
        rateLimit: 1000,
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    // API key por defecto para desarrollo
    if (process.env.NODE_ENV === 'development' && API_KEYS.size === 0) {
      const defaultKey = 'dev-key-12345';
      API_KEYS.set(defaultKey, {
        id: defaultKey,
        name: 'Default Development Key',
        clientId: 'dev-client',
        permissions: ['*'],
        rateLimit: 1000,
        active: true,
        createdAt: new Date().toISOString()
      });
      
      logger.warn(`⚠️  Usando API key por defecto: ${defaultKey}`);
    }

    logger.info(`Cargadas ${API_KEYS.size} API keys`);

  } catch (error) {
    logger.error('Error cargando API keys:', error);
  }
}

// Middleware de autenticación
async function authMiddleware(req, res, next) {
  try {
    // Obtener API key del header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key requerida',
        message: 'Debe proporcionar una API key válida en el header x-api-key'
      });
    }

    // Validar API key
    const keyData = API_KEYS.get(apiKey);
    
    if (!keyData) {
      logger.warn(`Intento de acceso con API key inválida: ${apiKey.substring(0, 8)}...`);
      return res.status(403).json({
        success: false,
        error: 'API key inválida',
        message: 'La API key proporcionada no es válida'
      });
    }

    if (!keyData.active) {
      return res.status(403).json({
        success: false,
        error: 'API key desactivada',
        message: 'La API key ha sido desactivada'
      });
    }

    // Verificar permisos
    const endpoint = req.path;
    const method = req.method;
    
    if (!hasPermission(keyData, endpoint, method)) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
        message: 'No tiene permisos para acceder a este endpoint'
      });
    }

    // Rate limiting por API key
    const rateLimitResult = await checkRateLimit(apiKey, keyData.rateLimit);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Límite de tasa excedido',
        message: `Ha excedido el límite de ${keyData.rateLimit} solicitudes por hora`,
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Agregar información del cliente a la request
    req.client = {
      id: keyData.clientId,
      apiKey: apiKey,
      name: keyData.name,
      permissions: keyData.permissions,
      rateLimit: keyData.rateLimit
    };

    // Log de acceso
    logger.info(`API Access: ${keyData.clientId} - ${method} ${endpoint}`, {
      clientId: keyData.clientId,
      endpoint,
      method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    next();

  } catch (error) {
    logger.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno de autenticación',
      message: 'Error procesando la autenticación'
    });
  }
}

// Verificar permisos
function hasPermission(keyData, endpoint, method) {
  const permissions = keyData.permissions || [];
  
  // Permiso total
  if (permissions.includes('*')) {
    return true;
  }

  // Verificar permisos específicos
  const permission = `${method.toLowerCase()}:${endpoint}`;
  const wildcardPermission = `${method.toLowerCase()}:${endpoint.split('/').slice(0, 3).join('/')}/*`;
  
  return permissions.includes(permission) || 
         permissions.includes(wildcardPermission) ||
         permissions.includes(`*:${endpoint}`) ||
         permissions.includes(`${method.toLowerCase()}:*`);
}

// Rate limiting por API key
async function checkRateLimit(apiKey, limit) {
  try {
    if (!redis) {
      return { allowed: true }; // Sin Redis, no hay rate limiting
    }

    const key = `rate_limit:${apiKey}`;
    const window = 3600; // 1 hora en segundos
    
    const current = await redis.get(key);
    
    if (!current) {
      await redis.setex(key, window, 1);
      return { allowed: true, remaining: limit - 1 };
    }

    const count = parseInt(current);
    
    if (count >= limit) {
      const ttl = await redis.ttl(key);
      return { 
        allowed: false, 
        remaining: 0,
        retryAfter: ttl > 0 ? ttl : window
      };
    }

    await redis.incr(key);
    return { 
      allowed: true, 
      remaining: limit - count - 1 
    };

  } catch (error) {
    logger.error('Error en rate limiting:', error);
    return { allowed: true }; // En caso de error, permitir acceso
  }
}

// Función para crear nueva API key
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Función para agregar nueva API key
async function addApiKey(keyData) {
  try {
    const apiKey = keyData.id || generateApiKey();
    
    const fullKeyData = {
      id: apiKey,
      name: keyData.name || 'Unnamed Key',
      clientId: keyData.clientId || `client-${Date.now()}`,
      permissions: keyData.permissions || ['*'],
      rateLimit: keyData.rateLimit || 100,
      active: keyData.active !== false,
      createdAt: new Date().toISOString(),
      ...keyData
    };

    API_KEYS.set(apiKey, fullKeyData);

    // Guardar en Redis si está disponible
    if (redis) {
      await redis.hset('api_keys', apiKey, JSON.stringify(fullKeyData));
    }

    logger.info(`Nueva API key creada: ${fullKeyData.clientId}`);
    return { apiKey, ...fullKeyData };

  } catch (error) {
    logger.error('Error creando API key:', error);
    throw error;
  }
}

// Función para revocar API key
async function revokeApiKey(apiKey) {
  try {
    const keyData = API_KEYS.get(apiKey);
    
    if (!keyData) {
      throw new Error('API key no encontrada');
    }

    API_KEYS.delete(apiKey);

    // Eliminar de Redis si está disponible
    if (redis) {
      await redis.hdel('api_keys', apiKey);
    }

    logger.info(`API key revocada: ${keyData.clientId}`);
    return true;

  } catch (error) {
    logger.error('Error revocando API key:', error);
    throw error;
  }
}

// Función para listar API keys
function listApiKeys() {
  return Array.from(API_KEYS.values()).map(key => ({
    id: key.id,
    name: key.name,
    clientId: key.clientId,
    permissions: key.permissions,
    rateLimit: key.rateLimit,
    active: key.active,
    createdAt: key.createdAt
  }));
}

// Función para obtener estadísticas de uso
async function getUsageStats(apiKey) {
  try {
    if (!redis) {
      return { requests: 0, remaining: 0 };
    }

    const key = `rate_limit:${apiKey}`;
    const current = await redis.get(key);
    const keyData = API_KEYS.get(apiKey);
    
    if (!keyData) {
      throw new Error('API key no encontrada');
    }

    const requests = current ? parseInt(current) : 0;
    const remaining = Math.max(0, keyData.rateLimit - requests);

    return {
      requests,
      remaining,
      limit: keyData.rateLimit,
      resetTime: current ? await redis.ttl(key) : 0
    };

  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    return { requests: 0, remaining: 0, limit: 0 };
  }
}

// Inicializar API keys al cargar el módulo
loadApiKeys();

module.exports = {
  authMiddleware,
  generateApiKey,
  addApiKey,
  revokeApiKey,
  listApiKeys,
  getUsageStats,
  loadApiKeys
}; 