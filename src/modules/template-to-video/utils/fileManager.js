const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

/**
 * Utilidades para manejo de archivos en el módulo Template-to-Video
 */

// Directorios base
const TEMP_DIR = process.env.TEMP_DIR || './temp';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

/**
 * Genera una ruta temporal única
 * @param {string} filename - Nombre del archivo (opcional)
 * @param {string} subdir - Subdirectorio dentro de temp (opcional)
 * @returns {string} Ruta completa del archivo temporal
 */
function generateTempPath(filename = null, subdir = 'processing') {
  const tempSubDir = path.join(TEMP_DIR, subdir);
  
  // Asegurar que el directorio existe
  fs.ensureDirSync(tempSubDir);
  
  if (!filename) {
    filename = `temp_${uuidv4()}.tmp`;
  }
  
  return path.join(tempSubDir, filename);
}

/**
 * Genera una ruta de salida única
 * @param {string} filename - Nombre del archivo
 * @param {string} subdir - Subdirectorio dentro de output (opcional)
 * @returns {string} Ruta completa del archivo de salida
 */
function generateOutputPath(filename, subdir = '') {
  const outputSubDir = subdir ? path.join(OUTPUT_DIR, subdir) : OUTPUT_DIR;
  
  // Asegurar que el directorio existe
  fs.ensureDirSync(outputSubDir);
  
  return path.join(outputSubDir, filename);
}

/**
 * Limpia archivos temporales antiguos
 * @param {number} maxAge - Edad máxima en milisegundos (default: 1 hora)
 */
async function cleanupOldTempFiles(maxAge = 60 * 60 * 1000) {
  try {
    const tempDir = path.join(TEMP_DIR, 'processing');
    
    if (!await fs.pathExists(tempDir)) {
      return;
    }
    
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.remove(filePath);
      }
    }
    
  } catch (error) {
    console.warn('Error limpiando archivos temporales:', error.message);
  }
}

/**
 * Obtiene el tamaño de un directorio
 * @param {string} dirPath - Ruta del directorio
 * @returns {Promise<number>} Tamaño en bytes
 */
async function getDirectorySize(dirPath) {
  try {
    let totalSize = 0;
    
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
    
  } catch (error) {
    return 0;
  }
}

/**
 * Crea un nombre de archivo único basado en timestamp y UUID
 * @param {string} extension - Extensión del archivo (sin punto)
 * @param {string} prefix - Prefijo opcional
 * @returns {string} Nombre de archivo único
 */
function generateUniqueFilename(extension = 'tmp', prefix = 'file') {
  const timestamp = Date.now();
  const uuid = uuidv4().split('-')[0]; // Solo la primera parte del UUID
  return `${prefix}_${timestamp}_${uuid}.${extension}`;
}

/**
 * Verifica si un archivo existe y es accesible
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<boolean>} True si el archivo existe y es accesible
 */
async function isFileAccessible(filePath) {
  try {
    await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Mueve un archivo de forma segura, creando directorios si es necesario
 * @param {string} sourcePath - Ruta origen
 * @param {string} destPath - Ruta destino
 * @returns {Promise<void>}
 */
async function safeMove(sourcePath, destPath) {
  try {
    // Asegurar que el directorio destino existe
    await fs.ensureDir(path.dirname(destPath));
    
    // Mover el archivo
    await fs.move(sourcePath, destPath, { overwrite: true });
    
  } catch (error) {
    throw new Error(`Error moviendo archivo de ${sourcePath} a ${destPath}: ${error.message}`);
  }
}

module.exports = {
  generateTempPath,
  generateOutputPath,
  cleanupOldTempFiles,
  getDirectorySize,
  generateUniqueFilename,
  isFileAccessible,
  safeMove,
  TEMP_DIR,
  OUTPUT_DIR
}; 