/**
 * Sistema centralizado de manejo de errores para After Effects Parser
 * Proporciona manejo robusto de errores con mensajes claros
 */

const logger = require('./logger');

/**
 * Tipos de errores específicos de AE
 */
const AE_ERROR_TYPES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_AE_FILE: 'INVALID_AE_FILE',
  PARSING_FAILED: 'PARSING_FAILED',
  NO_COMPOSITIONS: 'NO_COMPOSITIONS',
  INVALID_COMPOSITION: 'INVALID_COMPOSITION',
  LAYER_PROCESSING_ERROR: 'LAYER_PROCESSING_ERROR',
  ASSET_PROCESSING_ERROR: 'ASSET_PROCESSING_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

/**
 * Clase de error personalizada para After Effects
 */
class AEParsingError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.name = 'AEParsingError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Resultado de operación con manejo de errores
 */
class AEOperationResult {
  constructor(success = false, data = null, error = null) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }

  static success(data) {
    return new AEOperationResult(true, data, null);
  }

  static failure(error) {
    return new AEOperationResult(false, null, error);
  }

  static fromTryCatch(operation) {
    try {
      const result = operation();
      return AEOperationResult.success(result);
    } catch (error) {
      return AEOperationResult.failure(error);
    }
  }
}

/**
 * Crear error tipificado de AE
 */
function createAEError(type, message, details = {}) {
  return new AEParsingError(type, message, details);
}

/**
 * Validar archivo AE
 */
function validateAEFile(filePath, stats) {
  const errors = [];
  
  if (!filePath) {
    errors.push(createAEError(AE_ERROR_TYPES.FILE_NOT_FOUND, 'File path is required'));
  }
  
  if (!stats) {
    errors.push(createAEError(AE_ERROR_TYPES.FILE_NOT_FOUND, `File not found: ${filePath}`));
  } else {
    if (stats.size === 0) {
      errors.push(createAEError(AE_ERROR_TYPES.INVALID_AE_FILE, 'File is empty'));
    }
    
    if (stats.size > 100 * 1024 * 1024) { // 100MB
      errors.push(createAEError(AE_ERROR_TYPES.FILE_TOO_LARGE, 'File too large for processing', {
        size: stats.size,
        maxSize: 100 * 1024 * 1024
      }));
    }
  }
  
  const extension = filePath ? filePath.toLowerCase() : '';
  if (!extension.endsWith('.aep')) {
    errors.push(createAEError(AE_ERROR_TYPES.INVALID_AE_FILE, 'File is not an After Effects project (.aep)'));
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validar datos de composición
 */
function validateComposition(composition) {
  const errors = [];
  const warnings = [];
  
  if (!composition) {
    errors.push(createAEError(AE_ERROR_TYPES.INVALID_COMPOSITION, 'Composition is null or undefined'));
    return { isValid: false, errors, warnings };
  }
  
  if (!composition.name) {
    warnings.push('Composition has no name');
  }
  
  if (!composition.width || composition.width <= 0) {
    errors.push(createAEError(AE_ERROR_TYPES.INVALID_COMPOSITION, 'Invalid composition width', {
      width: composition.width
    }));
  }
  
  if (!composition.height || composition.height <= 0) {
    errors.push(createAEError(AE_ERROR_TYPES.INVALID_COMPOSITION, 'Invalid composition height', {
      height: composition.height
    }));
  }
  
  if (!composition.frameRate || composition.frameRate <= 0) {
    warnings.push('Invalid or missing frame rate');
  }
  
  if (!composition.duration || composition.duration <= 0) {
    warnings.push('Invalid or missing duration');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Manejar errores de manera segura con logging
 */
function handleError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    type: error.type || 'UNKNOWN_ERROR',
    context,
    timestamp: new Date().toISOString()
  };
  
  if (error instanceof AEParsingError) {
    errorInfo.details = error.details;
    errorInfo.type = error.type;
  }
  
  logger.error('AE Parser Error', errorInfo);
  
  return errorInfo;
}

/**
 * Wrapper para operaciones que pueden fallar
 */
async function safeOperation(operation, errorType, context = {}) {
  try {
    const result = await operation();
    return AEOperationResult.success(result);
  } catch (error) {
    const aeError = error instanceof AEParsingError 
      ? error 
      : createAEError(errorType, error.message, { originalError: error.message, context });
    
    handleError(aeError, context);
    return AEOperationResult.failure(aeError);
  }
}

/**
 * Validar resultado de análisis
 */
function validateAnalysisResult(result) {
  const errors = [];
  
  if (!result) {
    errors.push(createAEError(AE_ERROR_TYPES.PARSING_FAILED, 'Analysis result is null'));
    return { isValid: false, errors };
  }
  
  if (!result.compositions || result.compositions.length === 0) {
    errors.push(createAEError(AE_ERROR_TYPES.NO_COMPOSITIONS, 'No compositions found in project'));
  }
  
  if (!result.metadata) {
    errors.push(createAEError(AE_ERROR_TYPES.PARSING_FAILED, 'Missing analysis metadata'));
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Crear resumen de errores para reporting
 */
function createErrorSummary(errors) {
  const summary = {
    total: errors.length,
    byType: {},
    critical: [],
    warnings: []
  };
  
  errors.forEach(error => {
    const type = error.type || 'UNKNOWN';
    summary.byType[type] = (summary.byType[type] || 0) + 1;
    
    if (type.includes('ERROR') || type.includes('FAILED')) {
      summary.critical.push(error);
    } else {
      summary.warnings.push(error);
    }
  });
  
  return summary;
}

module.exports = {
  AE_ERROR_TYPES,
  AEParsingError,
  AEOperationResult,
  createAEError,
  validateAEFile,
  validateComposition,
  handleError,
  safeOperation,
  validateAnalysisResult,
  createErrorSummary
}; 