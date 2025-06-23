const fs = require('fs-extra');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * AEAssetScanner - Escanea y procesa assets de After Effects
 * 
 * Responsabilidades:
 * - Escanear directorios de assets
 * - Catalogar archivos de medios (.mov, .mp4, .jpg, .png, etc.)
 * - Generar metadatos de assets
 * - Validar existencia y accesibilidad de archivos
 */
class AEAssetScanner {
  constructor() {
    this.supportedVideoFormats = ['.mov', '.mp4', '.avi', '.mkv', '.webm'];
    this.supportedImageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
    this.supportedAudioFormats = ['.mp3', '.wav', '.aac', '.m4a', '.ogg'];
    
    this.assetCache = new Map();
  }

  /**
   * Escanea un directorio de assets de After Effects
   */
  async scanAssetsDirectory(directory) {
    try {
      logger.info(`🔍 Escaneando directorio de assets: ${directory}`);
      
      if (!await fs.pathExists(directory)) {
        logger.warn(`Directorio no encontrado: ${directory}`);
        return [];
      }

      const assets = [];
      await this.scanDirectoryRecursive(directory, assets);
      
      logger.info(`✅ Encontrados ${assets.length} assets en ${directory}`);
      return assets;
      
    } catch (error) {
      logger.error(`Error escaneando directorio ${directory}:`, error.message);
      return [];
    }
  }

