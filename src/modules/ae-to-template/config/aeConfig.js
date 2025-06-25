/**
 * Configuración centralizada para el parser de After Effects
 * Elimina magic numbers y permite configuración externa
 */

const path = require('path');

const AE_PARSER_CONFIG = {
  // Valores por defecto para composiciones
  defaults: {
    composition: {
      width: 1920,
      height: 1080,
      frameRate: 24,
      duration: 10,
      backgroundColor: '#000000'
    },
    layer: {
      startTime: 0,
      duration: 5,
      opacity: 100,
      position: { x: 960, y: 540 },
      scale: { x: 100, y: 100 },
      rotation: 0
    },
    text: {
      fontSize: 48,
      fontFamily: 'Arial',
      color: '#ffffff'
    }
  },

  // Límites de procesamiento
  limits: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxAnalysisSize: 10 * 1024 * 1024, // 10MB para análisis binario
    maxLayers: 1000,
    maxCompositions: 100,
    maxKeyframes: 50,
    chunkSize: 4096,
    analysisTimeout: 30000 // 30 segundos
  },

  // Firmas binarias para análisis
  signatures: {
    RIFX: Buffer.from('RIFX'),
    ADBE: Buffer.from('ADBE'),
    comp: Buffer.from('comp'),
    layr: Buffer.from('layr'),
    TEXT: Buffer.from('TEXT'),
    SHAP: Buffer.from('SHAP'),
    FOOT: Buffer.from('FOOT'),
    EFCT: Buffer.from('EFCT'),
    EXPR: Buffer.from('EXPR'),
    ANIM: Buffer.from('ANIM'),
    KEYF: Buffer.from('KEYF')
  },

  // Mapeo de tipos
  typeMapping: {
    layer: {
      'text': 'text',
      'shape': 'shape',
      'av': 'video',
      'video': 'video',
      'image': 'image',
      'audio': 'audio',
      'null': 'shape',
      'unknown': 'shape'
    },
    asset: {
      'video': 'video',
      'audio': 'audio',
      'image': 'image',
      'unknown': 'image'
    },
    effect: ['blur', 'glow', 'drop_shadow', 'color_correction', 'transform', 'distort']
  },

  // Prioridades para ordenamiento de tracks
  trackPriority: {
    'background': 0,
    'shape': 1,
    'image': 2,
    'video': 3,
    'audio': 4,
    'text': 5
  },

  // Rutas y directorios
  paths: {
    temp: path.join(__dirname, '../../temp/ae-parsing'),
    scripts: path.join(__dirname, '../../scripts/ae-scripts'),
    output: path.join(__dirname, '../../output')
  },

  // Configuración de métodos de análisis
  methods: {
    extendScript: {
      enabled: false,
      timeout: 30000,
      retries: 2
    },
    afterEffectsModule: {
      enabled: false,
      timeout: 30000
    },
    enhancedBinaryParsing: {
      enabled: true,
      deepScan: true,
      extractAssets: true
    }
  },

  // Patrones para merge fields
  mergeFieldPatterns: [
    /\{\{([A-Z_]+)\}\}/g,
    /\$\{([A-Z_]+)\}/g,
    /%([A-Z_]+)%/g
  ],

  // Configuración de logging
  logging: {
    level: 'info',
    enablePerformance: true,
    enableDebug: false
  }
};

/**
 * Obtener configuración con posibilidad de override desde variables de entorno
 */
function getConfig() {
  const config = { ...AE_PARSER_CONFIG };

  // Override desde variables de entorno
  if (process.env.AE_DEFAULT_WIDTH) {
    config.defaults.composition.width = parseInt(process.env.AE_DEFAULT_WIDTH);
  }
  if (process.env.AE_DEFAULT_HEIGHT) {
    config.defaults.composition.height = parseInt(process.env.AE_DEFAULT_HEIGHT);
  }
  if (process.env.AE_DEFAULT_FPS) {
    config.defaults.composition.frameRate = parseInt(process.env.AE_DEFAULT_FPS);
  }
  if (process.env.AE_MAX_FILE_SIZE) {
    config.limits.maxFileSize = parseInt(process.env.AE_MAX_FILE_SIZE);
  }

  return config;
}

/**
 * Validar configuración
 */
function validateConfig(config) {
  const errors = [];

  if (config.defaults.composition.width <= 0) {
    errors.push('Invalid default width');
  }
  if (config.defaults.composition.height <= 0) {
    errors.push('Invalid default height');
  }
  if (config.defaults.composition.frameRate <= 0) {
    errors.push('Invalid default frame rate');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  getConfig,
  validateConfig,
  AE_PARSER_CONFIG
}; 