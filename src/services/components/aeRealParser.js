/**
 * Parser real de archivos After Effects - Versión Refactorizada
 * Orquestador principal que coordina componentes especializados
 * 
 * MEJORAS IMPLEMENTADAS:
 * ✅ Eliminación de magic numbers
 * ✅ Configuración centralizada
 * ✅ Manejo de errores robusto
 * ✅ Componentes especializados
 * ✅ Validación unificada
 * ✅ Utilidades centralizadas
 */

const fs = require('fs-extra');
const path = require('path');
const { execFile } = require('child_process');

// Importar configuración y utilidades
const { getConfig, validateConfig } = require('../../config/aeParserConfig');
const { 
  validateAEFile, 
  safeOperation, 
  AE_ERROR_TYPES,
  validateAnalysisResult,
  createErrorSummary
} = require('../../utils/aeErrorHandler');
const logger = require('../../utils/logger');

// Importar componentes especializados
const AEBinaryAnalyzer = require('../parsers/aeBinaryAnalyzer');
const AECompositionValidator = require('../parsers/aeCompositionValidator');

class AERealParser {
  constructor() {
    this.config = getConfig();
    this.validateConfiguration();
    
    // Inicializar componentes especializados
    this.binaryAnalyzer = new AEBinaryAnalyzer();
    this.compositionValidator = new AECompositionValidator();
    
    // Estado interno
    this.supportedMethods = {
      extendScript: false,
      afterEffectsModule: false,
      lottie: false,
      aeux: false,
      enhancedBinaryParsing: true
    };
    
    this.init();
  }