  /**
   * Escanea recursivamente un directorio
   */
  async scanDirectoryRecursive(directory, assets, baseDir = null) {
    if (!baseDir) {
      baseDir = directory;
    }

    const items = await fs.readdir(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await this.scanDirectoryRecursive(fullPath, assets, baseDir);
      } else if (stats.isFile()) {
        const asset = await this.processAssetFile(fullPath, baseDir);
        if (asset) {
          assets.push(asset);
        }
      }
    }
  }

  /**
   * Procesa un archivo individual de asset
   */
  async processAssetFile(filePath, baseDir) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const relativePath = path.relative(baseDir, filePath);
    
    // Determinar tipo de asset
    let assetType = 'unknown';
    if (this.supportedVideoFormats.includes(ext)) {
      assetType = 'video';
    } else if (this.supportedImageFormats.includes(ext)) {
      assetType = 'image';
    } else if (this.supportedAudioFormats.includes(ext)) {
      assetType = 'audio';
    } else {
      return null; // Tipo no soportado
    }

    try {
      const stats = await fs.stat(filePath);
      
      const asset = {
        id: this.generateAssetId(filePath),
        name: path.basename(fileName, ext),
        fileName,
        type: assetType,
        extension: ext,
        absolutePath: filePath,
        relativePath,
        size: stats.size,
        lastModified: stats.mtime,
        metadata: await this.extractMetadata(filePath, assetType)
      };

      // Cachear el asset
      this.assetCache.set(asset.id, asset);
      
      return asset;
      
    } catch (error) {
      logger.warn(`Error procesando archivo ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Extrae metadatos específicos del tipo de asset
   */
  async extractMetadata(filePath, assetType) {
    const metadata = {};
    
    try {
      switch (assetType) {
        case 'video':
          metadata.duration = await this.getVideoDuration(filePath);
          metadata.dimensions = await this.getVideoDimensions(filePath);
          break;
          
        case 'image':
          metadata.dimensions = await this.getImageDimensions(filePath);
          break;
          
        case 'audio':
          metadata.duration = await this.getAudioDuration(filePath);
          break;
      }
    } catch (error) {
      logger.warn(`Error extrayendo metadatos de ${filePath}:`, error.message);
    }
    
    return metadata;
  }

  /**
   * Obtiene la duración de un video (simulado)
   */
  async getVideoDuration(filePath) {
    // En una implementación real, usaríamos ffprobe
    // Por ahora, retornamos una duración estimada
    return 10; // segundos
  }

  /**
   * Obtiene las dimensiones de un video (simulado)
   */
  async getVideoDimensions(filePath) {
    // En una implementación real, usaríamos ffprobe
    return { width: 1920, height: 1080 };
  }

  /**
   * Obtiene las dimensiones de una imagen (simulado)
   */
  async getImageDimensions(filePath) {
    // En una implementación real, usaríamos una librería como sharp
    return { width: 1920, height: 1080 };
  }

  /**
   * Obtiene la duración de un audio (simulado)
   */
  async getAudioDuration(filePath) {
    // En una implementación real, usaríamos ffprobe
    return 10; // segundos
  }

  /**
   * Genera un ID único para un asset
   */
  generateAssetId(filePath) {
    // Usar el hash del path relativo para generar un ID consistente
    const crypto = require('crypto');
    return crypto.createHash('md5').update(filePath).digest('hex').substring(0, 16);
  }

  /**
   * Escanea assets específicos del Phone Mockup Kit
   */
  async scanPhoneMockupAssets(footagePath) {
    const assets = [];
    
    try {
      const animatedKitPath = path.join(footagePath, 'Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders');
      
      if (!await fs.pathExists(animatedKitPath)) {
        logger.warn(`Path del Phone Mockup Kit no encontrado: ${animatedKitPath}`);
        return assets;
      }

      const folders = await fs.readdir(animatedKitPath);
      
      for (const folder of folders) {
        const folderPath = path.join(animatedKitPath, folder);
        const stat = await fs.stat(folderPath);
        
        if (stat.isDirectory()) {
          const assetGroup = await this.processPhoneMockupVariant(folder, folderPath);
          if (assetGroup.components.length > 0) {
            assets.push(assetGroup);
          }
        }
      }
      
      logger.info(`✅ Encontradas ${assets.length} variantes del Phone Mockup Kit`);
      
    } catch (error) {
      logger.error(`Error escaneando Phone Mockup assets:`, error.message);
    }
    
    return assets;
  }

  /**
   * Procesa una variante específica del Phone Mockup Kit
   */
  async processPhoneMockupVariant(variantId, folderPath) {
    const components = [];
    
    try {
      const files = await fs.readdir(folderPath);
      
      for (const file of files) {
        if (file.endsWith('.mov')) {
          const component = file.replace('.mov', '').toLowerCase();
          const filePath = path.join(folderPath, file);
          
          const asset = {
            component,
            fileName: file,
            absolutePath: filePath,
            relativePath: path.relative(process.cwd(), filePath),
            size: (await fs.stat(filePath)).size
          };
          
          components.push(asset);
        }
      }
      
    } catch (error) {
      logger.warn(`Error procesando variante ${variantId}:`, error.message);
    }
    
    return {
      id: variantId,
      name: `Mockup Variant ${variantId}`,
      type: 'phone-mockup-variant',
      components,
      hasMultipleComponents: components.some(c => c.component.includes(' '))
    };
  }

  /**
   * Encuentra assets por patrón
   */
  findAssetsByPattern(pattern) {
    const assets = Array.from(this.assetCache.values());
    const regex = new RegExp(pattern, 'i');
    
    return assets.filter(asset => 
      regex.test(asset.name) || 
      regex.test(asset.fileName) || 
      regex.test(asset.relativePath)
    );
  }

  /**
   * Obtiene un asset por ID
   */
  getAssetById(id) {
    return this.assetCache.get(id);
  }

  /**
   * Valida que un asset existe y es accesible
   */
  async validateAsset(assetPath) {
    try {
      const exists = await fs.pathExists(assetPath);
      if (!exists) {
        return { valid: false, reason: 'File does not exist' };
      }

      const stats = await fs.stat(assetPath);
      if (!stats.isFile()) {
        return { valid: false, reason: 'Path is not a file' };
      }

      // Verificar permisos de lectura
      await fs.access(assetPath, fs.constants.R_OK);
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Optimiza las rutas de assets para el renderizado
   */
  optimizeAssetPaths(assets) {
    return assets.map(asset => {
      // Verificar que el asset tiene absolutePath
      if (!asset || !asset.absolutePath) {
        logger.warn(`Asset sin absolutePath encontrado:`, asset);
        return {
          ...asset,
          optimizedPath: asset.relativePath || asset.fileName || 'unknown',
          renderPath: asset.relativePath || asset.fileName || 'unknown'
        };
      }
      
      // Convertir rutas absolutas a relativas si es posible
      let optimizedPath = asset.absolutePath;
      
      if (optimizedPath.startsWith(process.cwd())) {
        optimizedPath = path.relative(process.cwd(), optimizedPath);
      }
      
      return {
        ...asset,
        optimizedPath,
        renderPath: optimizedPath
      };
    });
  }

  /**
   * Genera un reporte de assets escaneados
   */
  generateAssetReport() {
    const assets = Array.from(this.assetCache.values());
    
    const report = {
      totalAssets: assets.length,
      byType: {},
      totalSize: 0,
      largestAsset: null,
      oldestAsset: null,
      newestAsset: null
    };
    
    for (const asset of assets) {
      // Contar por tipo
      report.byType[asset.type] = (report.byType[asset.type] || 0) + 1;
      
      // Sumar tamaño total
      report.totalSize += asset.size;
      
      // Encontrar el asset más grande
      if (!report.largestAsset || asset.size > report.largestAsset.size) {
        report.largestAsset = asset;
      }
      
      // Encontrar el asset más antiguo
      if (!report.oldestAsset || asset.lastModified < report.oldestAsset.lastModified) {
        report.oldestAsset = asset;
      }
      
      // Encontrar el asset más nuevo
      if (!report.newestAsset || asset.lastModified > report.newestAsset.lastModified) {
        report.newestAsset = asset;
      }
    }
    
    return report;
  }

  /**
   * Limpia la caché de assets
   */
  clearCache() {
    this.assetCache.clear();
    logger.info('Asset cache cleared');
  }
}

module.exports = AEAssetScanner; 