const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Configuración de Firebase
let firebaseApp;

function initializeFirebase() {
  try {
    // Verificar si ya está inicializado
    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0];
      logger.info('Firebase: Ya inicializado, usando instancia existente');
      return firebaseApp;
    }

    // Configuración desde variables de entorno
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    // Inicializar Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
    });

    logger.info('Firebase: Inicializado correctamente');
    return firebaseApp;

  } catch (error) {
    logger.error('Firebase: Error en inicialización', error);
    
    // Fallback para desarrollo local sin Firebase
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Firebase: Modo desarrollo sin Firebase - usando almacenamiento local');
      return null;
    }
    
    throw error;
  }
}

// Obtener instancia de Storage
function getStorage() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  
  if (!firebaseApp) {
    return null; // Modo desarrollo
  }
  
  return admin.storage();
}

// Obtener bucket de almacenamiento
function getBucket() {
  const storage = getStorage();
  if (!storage) return null;
  
  return storage.bucket();
}

// Función para subir archivo
async function uploadFile(filePath, destination, metadata = {}) {
  try {
    const bucket = getBucket();
    if (!bucket) {
      throw new Error('Firebase Storage no disponible');
    }

    const [file] = await bucket.upload(filePath, {
      destination: destination,
      metadata: {
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // Hacer el archivo público
    await file.makePublic();

    // Obtener URL pública
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    
    logger.info(`Firebase: Archivo subido exitosamente - ${destination}`);
    return {
      file,
      publicUrl,
      destination
    };

  } catch (error) {
    logger.error('Firebase: Error subiendo archivo', error);
    throw error;
  }
}

// Función para obtener URL firmada
async function getSignedUrl(fileName, expiration = Date.now() + 1000 * 60 * 60) {
  try {
    const bucket = getBucket();
    if (!bucket) {
      throw new Error('Firebase Storage no disponible');
    }

    const file = bucket.file(fileName);
    
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiration
    });

    return signedUrl;

  } catch (error) {
    logger.error('Firebase: Error generando URL firmada', error);
    throw error;
  }
}

// Función para eliminar archivo
async function deleteFile(fileName) {
  try {
    const bucket = getBucket();
    if (!bucket) {
      throw new Error('Firebase Storage no disponible');
    }

    await bucket.file(fileName).delete();
    logger.info(`Firebase: Archivo eliminado - ${fileName}`);

  } catch (error) {
    logger.error('Firebase: Error eliminando archivo', error);
    throw error;
  }
}

// Función para verificar si un archivo existe
async function fileExists(fileName) {
  try {
    const bucket = getBucket();
    if (!bucket) return false;

    const [exists] = await bucket.file(fileName).exists();
    return exists;

  } catch (error) {
    logger.error('Firebase: Error verificando existencia de archivo', error);
    return false;
  }
}

// Función para listar archivos
async function listFiles(prefix = '', maxResults = 1000) {
  try {
    const bucket = getBucket();
    if (!bucket) {
      return [];
    }

    const [files] = await bucket.getFiles({
      prefix: prefix,
      maxResults: maxResults
    });

    return files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      timeCreated: file.metadata.timeCreated,
      updated: file.metadata.updated,
      publicUrl: `https://storage.googleapis.com/${bucket.name}/${file.name}`
    }));

  } catch (error) {
    logger.error('Firebase: Error listando archivos', error);
    return [];
  }
}

module.exports = {
  initializeFirebase,
  getStorage,
  getBucket,
  uploadFile,
  getSignedUrl,
  deleteFile,
  fileExists,
  listFiles,
  admin
}; 