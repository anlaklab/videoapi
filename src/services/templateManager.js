const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { templateSchema } = require('../validation/schemas');
const { bullMQConnection } = require('../config/redis');

class TemplateManager {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'data', 'templates');
    this.templates = new Map();
    this.redisConnection = bullMQConnection.connection;
    this.initialize();
  }

  async initialize() {
    try {
      await fs.ensureDir(this.templatesDir);
      await this.loadTemplates();
      logger.info(`TemplateManager initialized with ${this.templates.size} templates`);
    } catch (error) {
      logger.error('Error initializing TemplateManager:', error);
    }
  }

  async loadTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(file => file.endsWith('.json'));

      for (const file of templateFiles) {
        try {
          const filePath = path.join(this.templatesDir, file);
          const templateData = await fs.readJson(filePath);
          const templateId = path.basename(file, '.json');
          
          this.templates.set(templateId, {
            ...templateData,
            id: templateId,
            filePath,
            loadedAt: new Date().toISOString()
          });

          logger.debug(`Template loaded: ${templateId}`);
        } catch (error) {
          logger.error(`Error loading template ${file}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error loading templates:', error);
    }
  }

  async createTemplate(templateData) {
    try {
      const templateId = templateData.id || uuidv4();
      const template = {
        id: templateId,
        name: templateData.name || 'Unnamed Template',
        description: templateData.description || '',
        timeline: templateData.timeline,
        defaultOutput: templateData.defaultOutput || {},
        mergeFields: templateData.mergeFields || {},
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          ...templateData.metadata
        }
      };

      // Validar template
      const validation = await this.validateTemplate(template);
      if (!validation.valid) {
        throw new Error(`Template inválido: ${validation.errors.join(', ')}`);
      }

      // Guardar en archivo
      const filePath = path.join(this.templatesDir, `${templateId}.json`);
      await fs.writeJson(filePath, template, { spaces: 2 });

      // Agregar a memoria
      this.templates.set(templateId, {
        ...template,
        filePath
      });

      // Notificar a workers via Redis
      await this.notifyTemplateChange('created', templateId);

      logger.info(`Template created: ${templateId}`, {
        templateName: template.name,
        clientId: template.metadata?.clientId
      });

      return template;

    } catch (error) {
      logger.error('Error creating template:', error);
      throw error;
    }
  }

  async updateTemplate(templateId, updates) {
    try {
      const existingTemplate = this.templates.get(templateId);
      if (!existingTemplate) {
        throw new Error(`Template no encontrado: ${templateId}`);
      }

      const updatedTemplate = {
        ...existingTemplate,
        ...updates,
        id: templateId, // Mantener ID original
        metadata: {
          ...existingTemplate.metadata,
          ...updates.metadata,
          updatedAt: new Date().toISOString()
        }
      };

      // Validar template actualizado
      const validation = await this.validateTemplate(updatedTemplate);
      if (!validation.valid) {
        throw new Error(`Template inválido: ${validation.errors.join(', ')}`);
      }

      // Guardar en archivo
      await fs.writeJson(existingTemplate.filePath, updatedTemplate, { spaces: 2 });

      // Actualizar en memoria
      this.templates.set(templateId, {
        ...updatedTemplate,
        filePath: existingTemplate.filePath
      });

      // Notificar a workers via Redis
      await this.notifyTemplateChange('updated', templateId);

      logger.info(`Template updated: ${templateId}`, {
        templateName: updatedTemplate.name,
        clientId: updatedTemplate.metadata?.clientId
      });

      return updatedTemplate;

    } catch (error) {
      logger.error(`Error updating template ${templateId}:`, error);
      throw error;
    }
  }

  async deleteTemplate(templateId) {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template no encontrado: ${templateId}`);
      }

      // Eliminar archivo
      await fs.remove(template.filePath);

      // Eliminar de memoria
      this.templates.delete(templateId);

      // Notificar a workers via Redis
      await this.notifyTemplateChange('deleted', templateId);

      logger.info(`Template deleted: ${templateId}`);
      return true;

    } catch (error) {
      logger.error(`Error deleting template ${templateId}:`, error);
      throw error;
    }
  }

  getTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }

    // Retornar copia sin datos internos
    const { filePath, ...publicTemplate } = template;
    return publicTemplate;
  }

  listTemplates(options = {}) {
    const { limit = 100, offset = 0, search } = options;
    
    let templates = Array.from(this.templates.values());

    // Filtrar por búsqueda si se proporciona
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower)
      );
    }

    // Aplicar paginación
    const total = templates.length;
    const paginatedTemplates = templates
      .slice(offset, offset + limit)
      .map(({ filePath, ...template }) => template);

    return {
      templates: paginatedTemplates,
      total,
      limit,
      offset
    };
  }

  async validateTemplate(template) {
    const errors = [];
    const warnings = [];

    try {
      // Validar campos requeridos
      if (!template.name) {
        errors.push('name es requerido');
      }

      if (!template.timeline) {
        errors.push('timeline es requerido');
      } else {
        // Validar timeline básico
        if (!template.timeline.tracks || !Array.isArray(template.timeline.tracks)) {
          errors.push('timeline.tracks debe ser un array');
        }

        if (template.timeline.tracks?.length === 0) {
          errors.push('timeline debe contener al menos un track');
        }
      }

      // Validar merge fields
      if (template.mergeFields && typeof template.mergeFields !== 'object') {
        errors.push('mergeFields debe ser un objeto');
      }

      // Detectar placeholders en timeline
      const detectedFields = this.detectMergeFields(template.timeline);
      const declaredFields = Object.keys(template.mergeFields || {});
      
      // Advertir sobre placeholders no declarados
      detectedFields.forEach(field => {
        if (!declaredFields.includes(field)) {
          warnings.push(`Placeholder {${field}} usado pero no declarado en mergeFields`);
        }
      });

      // Advertir sobre campos declarados pero no usados
      declaredFields.forEach(field => {
        if (!detectedFields.includes(field)) {
          warnings.push(`Campo ${field} declarado pero no usado en timeline`);
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        detectedFields,
        declaredFields
      };

    } catch (error) {
      logger.error('Error validating template:', error);
      return {
        valid: false,
        errors: ['Error interno en validación'],
        warnings: []
      };
    }
  }

  detectMergeFields(obj) {
    const fields = new Set();
    const placeholderRegex = /\{([A-Z_][A-Z0-9_]*)\}/g;

    const traverse = (value) => {
      if (typeof value === 'string') {
        let match;
        while ((match = placeholderRegex.exec(value)) !== null) {
          fields.add(match[1]);
        }
      } else if (Array.isArray(value)) {
        value.forEach(traverse);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(traverse);
      }
    };

    traverse(obj);
    return Array.from(fields);
  }

  async validateMergeFields(template, mergeFields) {
    try {
      const requiredFields = template.mergeFields || {};
      const errors = [];
      const warnings = [];

      Object.entries(requiredFields).forEach(([field, config]) => {
        if (config.required && !(field in mergeFields)) {
          errors.push(`Campo requerido faltante: ${field}`);
        }

        if (field in mergeFields) {
          const value = mergeFields[field];
          
          // Validar tipo si está especificado
          if (config.type) {
            const actualType = typeof value;
            // Map template types to JavaScript types
            const typeMapping = {
              'text': 'string',
              'string': 'string',
              'number': 'number',
              'boolean': 'boolean',
              'image': 'string',
              'video': 'string',
              'audio': 'string'
            };
            
            const expectedJSType = typeMapping[config.type] || config.type;
            if (expectedJSType !== actualType) {
              errors.push(`Campo ${field}: esperado ${config.type}, recibido ${actualType}`);
            }
          }

          // Validar longitud para strings
          if (config.maxLength && typeof value === 'string' && value.length > config.maxLength) {
            errors.push(`Campo ${field}: excede longitud máxima de ${config.maxLength}`);
          }

          // Validar valores permitidos
          if (config.allowedValues && !config.allowedValues.includes(value)) {
            errors.push(`Campo ${field}: valor no permitido. Valores válidos: ${config.allowedValues.join(', ')}`);
          }
        }
      });

      // Advertir sobre campos no declarados
      Object.keys(mergeFields).forEach(field => {
        if (!(field in requiredFields)) {
          warnings.push(`Campo no declarado: ${field}`);
        }
      });

      if (errors.length > 0) {
        throw new Error(`Validación de merge fields falló: ${errors.join(', ')}`);
      }

      if (warnings.length > 0) {
        logger.warn('Template merge fields warnings:', warnings);
      }

      return {
        valid: true,
        errors: [],
        warnings
      };

    } catch (error) {
      logger.error('Error validating merge fields:', error);
      throw error;
    }
  }

  async renderTemplate(templateId, mergeFields, output) {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template no encontrado: ${templateId}`);
      }

      // Validar merge fields
      await this.validateMergeFields(template, mergeFields);

      // Crear timeline renderizado con placeholders aplicados
      const renderedTimeline = this.applyMergeFields(template.timeline, mergeFields);

      // Combinar output con defaults del template
      const finalOutput = {
        ...template.defaultOutput,
        ...output
      };

      // Aplicar transformaciones adicionales del template
      const processedTimeline = await this.processTemplateFeatures(renderedTimeline, template, mergeFields);

      return {
        timeline: processedTimeline,
        output: finalOutput,
        templateId,
        templateName: template.name,
        renderedAt: new Date().toISOString(),
        mergeFields: mergeFields
      };

    } catch (error) {
      logger.error(`Error rendering template ${templateId}:`, error);
      throw error;
    }
  }

  // Removed duplicate applyMergeFields method - using the comprehensive one below

  async getTemplateStats() {
    try {
      const stats = {
        total: this.templates.size,
        byCategory: {},
        recentlyUsed: [],
        mostUsed: []
      };

      // Categorizar templates (si tienen categoría en metadata)
      this.templates.forEach(template => {
        const category = template.metadata?.category || 'uncategorized';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });

      return stats;

    } catch (error) {
      logger.error('Error getting template stats:', error);
      return {
        total: 0,
        byCategory: {},
        recentlyUsed: [],
        mostUsed: []
      };
    }
  }

  async exportTemplate(templateId) {
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template no encontrado: ${templateId}`);
      }

      return {
        ...template,
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0.0'
      };

    } catch (error) {
      logger.error(`Error exporting template ${templateId}:`, error);
      throw error;
    }
  }

  async importTemplate(templateData) {
    try {
      // Validar estructura de import
      if (!templateData.timeline) {
        throw new Error('Template importado debe contener timeline');
      }

      // Generar nuevo ID si no existe
      if (!templateData.id) {
        templateData.id = uuidv4();
      }

      // Marcar como importado
      templateData.metadata = {
        ...templateData.metadata,
        imported: true,
        importedAt: new Date().toISOString()
      };

      return await this.createTemplate(templateData);

    } catch (error) {
      logger.error('Error importing template:', error);
      throw error;
    }
  }

  /**
   * Aplica merge fields al timeline
   */
  applyMergeFields(timeline, mergeFields) {
    try {
      logger.info('TemplateManager: Starting merge field processing', { mergeFields });
      
      // Create a deep copy using a more reliable method
      const processObject = (obj) => {
        if (typeof obj === 'string') {
          let result = obj;
          
          // Process each merge field
          Object.entries(mergeFields || {}).forEach(([key, value]) => {
            // Multiple replacement patterns for maximum compatibility
            const patterns = [
              `{{${key}}}`,     // {{KEY}}
              `\${${key}}`,     // ${KEY}
              `[${key}]`,       // [KEY]
              `%${key}%`        // %KEY%
            ];
            
            patterns.forEach(pattern => {
              const beforeReplace = result;
              // Use simple string replacement instead of regex for reliability
              result = result.split(pattern).join(String(value));
              if (beforeReplace !== result) {
                logger.info(`TemplateManager: Replaced ${pattern} with ${value}`);
              }
            });
          });
          
          return result;
        } else if (Array.isArray(obj)) {
          return obj.map(processObject);
        } else if (obj && typeof obj === 'object') {
          const result = {};
          Object.entries(obj).forEach(([key, val]) => {
            result[key] = processObject(val);
          });
          return result;
        }
        return obj;
      };

      const result = processObject(timeline);
      logger.info('TemplateManager: Merge field processing completed');
      return result;

    } catch (error) {
      logger.error('TemplateManager: Error applying merge fields:', error);
      throw error;
    }
  }

  /**
   * Procesa características adicionales del template
   */
  async processTemplateFeatures(timeline, template, mergeFields) {
    try {
      let processedTimeline = { ...timeline };

      // Aplicar animaciones automáticas
      if (template.metadata?.autoAnimations) {
        processedTimeline = await this.applyAutoAnimations(processedTimeline);
      }

      // Aplicar responsive design
      if (template.metadata?.responsive) {
        processedTimeline = await this.applyResponsiveLayout(processedTimeline, mergeFields);
      }

      // Aplicar timing automático
      if (template.metadata?.autoTiming) {
        processedTimeline = await this.applyAutoTiming(processedTimeline);
      }

      return processedTimeline;

    } catch (error) {
      logger.error('Error processing template features:', error);
      return timeline; // Retornar timeline original en caso de error
    }
  }

  /**
   * Aplica animaciones automáticas
   */
  async applyAutoAnimations(timeline) {
    try {
      timeline.tracks?.forEach(track => {
        track.clips?.forEach((clip, index) => {
          if (clip.type === 'text' && !clip.animations) {
            // Agregar animación de entrada automática
            clip.animations = [{
              type: 'fade',
              property: 'opacity',
              start: clip.start,
              duration: 0.5,
              from: 0,
              to: 100
            }];

            // Agregar stagger delay para múltiples clips
            if (index > 0) {
              clip.start += index * 0.2;
            }
          }
        });
      });

      return timeline;
    } catch (error) {
      logger.error('Error applying auto animations:', error);
      return timeline;
    }
  }

  /**
   * Aplica layout responsive
   */
  async applyResponsiveLayout(timeline, mergeFields) {
    try {
      const textLengths = {};
      
      // Calcular longitudes de texto
      Object.entries(mergeFields || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          textLengths[key] = value.length;
        }
      });

      timeline.tracks?.forEach(track => {
        track.clips?.forEach(clip => {
          if (clip.type === 'text' && clip.text) {
            // Ajustar tamaño de fuente basado en longitud del texto
            const textLength = clip.text.length;
            if (textLength > 50) {
              clip.style = clip.style || {};
              clip.style.fontSize = Math.max(24, (clip.style.fontSize || 48) * 0.8);
            } else if (textLength < 10) {
              clip.style = clip.style || {};
              clip.style.fontSize = Math.min(72, (clip.style.fontSize || 48) * 1.2);
            }

            // Ajustar posición si el texto es muy largo
            if (textLength > 100) {
              clip.position = clip.position || {};
              clip.position.y = Math.max(100, clip.position.y - 50);
            }
          }
        });
      });

      return timeline;
    } catch (error) {
      logger.error('Error applying responsive layout:', error);
      return timeline;
    }
  }

  /**
   * Aplica timing automático
   */
  async applyAutoTiming(timeline) {
    try {
      let currentTime = 0;
      const defaultClipDuration = 3;
      const transitionDuration = 0.5;

      timeline.tracks?.forEach(track => {
        track.clips?.forEach((clip, index) => {
          if (clip.type === 'text') {
            // Calcular duración basada en longitud del texto
            const textLength = (clip.text || '').length;
            const readingTime = Math.max(2, textLength / 10); // ~10 caracteres por segundo
            
            clip.start = currentTime;
            clip.duration = Math.min(readingTime, 8); // Máximo 8 segundos
            
            currentTime += clip.duration - transitionDuration;
          } else {
            clip.start = clip.start || currentTime;
            clip.duration = clip.duration || defaultClipDuration;
            currentTime = Math.max(currentTime, clip.start + clip.duration);
          }
        });
      });

      return timeline;
    } catch (error) {
      logger.error('Error applying auto timing:', error);
      return timeline;
    }
  }

  /**
   * Crea templates predefinidos
   */
  async createPredefinedTemplates() {
    const predefinedTemplates = [
      {
        name: 'Lower Third Simple',
        description: 'Lower third básico para presentaciones',
        category: 'lower-thirds',
        tags: ['presentation', 'corporate', 'simple'],
        timeline: {
          tracks: [{
            clips: [{
              type: 'text',
              text: '{{NAME}}',
              start: 0,
              duration: 5,
              position: { x: 100, y: 900 },
              style: {
                fontSize: 36,
                color: '#FFFFFF',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 20
              }
            }, {
              type: 'text',
              text: '{{TITLE}}',
              start: 0.2,
              duration: 5,
              position: { x: 100, y: 950 },
              style: {
                fontSize: 24,
                color: '#FFD700',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: 15
              }
            }]
          }],
          background: { color: 'transparent' }
        },
        mergeFields: {
          NAME: {
            type: 'text',
            description: 'Nombre de la persona',
            required: true,
            maxLength: 50
          },
          TITLE: {
            type: 'text',
            description: 'Título o cargo',
            required: true,
            maxLength: 80
          }
        }
      },
      {
        name: 'Intro Corporativo',
        description: 'Intro animado para videos corporativos',
        category: 'intros',
        tags: ['corporate', 'professional', 'animated'],
        timeline: {
          tracks: [{
            clips: [{
              type: 'text',
              text: '{{COMPANY_NAME}}',
              start: 0,
              duration: 3,
              position: { x: 960, y: 400 },
              style: {
                fontSize: 72,
                color: '#FFFFFF',
                textAlign: 'center'
              },
              animations: [{
                type: 'slide',
                direction: 'up',
                duration: 1,
                easing: 'ease-out'
              }]
            }, {
              type: 'text',
              text: '{{TAGLINE}}',
              start: 1.5,
              duration: 3,
              position: { x: 960, y: 500 },
              style: {
                fontSize: 32,
                color: '#FFD700',
                textAlign: 'center'
              },
              animations: [{
                type: 'fade',
                duration: 0.8,
                easing: 'ease-in'
              }]
            }]
          }],
          background: { color: '#1a1a2e' }
        },
        mergeFields: {
          COMPANY_NAME: {
            type: 'text',
            description: 'Nombre de la empresa',
            required: true,
            maxLength: 30
          },
          TAGLINE: {
            type: 'text',
            description: 'Eslogan o tagline',
            required: false,
            maxLength: 60
          }
        }
      },
      {
        name: 'Outro con Call-to-Action',
        description: 'Outro con llamada a la acción',
        category: 'outros',
        tags: ['cta', 'marketing', 'social'],
        timeline: {
          tracks: [{
            clips: [{
              type: 'text',
              text: '¡Gracias por ver!',
              start: 0,
              duration: 2,
              position: { x: 960, y: 300 },
              style: {
                fontSize: 48,
                color: '#FFFFFF',
                textAlign: 'center'
              }
            }, {
              type: 'text',
              text: '{{CTA_TEXT}}',
              start: 1,
              duration: 4,
              position: { x: 960, y: 600 },
              style: {
                fontSize: 36,
                color: '#FF6B6B',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: 20,
                borderRadius: 10
              }
            }, {
              type: 'text',
              text: '{{WEBSITE}}',
              start: 2,
              duration: 3,
              position: { x: 960, y: 700 },
              style: {
                fontSize: 24,
                color: '#4ECDC4',
                textAlign: 'center'
              }
            }]
          }],
          background: { color: '#2c3e50' }
        },
        mergeFields: {
          CTA_TEXT: {
            type: 'text',
            description: 'Texto de llamada a la acción',
            required: true,
            default: 'Suscríbete y dale like',
            maxLength: 50
          },
          WEBSITE: {
            type: 'text',
            description: 'Sitio web o canal',
            required: false,
            maxLength: 40
          }
        }
      }
    ];

    const createdTemplates = [];
    
    for (const templateData of predefinedTemplates) {
      try {
        // Verificar si el template ya existe
        const existing = Array.from(this.templates.values())
          .find(t => t.name === templateData.name);
        
        if (!existing) {
          const template = await this.createTemplate(templateData);
          createdTemplates.push(template);
          logger.info(`Created predefined template: ${template.name}`);
        }
      } catch (error) {
        logger.error(`Error creating predefined template ${templateData.name}:`, error);
      }
    }

    return createdTemplates;
  }

  /**
   * Recarga todos los templates desde disco
   */
  async reloadTemplates() {
    try {
      logger.info('Reloading all templates from disk...');
      
      // Clear current templates
      this.templates.clear();
      
      // Reload from disk
      await this.loadTemplates();
      
      logger.info(`Reloaded ${this.templates.size} templates`);
      return true;

    } catch (error) {
      logger.error('Error reloading templates:', error);
      return false;
    }
  }

  /**
   * Verifica si un template existe y lo recarga si es necesario
   */
  async ensureTemplateExists(templateId) {
    try {
      // Check if template is already in memory
      if (this.templates.has(templateId)) {
        return true;
      }

      // Try to load from disk
      const templatePath = path.join(this.templatesDir, `${templateId}.json`);
      
      if (await fs.pathExists(templatePath)) {
        logger.info(`Loading template from disk: ${templateId}`);
        const templateData = await fs.readJson(templatePath);
        
        // Validate and store in memory
        const validation = await this.validateTemplate(templateData);
        if (!validation.valid) {
          logger.error(`Template ${templateId} validation failed:`, validation.errors);
          return false;
        }

        this.templates.set(templateId, templateData);
        logger.info(`Template ${templateId} loaded successfully`);
        return true;
      }

      logger.warn(`Template ${templateId} not found on disk`);
      return false;

    } catch (error) {
      logger.error(`Error ensuring template exists ${templateId}:`, error);
      return false;
    }
  }

  async notifyTemplateChange(action, templateId) {
    try {
      // Check if Redis connection exists and has publish method
      if (this.redisConnection && typeof this.redisConnection.publish === 'function') {
        const message = JSON.stringify({
          action,
          templateId,
          timestamp: new Date().toISOString()
        });
        
        await this.redisConnection.publish('template-changes', message);
        logger.info(`Template change notification sent: ${action} - ${templateId}`);
      } else {
        logger.debug(`Redis connection not available for template notifications`);
      }
    } catch (error) {
      logger.error('Error notifying template change:', error);
    }
  }
}

module.exports = TemplateManager; 