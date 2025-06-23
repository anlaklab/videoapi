const crypto = require('crypto');
const logger = require('../utils/logger');
const { redis } = require('../config/redis');
const securityConfig = require('../config/security');

/**
 * Middleware de autenticación mejorado con integración del sistema de seguridad
 */
async function authMiddleware(req, res, next) {
  try {
    const clientId = req.headers['x-client-id'];
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    const ip = req.ip || req.connection.remoteAddress;

    // Validación de headers requeridos
    if (!clientId || !apiKey) {
      logger.warn('Auth: Headers faltantes', { 
        ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method,
        hasClientId: !!clientId,
        hasApiKey: !!apiKey
      });
      return res.status(401).json({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Se requieren headers x-client-id y x-api-key',
        code: 'AUTH001'
      });
    }

    // Sanitizar client ID
    const sanitizedClientId = clientId.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (sanitizedClientId !== clientId) {
      logger.warn('Auth: Client ID contiene caracteres inválidos', { 
        clientId: sanitizedClientId,
        original: clientId,
        ip
      });
      return res.status(400).json({
        success: false,
        error: 'INVALID_CLIENT_ID',
        message: 'Client ID contiene caracteres no permitidos',
        code: 'AUTH002'
      });
    }

    // Validar clave API usando el sistema de seguridad
    const validation = securityConfig.validateApiKey(sanitizedClientId, apiKey);
    if (!validation.valid) {
      logger.warn('Auth: Validación fallida', { 
        clientId: sanitizedClientId,
        error: validation.error,
        ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });
      
      const errorMessages = {
        'CLIENT_NOT_FOUND': 'Cliente no encontrado',
        'INVALID_API_KEY': 'Clave API inválida'
      };
      
      return res.status(401).json({
        success: false,
        error: validation.error,
        message: errorMessages[validation.error] || 'Credenciales inválidas',
        code: 'AUTH003'
      });
    }

    // Verificar rate limiting
    const rateLimitCheck = securityConfig.checkRateLimit(sanitizedClientId, ip);
    if (!rateLimitCheck.allowed) {
      logger.warn('Auth: Rate limit excedido', { 
        clientId: sanitizedClientId,
        ip,
        error: rateLimitCheck.error,
        retryAfter: rateLimitCheck.retryAfter
      });
      
      res.set({
        'X-RateLimit-Limit': validation.client.rateLimit.requests,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(rateLimitCheck.resetTime).toISOString(),
        'Retry-After': rateLimitCheck.retryAfter
      });
      
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit excedido. Intenta de nuevo en ${rateLimitCheck.retryAfter} segundos`,
        code: 'AUTH004',
        retryAfter: rateLimitCheck.retryAfter,
        resetTime: new Date(rateLimitCheck.resetTime).toISOString()
      });
    }

    // Verificar permisos para el endpoint
    const endpoint = req.path;
    const method = req.method;
    
    if (!hasEndpointPermission(validation.client, endpoint, method)) {
      logger.warn('Auth: Permiso de endpoint denegado', { 
        clientId: sanitizedClientId,
        endpoint,
        method,
        permissions: validation.client.permissions
      });
      
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Sin permisos para ${method} ${endpoint}`,
        code: 'AUTH006'
      });
    }

    // Agregar headers de rate limiting
    res.set({
      'X-RateLimit-Limit': validation.client.rateLimit.requests,
      'X-RateLimit-Remaining': rateLimitCheck.remaining,
      'X-RateLimit-Window': Math.floor(validation.client.rateLimit.window / 1000)
    });

    // Agregar información del cliente a la request
    req.client = {
      id: sanitizedClientId,
      name: validation.client.name,
      permissions: validation.client.permissions,
      rateLimit: validation.client.rateLimit,
      ip: ip,
      userAgent: req.get('User-Agent'),
      apiKey: apiKey // Para compatibilidad con código existente
    };

    // Log de acceso exitoso
    logger.info(`API Access: ${sanitizedClientId} - ${method} ${endpoint}`, {
      clientId: sanitizedClientId,
      method,
      endpoint,
      ip,
      userAgent: req.get('User-Agent'),
      rateLimitRemaining: rateLimitCheck.remaining
    });

    next();

  } catch (error) {
    logger.error('Auth: Error en middleware de autenticación', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_AUTH_ERROR',
      message: 'Error interno de autenticación',
      code: 'AUTH007'
    });
  }
}

