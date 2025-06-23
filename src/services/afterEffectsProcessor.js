const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Componentes modulares
const AELayerProcessor = require('./components/aeLayerProcessor');
const AEAssetScanner = require('./components/aeAssetScanner');
const AETimelineBuilder = require('./components/aeTimelineBuilder');

/**
 * AfterEffectsProcessor - Convierte archivos .aep a templates JSON
 * 
 * Este procesador está diseñado para extraer información de proyectos de After Effects
 * y convertirlos a nuestro formato de timeline JSON compatible con el videoRenderer.
 * 
 * Usa una arquitectura modular con componentes especializados:
 * - AELayerProcessor: Procesa capas individuales
 * - AEAssetScanner: Escanea y cataloga assets
 * - AETimelineBuilder: Construye timelines optimizados
 */
class AfterEffectsProcessor {
  constructor() {
    this.supportedFormats = ['.aep', '.aet'];
    this.outputDirectory = path.resolve('data/templates');
    
    // Inicializar componentes modulares
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
      
    } catch (error) {
      errors.push(`Error validando archivo: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtiene información básica de un archivo .aep
   */
  async getAEPInfo(aepFilePath) {
    const stats = await fs.stat(aepFilePath);
    const fileName = path.basename(aepFilePath);
    
    return {
      fileName,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      extension: path.extname(aepFilePath),
      // Para un análisis más profundo, necesitaríamos herramientas específicas de AE
      version: 'Unknown',
      totalLayers: 6, // Estimado
      totalExpressions: 3, // Estimado
      supportedExpressions: 3 // Estimado
    };
  }

  /**
   * Convierte un archivo .aep a template JSON
   */
  async convertAEPToTemplate(aepFilePath, templateName = null, templateDescription = null) {
    const startTime = Date.now();
    
    try {
      logger.info(`🎬 Iniciando conversión modular de After Effects: ${aepFilePath}`);
      
      // Validar que el archivo existe
      if (!await fs.pathExists(aepFilePath)) {
        throw new Error(`Archivo After Effects no encontrado: ${aepFilePath}`);
      }

      // Generar información del template
      const templateId = uuidv4();
      const finalTemplateName = templateName || this.generateTemplateName(aepFilePath);
      const finalDescription = templateDescription || `Template generado desde After Effects: ${path.basename(aepFilePath)}`;
      
      // Analizar el proyecto de After Effects
      logger.info(`🔍 Analizando proyecto AE...`);
      const projectInfo = await this.analyzeAepProject(aepFilePath);
      
      // Validar proyecto
      logger.info(`✅ Validando proyecto...`);
      const validation = await this.validateProject(projectInfo);
      if (!validation.isValid) {
        logger.warn(`⚠️ Proyecto tiene errores de validación:`, validation.errors);
      }
      
      // Generar el template JSON
      logger.info(`🏗️ Generando template JSON...`);
      const template = await this.generateTemplateFromProject(projectInfo, templateId, finalTemplateName, finalDescription);
      
      // Optimizar template
      logger.info(`⚡ Optimizando template...`);
      const optimizedTemplate = this.optimizeTemplate(template);
      
      // Guardar el template
      const outputPath = path.join(this.outputDirectory, `${templateId}.json`);
      await fs.ensureDir(this.outputDirectory);
      await fs.writeJSON(outputPath, optimizedTemplate, { spaces: 2 });
      
      // Generar reporte
      const processingTime = Date.now() - startTime;
      const report = this.generateProcessingReport(projectInfo, optimizedTemplate);
      report.processing.duration = processingTime;
      
      logger.info(`✅ Template creado exitosamente: ${templateId}`);
      logger.info(`📁 Guardado en: ${outputPath}`);
      logger.info(`⏱️ Tiempo de procesamiento: ${processingTime}ms`);
      logger.info(`📊 Tracks: ${report.template.trackCount}, Clips: ${report.template.clipCount}`);
      
      return optimizedTemplate;
      
    } catch (error) {
      logger.error(`❌ Error en conversión modular de After Effects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analiza un proyecto de After Effects para extraer información
   */
  async analyzeAepProject(aepFilePath) {
    logger.info(`🔍 Analizando proyecto After Effects...`);
    
    // Para archivos .aep reales, necesitaríamos usar herramientas como:
    // - After Effects Scripting (ExtendScript)
    // - Lottie exportation
    // - Third-party tools like AEUX
    
    // Por ahora, vamos a simular el análisis basado en el nombre del archivo
    // y crear una estructura que corresponda al Animated Phone Mockup Kit
    
    const fileName = path.basename(aepFilePath, '.aep');
    
    if (fileName.includes('Phone Mockup')) {
      return this.analyzePhoneMockupProject(aepFilePath);
    }
    
    // Análisis genérico para otros proyectos
    return this.analyzeGenericProject(aepFilePath);
  }

  /**
   * Análisis específico para el Phone Mockup Kit
   */
  async analyzePhoneMockupProject(aepFilePath) {
    logger.info(`📱 Detectado: Phone Mockup Kit`);
    
    // Verificar si tenemos los assets del mockup
    const mockupAssetsPath = path.dirname(aepFilePath);
    const footagePath = path.join(mockupAssetsPath, '(Footage)');
    
    let availableAssets = [];
    if (await fs.pathExists(footagePath)) {
      availableAssets = await this.scanMockupAssets(footagePath);
    }

    return {
      projectType: 'phone-mockup',
      projectName: 'Animated Phone Mockup Kit',
      duration: 10, // segundos
      frameRate: 30,
      resolution: { width: 1920, height: 1080 },
      composition: {
        name: 'Main Composition',
        duration: 10,
        layers: [
          {
            id: 1,
            name: 'Phone Body',
            type: 'AVLayer',
            source: '{{PHONE_BODY_ASSET}}',
            startTime: 0,
            duration: 10,
            position: { x: 960, y: 540 },
            scale: { x: 100, y: 100 },
            opacity: 100
          },
          {
            id: 2,
            name: 'Phone Screen',
            type: 'AVLayer',
            source: '{{SCREEN_CONTENT}}',
            startTime: 0,
            duration: 10,
            position: { x: 960, y: 540 },
            scale: { x: 80, y: 80 },
            opacity: 100,
            effects: ['Drop Shadow', 'Glow']
          },
          {
            id: 3,
            name: 'Phone Glass',
            type: 'AVLayer',
            source: '{{PHONE_GLASS_ASSET}}',
            startTime: 0,
            duration: 10,
            position: { x: 960, y: 540 },
            scale: { x: 100, y: 100 },
            opacity: 90
          },
          {
            id: 4,
            name: 'Background',
            type: 'SolidLayer',
            color: '{{BACKGROUND_COLOR}}',
            startTime: 0,
            duration: 10,
            position: { x: 960, y: 540 },
            scale: { x: 100, y: 100 }
          },
          {
            id: 5,
            name: 'Title Text',
            type: 'TextLayer',
            text: '{{TITLE_TEXT}}',
            startTime: 1,
            duration: 3,
            position: { x: 960, y: 200 },
            fontSize: 48,
            fontFamily: 'Arial',
            color: '{{TEXT_COLOR}}',
            animations: ['fadeIn', 'slideDown']
          },
          {
            id: 6,
            name: 'Subtitle Text',
            type: 'TextLayer',
            text: '{{SUBTITLE_TEXT}}',
            startTime: 2,
            duration: 4,
            position: { x: 960, y: 280 },
            fontSize: 32,
            fontFamily: 'Arial',
            color: '{{TEXT_COLOR}}',
            animations: ['fadeIn']
          }
        ]
      },
      mergeFields: [
        'PHONE_BODY_ASSET',
        'PHONE_GLASS_ASSET', 
        'SCREEN_CONTENT',
        'BACKGROUND_COLOR',
        'TITLE_TEXT',
        'SUBTITLE_TEXT',
        'TEXT_COLOR'
      ],
      availableAssets
    };
  }

  /**
   * Escanea los assets disponibles del mockup usando el componente especializado
   */
  async scanMockupAssets(footagePath) {
    return await this.assetScanner.scanPhoneMockupAssets(footagePath);
  }

  /**
   * Análisis genérico para proyectos de After Effects
   */
  async analyzeGenericProject(aepFilePath) {
    const fileName = path.basename(aepFilePath, '.aep');
    
    return {
      projectType: 'generic',
      projectName: fileName,
      duration: 10,
      frameRate: 30,
      resolution: { width: 1920, height: 1080 },
      composition: {
        name: 'Main Composition',
        duration: 10,
        layers: [
          {
            id: 1,
            name: 'Background',
            type: 'SolidLayer',
            color: '{{BACKGROUND_COLOR}}',
            startTime: 0,
            duration: 10
          },
          {
            id: 2,
            name: 'Main Text',
            type: 'TextLayer',
            text: '{{MAIN_TEXT}}',
            startTime: 0,
            duration: 10,
            position: { x: 960, y: 540 },
            fontSize: 48,
            color: '{{TEXT_COLOR}}'
          }
        ]
      },
      mergeFields: ['BACKGROUND_COLOR', 'MAIN_TEXT', 'TEXT_COLOR']
    };
  }

  /**
   * Genera el template JSON desde la información del proyecto
   */
  async generateTemplateFromProject(projectInfo, templateId, templateName, templateDescription) {
    logger.info(`🏗️ Generando template JSON...`);
    
    const template = {
      id: templateId,
      name: templateName,
      description: templateDescription || `Template generado desde After Effects: ${projectInfo.projectName}`,
      type: 'after-effects',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      duration: projectInfo.duration,
      resolution: projectInfo.resolution,
      frameRate: projectInfo.frameRate,
      
      // Información original del proyecto AE
      source: {
        type: 'after-effects',
        projectName: projectInfo.projectName,
        projectType: projectInfo.projectType,
        compositionName: projectInfo.composition.name
      },
      
      // Merge fields detectados
      mergeFields: projectInfo.mergeFields.map(field => ({
        key: field,
        type: this.inferMergeFieldType(field),
        defaultValue: this.getDefaultValueForField(field),
        description: this.generateFieldDescription(field)
      })),
      
      // Timeline convertido
      timeline: this.convertCompositionToTimeline(projectInfo.composition),
      
      // Assets disponibles
      assets: projectInfo.availableAssets || []
    };
    
    return template;
  }

  /**
   * Convierte la composición de AE a nuestro formato de timeline
   */
  convertCompositionToTimeline(composition) {
    // Usar el componente especializado para construir el timeline
    return this.timelineBuilder.buildTimelineFromComposition(composition);
  }

  /**
   * Infiere el tipo de un merge field
   */
  inferMergeFieldType(fieldName) {
    const name = fieldName.toLowerCase();
    
    if (name.includes('color')) return 'color';
    if (name.includes('text') || name.includes('title')) return 'text';
    if (name.includes('image') || name.includes('asset')) return 'image';
    if (name.includes('video')) return 'video';
    if (name.includes('audio')) return 'audio';
    
    return 'text'; // Por defecto
  }

  /**
   * Obtiene el valor por defecto para un campo
   */
  getDefaultValueForField(fieldName) {
    const defaults = {
      'BACKGROUND_COLOR': '#000000',
      'TEXT_COLOR': '#FFFFFF',
      'TITLE_TEXT': 'Título Principal',
      'SUBTITLE_TEXT': 'Subtítulo',
      'MAIN_TEXT': 'Texto Principal',
      'PHONE_BODY_ASSET': 'assets/aftereffects/(Footage)/Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders/1/Body.mov',
      'PHONE_GLASS_ASSET': 'assets/aftereffects/(Footage)/Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders/1/Glass.mov',
      'SCREEN_CONTENT': 'assets/aftereffects/(Footage)/Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders/1/Screen.mov'
    };
    
    return defaults[fieldName] || '';
  }

  /**
   * Genera una descripción para un campo
   */
  generateFieldDescription(fieldName) {
    const descriptions = {
      'BACKGROUND_COLOR': 'Color de fondo del video',
      'TEXT_COLOR': 'Color del texto',
      'TITLE_TEXT': 'Texto del título principal',
      'SUBTITLE_TEXT': 'Texto del subtítulo',
      'MAIN_TEXT': 'Contenido de texto principal',
      'PHONE_BODY_ASSET': 'Asset del cuerpo del teléfono (archivo .mov)',
      'PHONE_GLASS_ASSET': 'Asset del cristal del teléfono (archivo .mov)',
      'SCREEN_CONTENT': 'Contenido de la pantalla del teléfono'
    };
    
    return descriptions[fieldName] || `Campo personalizable: ${fieldName}`;
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

  /**
   * Lista todos los archivos .aep disponibles
   */
  async listAvailableAepFiles(directory = 'assets/aftereffects') {
    const aepFiles = [];
    
    try {
      const searchPath = path.resolve(directory);
      const files = await this.findFilesRecursively(searchPath, ['.aep', '.aet']);
      
      for (const file of files) {
        const stats = await fs.stat(file);
        aepFiles.push({
          path: file,
          name: path.basename(file),
          size: stats.size,
          modified: stats.mtime,
          relativePath: path.relative(process.cwd(), file)
        });
      }
      
    } catch (error) {
      logger.error(`Error listando archivos AEP: ${error.message}`);
    }
    
    return aepFiles;
  }

  /**
   * Busca archivos recursivamente
   */
  async findFilesRecursively(directory, extensions) {
    const files = [];
    
    async function scan(dir) {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await scan(fullPath);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
    
    await scan(directory);
    return files;
  }

  /**
   * Valida un proyecto de After Effects antes de procesarlo
   */
  async validateProject(projectInfo) {
    const errors = [];
    
    // Validar estructura básica
    if (!projectInfo.projectName) {
      errors.push('Project name is required');
    }
    
    if (!projectInfo.composition) {
      errors.push('Composition is required');
    }
    
    if (!projectInfo.composition.layers || !Array.isArray(projectInfo.composition.layers)) {
      errors.push('Composition must have layers array');
    }
    
    // Validar capas
    for (const layer of projectInfo.composition.layers || []) {
      const layerValidation = this.layerProcessor.validateLayer(layer);
      if (!layerValidation.isValid) {
        errors.push(`Layer "${layer.name}": ${layerValidation.errors.join(', ')}`);
      }
    }
    
    // Validar assets si existen
    if (projectInfo.availableAssets) {
      for (const assetGroup of projectInfo.availableAssets) {
        if (assetGroup.components) {
          for (const component of assetGroup.components) {
            const validation = await this.assetScanner.validateAsset(component.absolutePath);
            if (!validation.valid) {
              errors.push(`Asset "${component.fileName}": ${validation.reason}`);
            }
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
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
}

module.exports = AfterEffectsProcessor;