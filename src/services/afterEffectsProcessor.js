const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Componentes modulares
const AELayerProcessor = require('./components/aeLayerProcessor');
const AEAssetScanner = require('./components/aeAssetScanner');
const AETimelineBuilder = require('./components/aeTimelineBuilder');
const AERealParser = require('./components/aeRealParser');

/**
 * AfterEffectsProcessor - Convierte archivos .aep a templates JSON
 * 
 * ACTUALIZADO: Ahora usa análisis REAL de archivos AEP en lugar de simulación
 * Basado en las mejores prácticas de ae-to-json de Experience-Monks
 * 
 * Usa una arquitectura modular con componentes especializados:
 * - AERealParser: Análisis real de archivos .aep usando ExtendScript
 * - AELayerProcessor: Procesa capas individuales
 * - AEAssetScanner: Escanea y cataloga assets
 * - AETimelineBuilder: Construye timelines optimizados
 */
class AfterEffectsProcessor {
  constructor() {
    this.supportedFormats = ['.aep', '.aet'];
    this.outputDirectory = path.resolve('data/templates');
    
    // Inicializar componentes modulares
    this.realParser = new AERealParser();
    this.layerProcessor = new AELayerProcessor();
    this.assetScanner = new AEAssetScanner();
    this.timelineBuilder = new AETimelineBuilder();
    
    // Mapeo de tipos de capa de After Effects a nuestro formato
    this.layerTypeMapping = {
      'AVLayer': 'video',           // Video/Image layers
      'TextLayer': 'text',          // Text layers
      'ShapeLayer': 'shape',        // Shape layers
      'SolidLayer': 'background',   // Solid color layers
      'CameraLayer': 'camera',      // Camera layers
      'LightLayer': 'light',        // Light layers
      'NullLayer': 'null'           // Null/Control layers
    };

    // Efectos comunes de After Effects y su mapeo
    this.effectMapping = {
      'Scale': 'scale',
      'Position': 'position',
      'Rotation': 'rotation',
      'Opacity': 'opacity',
      'Drop Shadow': 'dropShadow',
      'Glow': 'glow',
      'Color Correction': 'colorCorrection',
      'Blur & Sharpen': 'blur'
    };

    // Patrones de merge fields comunes en After Effects
    this.mergeFieldPatterns = [
      /\{\{([A-Z_]+)\}\}/g,         // {{VARIABLE}}
      /\$\{([A-Z_]+)\}/g,           // ${VARIABLE}
      /\[([A-Z_]+)\]/g,             // [VARIABLE]
      /%([A-Z_]+)%/g                // %VARIABLE%
    ];
  }

