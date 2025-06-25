const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Middleware para manejo de archivos After Effects
 * Extraído de afterEffectsRoutes para separar responsabilidades
 */

// Configurar almacenamiento para archivos AEP
const createAEPStorage = () => {
  return multer.diskStorage({
    destination: async function (req, file, cb) {
      const uploadDir = './temp/aep-uploads/';
      try {
        await fs.ensureDir(uploadDir);
        cb(null, uploadDir);
      } catch (error) {
        logger.error('Error creando directorio de uploads', { error: error.message });
        cb(error);
      }
    },
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const uniqueName = `${timestamp}-${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  });
};

// Filtro de archivos para validar extensión
const aepFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext !== '.aep') {
    const error = new Error('Solo se permiten archivos .aep');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error);
  }
  
  // Validar nombre del archivo
  if (file.originalname.length > 255) {
    const error = new Error('Nombre de archivo demasiado largo');
    error.code = 'FILENAME_TOO_LONG';
    return cb(error);
  }
  
  cb(null, true);
};

// Configuración de multer para archivos AEP
const aepUpload = multer({
  storage: createAEPStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1 // Solo un archivo por request
  },
  fileFilter: aepFileFilter
});

/**
 * Middleware para subida de archivo AEP único
 */
const uploadSingleAEP = aepUpload.single('aepFile');

/**
 * Middleware para manejo de errores de multer
 */
const handleAEPUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.warn('Error de Multer en upload AEP', {
      error: error.message,
      code: error.code,
      clientId: req.client?.id
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          error: 'File too large',
          message: 'El archivo excede el límite de 100MB',
          code: 'FILE_TOO_LARGE'
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files',
          message: 'Solo se permite un archivo por request',
          code: 'TOO_MANY_FILES'
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected field',
          message: 'Campo de archivo inesperado. Use "aepFile"',
          code: 'UNEXPECTED_FIELD'
        });
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Upload error',
          message: error.message,
          code: error.code
        });
    }
  }

  if (error && error.code) {
    logger.warn('Error de validación en upload AEP', {
      error: error.message,
      code: error.code,
      clientId: req.client?.id
    });

    switch (error.code) {
      case 'INVALID_FILE_TYPE':
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
          message: 'Solo se permiten archivos .aep',
          code: 'INVALID_FILE_TYPE'
        });
      
      case 'FILENAME_TOO_LONG':
        return res.status(400).json({
          success: false,
          error: 'Filename too long',
          message: 'Nombre de archivo demasiado largo (máximo 255 caracteres)',
          code: 'FILENAME_TOO_LONG'
        });
      
      default:
        return res.status(400).json({
          success: false,
          error: 'File validation error',
          message: error.message,
          code: error.code
        });
    }
  }

  next(error);
};

/**
 * Middleware para validar que se subió un archivo
 */
const validateAEPFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      message: 'Se requiere un archivo .aep',
      code: 'NO_FILE_UPLOADED'
    });
  }

  // Agregar información del archivo al request
  req.aepFile = {
    originalName: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadedAt: new Date().toISOString()
  };

  logger.info('Archivo AEP subido exitosamente', {
    fileName: req.file.originalname,
    size: req.file.size,
    clientId: req.client?.id,
    correlationId: req.correlationId
  });

  next();
};

/**
 * Middleware para limpiar archivos temporales en caso de error
 */
const cleanupTempFile = async (req, res, next) => {
  // Agregar función de limpieza al objeto response
  res.cleanupTempFile = async () => {
    if (req.file?.path) {
      try {
        await fs.remove(req.file.path);
        logger.debug('Archivo temporal limpiado', {
          filePath: req.file.path,
          correlationId: req.correlationId
        });
      } catch (error) {
        logger.warn('Error limpiando archivo temporal', {
          filePath: req.file.path,
          error: error.message,
          correlationId: req.correlationId
        });
      }
    }
  };

  // Limpiar automáticamente en caso de error
  const originalSend = res.send;
  res.send = function(data) {
    // Si es una respuesta de error, limpiar archivo
    if (res.statusCode >= 400) {
      res.cleanupTempFile();
    }
    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware para validar parámetros de conversión
 */
const validateConversionParams = (req, res, next) => {
  const { templateName, templateDescription, saveTemplate } = req.body;

  // Validar templateName si se proporciona
  if (templateName && typeof templateName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid template name',
      message: 'templateName debe ser una cadena de texto',
      code: 'INVALID_TEMPLATE_NAME'
    });
  }

  if (templateName && templateName.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Template name too long',
      message: 'templateName no puede exceder 100 caracteres',
      code: 'TEMPLATE_NAME_TOO_LONG'
    });
  }

  // Validar templateDescription si se proporciona
  if (templateDescription && typeof templateDescription !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid template description',
      message: 'templateDescription debe ser una cadena de texto',
      code: 'INVALID_TEMPLATE_DESCRIPTION'
    });
  }

  if (templateDescription && templateDescription.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Template description too long',
      message: 'templateDescription no puede exceder 500 caracteres',
      code: 'TEMPLATE_DESCRIPTION_TOO_LONG'
    });
  }

  // Validar saveTemplate si se proporciona
  if (saveTemplate !== undefined) {
    const parsedSaveTemplate = saveTemplate === 'true' || saveTemplate === true;
    req.body.saveTemplate = parsedSaveTemplate;
  } else {
    req.body.saveTemplate = true; // Default a true
  }

  next();
};

/**
 * Middleware para agregar metadata de cliente al template
 */
const addClientMetadata = (req, res, next) => {
  req.templateMetadata = {
    clientId: req.client?.id,
    uploadedBy: req.client?.name || req.client?.id,
    uploadedAt: new Date().toISOString(),
    originalFileName: req.file?.originalname,
    fileSize: req.file?.size,
    correlationId: req.correlationId
  };

  next();
};

/**
 * Middleware combinado para procesamiento completo de AEP
 */
const processAEPUpload = [
  uploadSingleAEP,
  handleAEPUploadErrors,
  validateAEPFile,
  cleanupTempFile,
  validateConversionParams,
  addClientMetadata
];

module.exports = {
  uploadSingleAEP,
  handleAEPUploadErrors,
  validateAEPFile,
  cleanupTempFile,
  validateConversionParams,
  addClientMetadata,
  processAEPUpload
}; 