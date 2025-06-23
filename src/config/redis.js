const Redis = require('ioredis');
const logger = require('../utils/logger');

// Configuración de Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 60000,
  commandTimeout: 5000,
};

// Crear instancia de Redis para BullMQ
const redis = new Redis(redisConfig);

// Eventos de conexión
redis.on('connect', () => {
  logger.info('Redis: Conectando...');
});

redis.on('ready', () => {
  logger.info('Redis: Conexión establecida y lista');
});

redis.on('error', (error) => {
  logger.error('Redis: Error de conexión', error);
});

redis.on('close', () => {
  logger.warn('Redis: Conexión cerrada');
});

redis.on('reconnecting', () => {
  logger.info('Redis: Reconectando...');
});

// Función para verificar la conexión
async function checkRedisConnection() {
  try {
    await redis.ping();
    logger.info('Redis: Ping exitoso');
    return true;
  } catch (error) {
    logger.error('Redis: Ping falló', error);
    return false;
  }
}

// Función para cerrar la conexión
async function closeRedisConnection() {
  try {
    await redis.quit();
    logger.info('Redis: Conexión cerrada correctamente');
  } catch (error) {
    logger.error('Redis: Error al cerrar conexión', error);
  }
}

// Configuración específica para BullMQ
const bullMQConnection = {
  connection: {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
  },
};

module.exports = {
  redis,
  redisConfig,
  bullMQConnection,
  checkRedisConnection,
  closeRedisConnection
}; 