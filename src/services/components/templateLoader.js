const fs = require('fs-extra');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * TemplateLoader - Responsable de cargar templates desde diferentes fuentes
 * Extraído del TemplateManager para separar responsabilidades
 */
class TemplateLoader {
  constructor() {
    this.templatePaths = {
      local: path.join(__dirname, '../../../data/templates'),
      user: path.join(__dirname, '../../../data/user-templates'),
      cache: path.join(__dirname, '../../../temp/template-cache')
    };
    
    this.supportedFormats = ['.json', '.aep', '.lottie'];
    this.loadedTemplates = new Map(); // Cache en memoria
  }

  /**
   * Cargar template por ID desde diferentes fuentes
   */
  async loadTemplate(templateId, options = {}) {
    const correlationId = logger.generateCorrelationId();
    const timer = logger.timeOperation('Template Loading', correlationId);

    try {
      logger.info('📄 Cargando template', { 
        templateId, 
        correlationId 
      });

      // Verificar cache en memoria primero
      if (this.loadedTemplates.has(templateId) && !options.forceReload) {
        const cached = this.loadedTemplates.get(templateId);
        logger.debug('Template encontrado en cache', { templateId, correlationId });
        timer.end({ success: true, source: 'memory-cache' });
        return cached;
      }

      // Buscar en diferentes ubicaciones
      const template = await this.searchTemplate(templateId, correlationId);
      
      if (!template) {
        throw new Error(`Template no encontrado: ${templateId}`);
      }

      // Procesar y validar template
      const processedTemplate = await this.processTemplate(template, correlationId);

      // Guardar en cache
      this.loadedTemplates.set(templateId, processedTemplate);

      timer.end({ 
        success: true, 
        source: template.source,
        size: JSON.stringify(processedTemplate).length 
      });

      logger.info('✅ Template cargado exitosamente', {
        templateId,
        correlationId,
        source: template.source
      });

      return processedTemplate;

    } catch (error) {
      timer.end({ success: false, error: error.message });
      logger.error('❌ Error cargando template', {
        templateId,
        correlationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Buscar template en diferentes ubicaciones
   */
  async searchTemplate(templateId, correlationId) {
    const searchPaths = [
      { path: this.templatePaths.local, source: 'local' },
      { path: this.templatePaths.user, source: 'user' },
      { path: this.templatePaths.cache, source: 'cache' }
    ];

    for (const location of searchPaths) {
      try {
        const template = await this.loadFromPath(templateId, location.path, location.source);
        if (template) {
          logger.debug('Template encontrado', {
            templateId,
            source: location.source,
            correlationId
          });
          return template;
        }
      } catch (error) {
        logger.debug('Template no encontrado en ubicación', {
          templateId,
          source: location.source,
          error: error.message,
          correlationId
        });
      }
    }

    return null;
  }

  /**
   * Cargar template desde una ruta específica
   */
  async loadFromPath(templateId, basePath, source) {
    await fs.ensureDir(basePath);

    // Probar diferentes formatos
    for (const format of this.supportedFormats) {
      const filePath = path.join(basePath, `${templateId}${format}`);
      
      if (await fs.pathExists(filePath)) {
        const content = await this.loadFileContent(filePath, format);
        return {
          id: templateId,
          source,
          format,
          filePath,
          content,
          loadedAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  /**
   * Cargar contenido del archivo según el formato
   */
  async loadFileContent(filePath, format) {
    switch (format) {
      case '.json':
        return await fs.readJson(filePath);
      
      case '.aep':
        // Para archivos .aep, retornar metadata básica
        const stats = await fs.stat(filePath);
        return {
          type: 'after-effects-project',
          filePath,
          size: stats.size,
          modified: stats.mtime,
          requiresProcessing: true
        };
      
      case '.lottie':
        return await fs.readJson(filePath);
      
      default:
        throw new Error(`Formato no soportado: ${format}`);
    }
  }

  /**
   * Procesar template después de cargarlo
   */
  async processTemplate(template, correlationId) {
    try {
      const processed = {
        id: template.id,
        source: template.source,
        format: template.format,
        loadedAt: template.loadedAt,
        ...template.content
      };

      // Validaciones básicas
      this.validateTemplateStructure(processed);

      // Procesar según el tipo
      switch (template.format) {
        case '.json':
          return this.processJsonTemplate(processed);
        
        case '.aep':
          return this.processAepTemplate(processed, template.filePath);
        
        case '.lottie':
          return this.processLottieTemplate(processed);
        
        default:
          return processed;
      }

    } catch (error) {
      logger.error('Error procesando template', {
        templateId: template.id,
        error: error.message,
        correlationId
      });
      throw error;
    }
  }

  /**
   * Validar estructura básica del template
   */
  validateTemplateStructure(template) {
    if (!template.id) {
      throw new Error('Template debe tener un ID');
    }

    // Para templates que requieren procesamiento (como .aep), no validar estructura
    if (template.requiresProcessing) {
      return true;
    }

    if (!template.name) {
      template.name = template.id;
    }

    if (!template.version) {
      template.version = '1.0.0';
    }

    return true;
  }

  /**
   * Procesar template JSON
   */
  processJsonTemplate(template) {
    // Normalizar estructura
    const normalized = {
      ...template,
      metadata: {
        type: 'json-template',
        processedAt: new Date().toISOString(),
        ...template.metadata
      }
    };

    // Validar tracks si existen
    if (normalized.timeline?.tracks) {
      normalized.timeline.tracks = this.normalizeTemplateTracks(normalized.timeline.tracks);
    }

    return normalized;
  }

  /**
   * Procesar template After Effects
   */
  processAepTemplate(template, filePath) {
    return {
      ...template,
      metadata: {
        type: 'after-effects-template',
        requiresConversion: true,
        originalPath: filePath,
        processedAt: new Date().toISOString(),
        ...template.metadata
      },
      conversion: {
        status: 'pending',
        method: 'binary-analysis', // o 'extendscript' si está disponible
        lastAttempt: null
      }
    };
  }

  /**
   * Procesar template Lottie
   */
  processLottieTemplate(template) {
    return {
      ...template,
      metadata: {
        type: 'lottie-template',
        processedAt: new Date().toISOString(),
        ...template.metadata
      },
      animation: {
        frameRate: template.fr || 30,
        duration: template.op ? template.op / (template.fr || 30) : 5,
        width: template.w || 1920,
        height: template.h || 1080
      }
    };
  }

  /**
   * Normalizar tracks del template
   */
  normalizeTemplateTracks(tracks) {
    return tracks.map((track, index) => ({
      id: track.id || `track-${index}`,
      name: track.name || `Track ${index + 1}`,
      type: track.type || 'video',
      clips: this.normalizeTemplateClips(track.clips || []),
      ...track
    }));
  }

  /**
   * Normalizar clips del template
   */
  normalizeTemplateClips(clips) {
    return clips.map((clip, index) => ({
      id: clip.id || `clip-${index}`,
      type: clip.type || 'unknown',
      start: clip.start || 0,
      duration: clip.duration || 1,
      ...clip
    }));
  }

  /**
   * Cargar múltiples templates
   */
  async loadMultipleTemplates(templateIds, options = {}) {
    const correlationId = logger.generateCorrelationId();
    
    try {
      logger.info('📄 Cargando múltiples templates', {
        templateIds,
        count: templateIds.length,
        correlationId
      });

      const loadPromises = templateIds.map(id => 
        this.loadTemplate(id, { ...options, correlationId })
      );

      const results = await Promise.allSettled(loadPromises);
      
      const successful = [];
      const failed = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            templateId: templateIds[index],
            error: result.reason.message
          });
        }
      });

      logger.info('✅ Carga múltiple completada', {
        correlationId,
        successful: successful.length,
        failed: failed.length
      });

      return { successful, failed };

    } catch (error) {
      logger.error('❌ Error en carga múltiple', {
        templateIds,
        correlationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Listar templates disponibles
   */
  async listAvailableTemplates(source = 'all') {
    const correlationId = logger.generateCorrelationId();
    
    try {
      const templates = [];
      const searchPaths = source === 'all' ? 
        Object.entries(this.templatePaths) : 
        [[source, this.templatePaths[source]]];

      for (const [sourceName, basePath] of searchPaths) {
        if (!basePath || !await fs.pathExists(basePath)) {
          continue;
        }

        const files = await fs.readdir(basePath);
        
        for (const file of files) {
          const ext = path.extname(file);
          if (this.supportedFormats.includes(ext)) {
            const templateId = path.basename(file, ext);
            const filePath = path.join(basePath, file);
            const stats = await fs.stat(filePath);

            templates.push({
              id: templateId,
              source: sourceName,
              format: ext,
              size: stats.size,
              modified: stats.mtime,
              filePath
            });
          }
        }
      }

      logger.info('📋 Templates listados', {
        correlationId,
        count: templates.length,
        sources: [...new Set(templates.map(t => t.source))]
      });

      return templates;

    } catch (error) {
      logger.error('❌ Error listando templates', {
        correlationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Limpiar cache de templates
   */
  clearCache(templateId = null) {
    if (templateId) {
      this.loadedTemplates.delete(templateId);
      logger.debug('Cache limpiado para template específico', { templateId });
    } else {
      this.loadedTemplates.clear();
      logger.debug('Cache completo limpiado');
    }
  }

  /**
   * Obtener estadísticas del cache
   */
  getCacheStats() {
    return {
      size: this.loadedTemplates.size,
      templates: Array.from(this.loadedTemplates.keys()),
      memoryUsage: JSON.stringify([...this.loadedTemplates.values()]).length
    };
  }

  /**
   * Verificar si un template existe sin cargarlo
   */
  async templateExists(templateId) {
    try {
      const template = await this.searchTemplate(templateId, logger.generateCorrelationId());
      return !!template;
    } catch (error) {
      return false;
    }
  }
}

module.exports = TemplateLoader; 