  /**
   * Valida un archivo .aep antes de procesarlo
   */
  async validateAEPFile(aepFilePath) {
    const errors = [];
    
    try {
      // Verificar que el archivo existe
      if (!await fs.pathExists(aepFilePath)) {
        errors.push('Archivo no encontrado');
      }
      
      // Verificar extensión
      const ext = path.extname(aepFilePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        errors.push(`Formato no soportado: ${ext}. Formatos válidos: ${this.supportedFormats.join(', ')}`);
      }
      
      // Verificar tamaño del archivo
      const stats = await fs.stat(aepFilePath);
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (stats.size > maxSize) {
        errors.push(`Archivo demasiado grande: ${Math.round(stats.size / 1024 / 1024)}MB. Máximo: 100MB`);
      }
      
      if (stats.size < 1024) {
        errors.push('Archivo parece estar vacío o corrupto');
      }

      // Verificar que es un archivo AEP válido usando el parser real
      const isValid = await this.realParser.isValidAEPFile(aepFilePath);
      if (!isValid) {
        errors.push('El archivo no parece ser un proyecto válido de After Effects');
      }
      
    } catch (error) {
      errors.push(`Error validando archivo: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtiene información básica de un archivo .aep usando análisis real
   */
  async getAEPInfo(aepFilePath) {
    const stats = await fs.stat(aepFilePath);
    const fileName = path.basename(aepFilePath);
    
    try {
      // Usar el parser real para obtener información básica
      const correlationId = logger.generateCorrelationId();
              const realAnalysis = await this.realParser.parseAEP(aepFilePath, correlationId);
      
      return {
        fileName,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(aepFilePath),
        // Información real extraída del archivo
        version: realAnalysis.metadata?.aeVersion || 'Unknown',
        totalLayers: realAnalysis.layers?.length || 0,
        totalExpressions: realAnalysis.expressions?.length || 0,
        supportedExpressions: realAnalysis.expressions?.filter(e => e.enabled).length || 0,
        compositions: realAnalysis.compositions?.length || 0,
        duration: realAnalysis.duration || 0,
        frameRate: realAnalysis.frameRate || 30,
        resolution: {
          width: realAnalysis.width || 1920,
          height: realAnalysis.height || 1080
        },
        method: realAnalysis.method
      };
      
    } catch (error) {
      logger.warn('No se pudo obtener información detallada del AEP, usando información básica', {
        error: error.message,
        file: fileName
      });
      
      // Fallback a información básica
      return {
        fileName,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(aepFilePath),
        version: 'Unknown',
        totalLayers: 0,
        totalExpressions: 0,
        supportedExpressions: 0
      };
    }
  }

  /**
   * Convierte un archivo .aep a template JSON usando análisis real
   */
  async convertAEPToTemplate(aepFilePath, templateName = null, templateDescription = null) {
    const startTime = Date.now();
    const correlationId = logger.generateCorrelationId();
    
    try {
      logger.info(`🎬 Iniciando conversión REAL de After Effects: ${aepFilePath}`, { correlationId });
      
      // Validar que el archivo existe
      if (!await fs.pathExists(aepFilePath)) {
        throw new Error(`Archivo After Effects no encontrado: ${aepFilePath}`);
      }

      // Generar información del template
      const templateId = uuidv4();
      const finalTemplateName = templateName || this.generateTemplateName(aepFilePath);
      const finalDescription = templateDescription || `Template generado desde After Effects: ${path.basename(aepFilePath)}`;
      
      // ANÁLISIS REAL del proyecto de After Effects
      logger.info(`🔍 Ejecutando análisis REAL del proyecto AE...`, { correlationId });
      const realProjectInfo = await this.realParser.parseAEP(aepFilePath, correlationId);
      
      logger.info(`✅ Análisis real completado`, {
        correlationId,
        method: realProjectInfo.method,
        compositions: realProjectInfo.compositions?.length || 0,
        layers: realProjectInfo.layers?.length || 0,
        expressions: realProjectInfo.expressions?.length || 0
      });
      
      // Validar proyecto
      logger.info(`✅ Validando proyecto...`, { correlationId });
      const validation = await this.validateRealProject(realProjectInfo);
      if (!validation.isValid) {
        logger.warn(`⚠️ Proyecto tiene errores de validación:`, { 
          errors: validation.errors,
          correlationId 
        });
      }
      
      // Construir template desde datos reales
      logger.info('🏗️ Construyendo template desde datos reales de AE', { correlationId });
      
      // Seleccionar composición principal
      const mainComposition = this.selectMainComposition(realProjectInfo.compositions);
      if (!mainComposition) {
        throw new Error('No se encontró una composición válida en el proyecto');
      }

      logger.info(`📐 Composición principal seleccionada: ${mainComposition.name}`, {
        correlationId,
        duration: mainComposition.duration,
        layers: mainComposition.layers?.length || 0
      });

      // Obtener capas reales asociadas a esta composición
      const realLayers = realProjectInfo.layers?.filter(layer => 
        layer.composition === mainComposition.name || !layer.composition
      ) || [];

      logger.info(`🎭 Capas reales encontradas: ${realLayers.length}`, { correlationId });

      // Preparar composición con capas reales para el TimelineBuilder
      const compositionWithRealLayers = {
        ...mainComposition,
        realLayers: realLayers // Agregar las capas reales extraídas
      };

      // Construir timeline usando el AETimelineBuilder con datos reales
      const timeline = this.timelineBuilder.buildTimelineFromComposition(compositionWithRealLayers);
      
      // Detectar merge fields desde expresiones y texto reales
      const mergeFields = this.extractRealMergeFields(realProjectInfo);
      
      // Crear template completo
      const template = {
        templateId,
        name: finalTemplateName,
        description: finalDescription,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        
        // Timeline construido desde datos reales
        timeline: {
          ...timeline,
          duration: mainComposition.duration,
          frameRate: mainComposition.frameRate,
          resolution: {
            width: mainComposition.width,
            height: mainComposition.height
          },
          background: {
            color: this.convertAEColorToHex(mainComposition.bgColor)
          }
        },
        
        // Configuración de salida basada en el proyecto real
        defaultOutput: {
          format: 'mp4',
          resolution: {
            width: mainComposition.width,
            height: mainComposition.height
          },
          fps: mainComposition.frameRate,
          quality: 'high'
        },
        
        // Merge fields extraídos de expresiones y texto reales
        mergeFields,
        
        // Metadata del análisis real
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          originalFile: path.basename(realProjectInfo.name || 'unknown.aep'),
          aeVersion: realProjectInfo.metadata?.aeVersion,
          buildNumber: realProjectInfo.metadata?.buildNumber,
          analysisMethod: realProjectInfo.method,
          importedAt: new Date().toISOString(),
          compositions: realProjectInfo.compositions?.length || 0,
          layers: realProjectInfo.layers?.length || 0,
          expressions: realProjectInfo.expressions?.length || 0,
          realAnalysis: true // Marca que este template fue creado con análisis real
        }
      };

      logger.info('✅ Template construido desde análisis real', {
        correlationId,
        tracks: timeline.tracks?.length || 0,
        mergeFields: Object.keys(mergeFields).length,
        expressions: realProjectInfo.expressions?.length || 0
      });

      // Optimizar template
      logger.info(`⚡ Optimizando template...`, { correlationId });
      const optimizedTemplate = this.optimizeTemplate(template);
      
      // Guardar el template
      const outputPath = path.join(this.outputDirectory, `${templateId}.json`);
      await fs.ensureDir(this.outputDirectory);
      await fs.writeJSON(outputPath, optimizedTemplate, { spaces: 2 });
      
      // Generar reporte
      const processingTime = Date.now() - startTime;
      const report = this.generateProcessingReport(realProjectInfo, optimizedTemplate);
      report.processing.duration = processingTime;
      
      logger.info(`✅ Template creado exitosamente desde análisis REAL: ${templateId}`, { correlationId });
      logger.info(`📁 Guardado en: ${outputPath}`, { correlationId });
      logger.info(`⏱️ Tiempo de procesamiento: ${processingTime}ms`, { correlationId });
      logger.info(`📊 Análisis: ${realProjectInfo.method} | Tracks: ${report.template.trackCount} | Clips: ${report.template.clipCount}`, { correlationId });
      
      return {
        ...optimizedTemplate,
        templatePath: outputPath,
        fileSize: (await fs.stat(outputPath)).size,
        projectInfo: {
          ...realProjectInfo,
          stats: report.template
        }
      };
      
    } catch (error) {
      logger.error(`❌ Error en conversión REAL de After Effects: ${error.message}`, { 
        correlationId,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Seleccionar la composición principal del proyecto
   */
  selectMainComposition(compositions) {
    if (!compositions || !Array.isArray(compositions) || compositions.length === 0) {
      return null;
    }

    // Priorizar por duración (la más larga) y número de capas
    return compositions.reduce((best, current) => {
      if (!best) return current;
      
      const currentScore = (current.duration || 0) * (current.layers?.length || 0);
      const bestScore = (best.duration || 0) * (best.layers?.length || 0);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Extraer merge fields reales desde expresiones y contenido de texto
   */
  extractRealMergeFields(realProjectInfo) {
    const mergeFields = {};
    const foundFields = new Set();

    // Extraer desde expresiones reales
    for (const expression of realProjectInfo.expressions || []) {
      if (expression.expression) {
        for (const pattern of this.mergeFieldPatterns) {
          const matches = expression.expression.matchAll(pattern);
          for (const match of matches) {
            foundFields.add(match[1]);
          }
        }
      }
    }

    // Extraer desde contenido de texto de capas
    for (const layer of realProjectInfo.layers || []) {
      if (layer.type === 'text' && layer.text?.sourceText) {
        for (const pattern of this.mergeFieldPatterns) {
          const matches = layer.text.sourceText.matchAll(pattern);
          for (const match of matches) {
            foundFields.add(match[1]);
          }
        }
      }
    }

    // Convertir a formato de merge fields
    for (const fieldName of foundFields) {
      mergeFields[fieldName] = {
        type: this.inferMergeFieldType(fieldName),
        description: `Campo extraído del proyecto AE: ${fieldName}`,
        required: true,
        default: this.getDefaultValueForField(fieldName)
      };
    }

    return mergeFields;
  }

  /**
   * Inferir tipo de merge field basado en el nombre
   */
  inferMergeFieldType(fieldName) {
    const textFields = ['TITLE', 'TEXT', 'NAME', 'SUBTITLE', 'DESCRIPTION'];
    const colorFields = ['COLOR', 'BG_COLOR', 'TEXT_COLOR'];
    const urlFields = ['URL', 'LOGO_URL', 'IMAGE_URL'];
    const numberFields = ['SIZE', 'WIDTH', 'HEIGHT', 'DURATION'];

    const upperField = fieldName.toUpperCase();
    
    if (colorFields.some(cf => upperField.includes(cf))) return 'color';
    if (urlFields.some(uf => upperField.includes(uf))) return 'url';
    if (numberFields.some(nf => upperField.includes(nf))) return 'number';
    
    return 'text'; // Default
  }

  /**
   * Obtener valor por defecto para un campo
   */
  getDefaultValueForField(fieldName) {
    const upperField = fieldName.toUpperCase();
    
    if (upperField.includes('COLOR')) return '#FFFFFF';
    if (upperField.includes('BG_COLOR')) return '#000000';
    if (upperField.includes('TITLE')) return 'Título';
    if (upperField.includes('TEXT')) return 'Texto';
    if (upperField.includes('URL')) return 'https://example.com';
    if (upperField.includes('SIZE')) return 100;
    
    return '';
  }

  /**
   * Convertir color de AE a hex
   */
  convertAEColorToHex(aeColor) {
    if (!aeColor || !Array.isArray(aeColor)) return '#000000';
    
    const r = Math.round((aeColor[0] || 0) * 255);
    const g = Math.round((aeColor[1] || 0) * 255);
    const b = Math.round((aeColor[2] || 0) * 255);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Validar proyecto real analizado
   */
  async validateRealProject(realProjectInfo) {
    const errors = [];
    const warnings = [];
    
    // Validar estructura básica
    if (!realProjectInfo.name) {
      errors.push('Project name is required');
    }
    
    if (!realProjectInfo.compositions || realProjectInfo.compositions.length === 0) {
      errors.push('Project must have at least one composition');
    }
    
    // Validar composiciones
    for (const comp of realProjectInfo.compositions || []) {
      if (!comp.layers || comp.layers.length === 0) {
        warnings.push(`Composition "${comp.name}" has no layers`);
      }
      
      if (comp.duration <= 0) {
        warnings.push(`Composition "${comp.name}" has invalid duration`);
      }
    }
    
    // Validar expresiones
    const invalidExpressions = realProjectInfo.expressions?.filter(e => e.error) || [];
    if (invalidExpressions.length > 0) {
      warnings.push(`${invalidExpressions.length} expressions have errors`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Optimiza un template después de la generación
   */
  optimizeTemplate(template) {
    // Optimizar timeline
    if (template.timeline && template.timeline.tracks) {
      const optimizedTimeline = this.timelineBuilder.optimizeTimeline(template.timeline.tracks);
      template.timeline.tracks = optimizedTimeline;
    }
    
    // Optimizar assets - solo si hay assets con la estructura correcta
    if (template.assets && Array.isArray(template.assets)) {
      // Filtrar y aplanar assets que tienen la estructura correcta
      const flatAssets = [];
      
      for (const assetGroup of template.assets) {
        if (assetGroup.components && Array.isArray(assetGroup.components)) {
          flatAssets.push(...assetGroup.components);
        } else if (assetGroup.absolutePath) {
          flatAssets.push(assetGroup);
        }
      }
      
      if (flatAssets.length > 0) {
        const optimizedAssets = this.assetScanner.optimizeAssetPaths(flatAssets);
        template.optimizedAssets = optimizedAssets;
      }
    }
    
    // Generar estadísticas
    if (template.timeline) {
      template.stats = this.timelineBuilder.generateTimelineStats(template.timeline);
    }
    
    return template;
  }

  /**
   * Genera un reporte completo del procesamiento
   */
  generateProcessingReport(projectInfo, template) {
    const report = {
      timestamp: new Date().toISOString(),
      projectInfo: {
        name: projectInfo.projectName,
        type: projectInfo.projectType,
        duration: projectInfo.duration,
        layerCount: projectInfo.composition?.layers?.length || 0
      },
      template: {
        id: template.id,
        name: template.name,
        trackCount: template.timeline?.tracks?.length || 0,
        clipCount: template.stats?.totalClips || 0,
        mergeFieldCount: template.mergeFields?.length || 0
      },
      assets: this.assetScanner.generateAssetReport(),
      processing: {
        success: true,
        duration: 0, // Se calculará en el método principal
        optimizations: template.timeline?.tracks?.map(track => track.metadata?.optimizations) || []
      }
    };
    
    return report;
  }

  /**
   * Procesa un template de After Effects ya convertido para generar video
   */
  async processTemplate(template, mergeFields, outputPath, progressCallback = null) {
    const startTime = Date.now();
    
    try {
      logger.info(`🎬 Procesando template After Effects: ${template.name}`, {
        templateId: template.id,
        mergeFields: Object.keys(mergeFields).length
      });
      
      if (progressCallback) progressCallback(10);
      
      // Validar que es un template de After Effects
      if (template.type !== 'after-effects') {
        throw new Error(`Template no es de tipo After Effects: ${template.type}`);
      }
      
      // Aplicar merge fields al template
      logger.info(`🔄 Aplicando merge fields...`);
      const processedTemplate = this.applyMergeFieldsToTemplate(template, mergeFields);
      
      if (progressCallback) progressCallback(30);
      
      // Procesar assets si es necesario
      logger.info(`📁 Procesando assets del template...`);
      const assetValidation = await this.validateTemplateAssets(processedTemplate);
      
      if (!assetValidation.allValid && assetValidation.missingAssets.length > 0) {
        logger.warn(`⚠️ Assets faltantes detectados:`, assetValidation.missingAssets);
      }
      
      if (progressCallback) progressCallback(50);
      
      // Usar el SimpleVideoRenderer para renderizar el timeline procesado (mejor para multimedia)
      logger.info(`🎥 Renderizando video con timeline procesado...`);
      const SimpleVideoRenderer = require('./simpleVideoRenderer');
      const simpleVideoRenderer = new SimpleVideoRenderer();
      
      const renderResult = await simpleVideoRenderer.renderVideo(
        processedTemplate.timeline,
        outputPath,
        mergeFields,
        (progress) => {
          // Mapear progreso de renderizado de 50% a 90%
          if (progressCallback) progressCallback(50 + (progress * 0.4));
        }
      );
      
      if (progressCallback) progressCallback(100);
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ Template After Effects procesado exitosamente`, {
        templateId: template.id,
        outputPath,
        processingTime: `${processingTime}ms`
      });
      
      return {
        outputPath: renderResult,
        template: processedTemplate,
        processingTime,
        assetValidation,
        type: 'after-effects'
      };
      
    } catch (error) {
      logger.error(`❌ Error procesando template After Effects: ${error.message}`, {
        templateId: template.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Aplica merge fields a un template
   */
  applyMergeFieldsToTemplate(template, mergeFields) {
    logger.info(`🔄 Aplicando ${Object.keys(mergeFields).length} merge fields...`);
    
    // Crear una copia profunda del template
    const processedTemplate = JSON.parse(JSON.stringify(template));
    
    // Aplicar merge fields a todo el contenido del template
    const templateString = JSON.stringify(processedTemplate);
    let processedString = templateString;
    
    // Aplicar cada merge field
    for (const [key, value] of Object.entries(mergeFields)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const replacedCount = (processedString.match(pattern) || []).length;
      
      if (replacedCount > 0) {
        processedString = processedString.replace(pattern, value);
        logger.info(`🔄 Reemplazado {{${key}}} con "${value}" (${replacedCount} veces)`);
      }
    }
    
    return JSON.parse(processedString);
  }

  /**
   * Valida que los assets del template existan
   */
  async validateTemplateAssets(template) {
    const fs = require('fs-extra');
    const path = require('path');
    
    const assetPaths = [];
    const missingAssets = [];
    const validAssets = [];
    
    // Extraer rutas de assets del timeline
    if (template.timeline && template.timeline.tracks) {
      for (const track of template.timeline.tracks) {
        if (track.clips) {
          for (const clip of track.clips) {
            if (clip.src && typeof clip.src === 'string' && !clip.src.startsWith('{{')) {
              assetPaths.push({
                src: clip.src,
                clipId: clip.id,
                clipName: clip.name
              });
            }
          }
        }
      }
    }
    
    // Validar cada asset
    for (const asset of assetPaths) {
      try {
        const fullPath = path.resolve(asset.src);
        const exists = await fs.pathExists(fullPath);
        
        if (exists) {
          const stats = await fs.stat(fullPath);
          validAssets.push({
            ...asset,
            fullPath,
            size: stats.size,
            exists: true
          });
        } else {
          missingAssets.push({
            ...asset,
            fullPath,
            exists: false,
            error: 'File not found'
          });
        }
      } catch (error) {
        missingAssets.push({
          ...asset,
          exists: false,
          error: error.message
        });
      }
    }
    
    return {
      totalAssets: assetPaths.length,
      validAssets: validAssets.length,
      missingAssets: missingAssets.length,
      allValid: missingAssets.length === 0,
      assets: validAssets,
      missingAssets: missingAssets
    };
  }

  /**
   * Limpia archivos temporales
   */
  async cleanup(filePath) {
    try {
      const fs = require('fs-extra');
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.info(`🧹 Archivo temporal limpiado: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`⚠️ Error limpiando archivo temporal: ${error.message}`);
    }
  }

  /**
   * Genera un nombre de template desde el archivo
   */
  generateTemplateName(aepFilePath) {
    const fileName = path.basename(aepFilePath, '.aep');
    
    // Limpiar y formatear el nombre
    return fileName
      .replace(/CC \([^)]+\)/g, '') // Remover versión CC
      .replace(/[_-]/g, ' ')       // Reemplazar guiones con espacios
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

module.exports = AfterEffectsProcessor;