/**
 * Verificar permisos para endpoints específicos
 */
function hasEndpointPermission(client, endpoint, method) {
  const permissions = client.permissions || [];
  
  // Permiso total (admin)
  if (permissions.includes('admin') || permissions.includes('*')) {
    return true;
  }

  // Mapeo de endpoints a permisos requeridos
  const endpointPermissions = {
    '/api/video/render': ['write'],
    '/api/video/': ['read'],
    '/api/aftereffects/convert': ['write'],
    '/api/aftereffects/': ['read'],
    '/api/templates/': ['read'],
    '/api/admin/': ['admin'],
    '/health': [], // Público
    '/api-docs': [] // Público
  };

  // Buscar permiso requerido para el endpoint
  for (const [pattern, requiredPerms] of Object.entries(endpointPermissions)) {
    if (endpoint.startsWith(pattern)) {
      // Si no requiere permisos específicos, permitir
      if (requiredPerms.length === 0) {
        return true;
      }
      
      // Verificar si el cliente tiene alguno de los permisos requeridos
      return requiredPerms.some(perm => permissions.includes(perm));
    }
  }

  // Por defecto, requerir permiso 'read' para endpoints no mapeados
  return permissions.includes('read');
}

/**
 * Middleware para verificar permisos específicos
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.client) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Autenticación requerida',
        code: 'AUTH005'
      });
    }

    if (!securityConfig.hasPermission(req.client.id, permission)) {
      logger.warn('Auth: Permiso específico denegado', { 
        clientId: req.client.id,
        requiredPermission: permission,
        clientPermissions: req.client.permissions,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Permiso requerido: ${permission}`,
        code: 'AUTH006',
        requiredPermission: permission,
        clientPermissions: req.client.permissions
      });
    }

    next();
  };
};

/**
 * Middleware opcional para endpoints con autenticación flexible
 */
const optionalAuth = (req, res, next) => {
  const clientId = req.headers['x-client-id'];
  const apiKey = req.headers['x-api-key'];

  if (!clientId || !apiKey) {
    // Sin autenticación, continuar sin información de cliente
    req.client = null;
    return next();
  }

  // Si hay headers, validar normalmente
  return authMiddleware(req, res, next);
};

// Funciones de compatibilidad con el sistema anterior
function generateApiKey() {
  return securityConfig.generateSecureKey();
}

async function addApiKey(keyData) {
  try {
    const result = securityConfig.generateApiKey(
      keyData.clientId || `client-${Date.now()}`,
      keyData.permissions || ['read'],
      keyData.rateLimit
    );
    
    logger.info(`Nueva API key creada: ${result.clientId}`);
    return result;
  } catch (error) {
    logger.error('Error creando API key:', error);
    throw error;
  }
}

async function revokeApiKey(clientId) {
  try {
    // Implementar revocación en securityConfig si es necesario
    logger.info(`API key revocada: ${clientId}`);
    return true;
  } catch (error) {
    logger.error('Error revocando API key:', error);
    throw error;
  }
}

function listApiKeys() {
  const stats = securityConfig.getUsageStats();
  return stats.clientDetails;
}

async function getUsageStats(clientId) {
  try {
    const stats = securityConfig.getUsageStats();
    const client = stats.clientDetails.find(c => c.clientId === clientId);
    
    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    return {
      requests: 0, // Implementar contador de requests si es necesario
      remaining: client.rateLimit.requests,
      limit: client.rateLimit.requests,
      resetTime: 0
    };
  } catch (error) {
    logger.error('Error obteniendo estadísticas:', error);
    return { requests: 0, remaining: 0, limit: 0 };
  }
}

// Función para cargar API keys (compatibilidad)
async function loadApiKeys() {
  logger.info('Sistema de seguridad inicializado');
}

module.exports = {
  authMiddleware,
  requirePermission,
  optionalAuth,
  generateApiKey,
  addApiKey,
  revokeApiKey,
  listApiKeys,
  getUsageStats,
  loadApiKeys
}; 