  /**
   * Validar configuración al inicializar
   */
  validateConfiguration() {
    const validation = validateConfig(this.config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Inicializar parser y componentes
   */
  async init() {
    try {
      // Asegurar directorios necesarios
      await fs.ensureDir(this.config.paths.temp);
      await fs.ensureDir(this.config.paths.scripts);
      await fs.ensureDir(this.config.paths.output);
      
      // Detectar métodos disponibles
      await this.detectAvailableMethods();
      
      // Crear scripts ExtendScript si es necesario
      if (this.supportedMethods.extendScript) {
        await this.createExtendScripts();
      }
      
      logger.info('AERealParser refactorizado inicializado', {
        supportedMethods: this.supportedMethods,
        config: {
          tempDir: this.config.paths.temp,
          scriptsDir: this.config.paths.scripts
        }
      });
      
    } catch (error) {
      logger.error('Error inicializando AERealParser', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Detectar métodos de análisis disponibles
   */
  async detectAvailableMethods() {
    const methods = this.config.methods;
    
    // Detectar After Effects instalado para ExtendScript
    if (methods.extendScript.enabled) {
      this.supportedMethods.extendScript = await this.detectAfterEffects();
    }
    
    // Detectar módulo after-effects de Node.js
    if (methods.afterEffectsModule.enabled) {
      this.supportedMethods.afterEffectsModule = await this.detectAfterEffectsModule();
    }
    
    // El análisis binario mejorado está siempre disponible
    this.supportedMethods.enhancedBinaryParsing = methods.enhancedBinaryParsing.enabled;
    
    logger.info('Métodos de análisis detectados', {
      supportedMethods: this.supportedMethods
    });
  }

  /**
   * Detectar instalación de After Effects
   */
  async detectAfterEffects() {
    try {
      if (process.platform === 'darwin') {
        const aeApps = await fs.readdir('/Applications').then(files => 
          files.filter(f => f.includes('After Effects'))
        );
        return aeApps.length > 0;
      } else if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        try {
          execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\After Effects"', { stdio: 'ignore' });
          return true;
        } catch (e) {
          return false;
        }
      }
      return false;
    } catch (error) {
      logger.debug('Error detectando After Effects', { error: error.message });
      return false;
    }
  }

  /**
   * Detectar módulo after-effects de Node.js
   */
  async detectAfterEffectsModule() {
    try {
      require.resolve('after-effects');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Crear scripts ExtendScript optimizados
   */
  async createExtendScripts() {
    const scriptContent = this.generateExtendScript();
    const scriptPath = path.join(this.config.paths.scripts, 'complete-analyze.jsx');
    
    await fs.writeFile(scriptPath, scriptContent);
    
    logger.info('Scripts ExtendScript creados', {
      scriptPath
    });
  }

  /**
   * Generar script ExtendScript optimizado
   */
  generateExtendScript() {
    return `
// Script ExtendScript optimizado para análisis completo
function analyzeProjectComplete() {
    var result = {
        projectInfo: {},
        compositions: [],
        assets: [],
        layers: [],
        metadata: {}
    };
    
    try {
        if (!app.project) {
            throw new Error("No hay proyecto abierto");
        }
        
        result.projectInfo = {
            name: app.project.file ? app.project.file.name : "Untitled",
            totalItems: app.project.items.length,
            version: app.version
        };
        
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            
            if (item instanceof CompItem) {
                result.compositions.push(analyzeComposition(item));
                
                for (var j = 1; j <= item.layers.length; j++) {
                    result.layers.push(analyzeLayer(item.layers[j], item.name));
                }
            } else if (item instanceof FootageItem) {
                result.assets.push(analyzeAsset(item));
            }
        }
        
        result.metadata = {
            analysisTime: new Date().toISOString(),
            method: "extendscript_complete",
            success: true
        };
        
    } catch (error) {
        result.error = error.toString();
        result.metadata = { success: false };
    }
    
    return JSON.stringify(result, null, 2);
}

function analyzeComposition(comp) {
    return {
        id: comp.id,
        name: comp.name,
        width: comp.width,
        height: comp.height,
        duration: comp.duration,
        frameRate: comp.frameRate,
        bgColor: [comp.bgColor[0], comp.bgColor[1], comp.bgColor[2]],
        layerCount: comp.layers.length
    };
}

function analyzeLayer(layer, compName) {
    return {
        id: layer.index,
        name: layer.name,
        composition: compName,
        type: getLayerType(layer),
        enabled: layer.enabled,
        startTime: layer.startTime,
        duration: layer.outPoint - layer.inPoint,
        transform: {
            position: getPropertyValue(layer.position),
            scale: getPropertyValue(layer.scale),
            rotation: getPropertyValue(layer.rotation),
            opacity: getPropertyValue(layer.opacity)
        }
    };
}

function analyzeAsset(footage) {
    return {
        id: footage.id,
        name: footage.name,
        type: getSourceType(footage),
        width: footage.width || null,
        height: footage.height || null,
        duration: footage.duration || null,
        hasAudio: footage.hasAudio || false
    };
}

function getPropertyValue(property) {
    try { return property.value; } catch (e) { return null; }
}

function getLayerType(layer) {
    if (layer instanceof TextLayer) return "text";
    if (layer instanceof ShapeLayer) return "shape";
    if (layer instanceof AVLayer) return "av";
    return "unknown";
}

function getSourceType(source) {
    if (source instanceof CompItem) return "composition";
    if (source instanceof FootageItem) {
        if (source.hasVideo && source.hasAudio) return "video";
        if (source.hasVideo) return "image";
        if (source.hasAudio) return "audio";
    }
    return "unknown";
}

analyzeProjectComplete();
`;
  }

  /**
   * Método principal de análisis
   */
  async parseAEP(aepFilePath, correlationId = null) {
    const id = correlationId || logger.generateCorrelationId();
    
    logger.info('Iniciando análisis refactorizado de AEP', {
      correlationId: id,
      file: path.basename(aepFilePath),
      methods: this.supportedMethods
    });

    // Validar archivo
    const stats = await fs.stat(aepFilePath).catch(() => null);
    const fileValidation = validateAEFile(aepFilePath, stats);
    
    if (!fileValidation.isValid) {
      const errorSummary = createErrorSummary(fileValidation.errors);
      logger.error('Validación de archivo falló', {
        correlationId: id,
        errors: errorSummary
      });
      throw new Error(`Invalid AE file: ${fileValidation.errors.map(e => e.message).join(', ')}`);
    }

    // Intentar análisis con el mejor método disponible
    return await this.performAnalysis(aepFilePath, id);
  }

  /**
   * Realizar análisis usando el mejor método disponible
   */
  async performAnalysis(aepFilePath, correlationId) {
    const errors = [];
    
    // Método 1: ExtendScript (más preciso)
    if (this.supportedMethods.extendScript) {
      const result = await safeOperation(
        () => this.analyzeWithExtendScript(aepFilePath, correlationId),
        AE_ERROR_TYPES.PARSING_FAILED,
        { method: 'extendScript', file: aepFilePath }
      );
      
      if (result.success) {
        return await this.postProcessResult(result.data, correlationId);
      }
      errors.push(result.error);
    }

    // Método 2: Módulo after-effects
    if (this.supportedMethods.afterEffectsModule) {
      const result = await safeOperation(
        () => this.analyzeWithAfterEffectsModule(aepFilePath, correlationId),
        AE_ERROR_TYPES.PARSING_FAILED,
        { method: 'afterEffectsModule', file: aepFilePath }
      );
      
      if (result.success) {
        return await this.postProcessResult(result.data, correlationId);
      }
      errors.push(result.error);
    }

    // Método 3: Análisis binario mejorado (fallback)
    if (this.supportedMethods.enhancedBinaryParsing) {
      const result = await this.binaryAnalyzer.analyzeBinary(aepFilePath, correlationId);
      
      if (result.success) {
        return await this.postProcessResult(result.data, correlationId);
      }
      errors.push(result.error);
    }

    // Si todos los métodos fallan
    const errorSummary = createErrorSummary(errors);
    logger.error('Todos los métodos de análisis fallaron', {
      correlationId,
      errorSummary
    });
    
    throw new Error(`Analysis failed with all methods: ${errors.map(e => e.message).join(', ')}`);
  }

  /**
   * Análisis con ExtendScript
   */
  async analyzeWithExtendScript(aepFilePath, correlationId) {
    const timeout = this.config.methods.extendScript.timeout;
    const scriptPath = path.join(this.config.paths.scripts, 'complete-analyze.jsx');
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('ExtendScript analysis timeout'));
      }, timeout);

      // Ejecutar script ExtendScript
      const command = process.platform === 'darwin' 
        ? '/Applications/Adobe After Effects 2023/Adobe After Effects 2023.app/Contents/MacOS/Adobe After Effects 2023'
        : 'AfterFX.exe';
      
      execFile(command, ['-s', scriptPath, aepFilePath], (error, stdout, stderr) => {
        clearTimeout(timer);
        
        if (error) {
          reject(error);
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse ExtendScript result: ${parseError.message}`));
        }
      });
    });
  }

  /**
   * Análisis con módulo after-effects
   */
  async analyzeWithAfterEffectsModule(aepFilePath, correlationId) {
    const afterEffects = require('after-effects');
    const timeout = this.config.methods.afterEffectsModule.timeout;
    
    return Promise.race([
      afterEffects.open(aepFilePath).then(project => {
        return afterEffects.analyze(project);
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('After Effects module timeout')), timeout);
      })
    ]);
  }

  /**
   * Post-procesar resultado de análisis
   */
  async postProcessResult(rawResult, correlationId) {
    // Validar resultado
    const validation = validateAnalysisResult(rawResult);
    if (!validation.isValid) {
      logger.warn('Resultado de análisis inválido', {
        correlationId,
        errors: validation.errors.map(e => e.message)
      });
    }

    // Validar y normalizar composiciones
    const validatedCompositions = this.compositionValidator.validateCompositions(
      rawResult.compositions || [],
      correlationId
    );

    // Construir resultado final
    const result = {
      ...rawResult,
      compositions: validatedCompositions,
      metadata: {
        ...rawResult.metadata,
        analysisTime: new Date().toISOString(),
        correlationId,
        realAnalysis: true,
        totalCompositions: validatedCompositions.length,
        totalLayers: rawResult.layers?.length || 0,
        totalAssets: rawResult.assets?.length || 0
      }
    };

    logger.info('Análisis post-procesado completado', {
      correlationId,
      method: result.metadata.method,
      compositions: result.metadata.totalCompositions,
      layers: result.metadata.totalLayers,
      assets: result.metadata.totalAssets
    });

    return result;
  }

  /**
   * Obtener estadísticas del parser
   */
  getStats() {
    return {
      supportedMethods: this.supportedMethods,
      config: {
        tempDir: this.config.paths.temp,
        scriptsDir: this.config.paths.scripts,
        limits: this.config.limits
      }
    };
  }

  /**
   * Limpiar recursos temporales
   */
  async cleanup() {
    try {
      await fs.remove(this.config.paths.temp);
      logger.info('Recursos temporales limpiados');
    } catch (error) {
      logger.warn('Error limpiando recursos temporales', {
        error: error.message
      });
    }
  }
}

module.exports = AERealParser; 