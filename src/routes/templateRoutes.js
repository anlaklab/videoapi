const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { templateSchema } = require('../validation/schemas');
const asyncHandler = require('../middleware/asyncHandler');
const TemplateManager = require('../services/templateManager');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Templates
 *   description: Gestión de plantillas de video
 */

// Initialize TemplateManager
const templateManager = new TemplateManager();

/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Crear plantilla de video
 *     tags: [Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Template'
 *           example:
 *             name: "Plantilla de Saludo"
 *             description: "Plantilla simple para videos de saludo"
 *             category: "social"
 *             tags: ["saludo", "simple"]
 *             timeline:
 *               tracks:
 *                 - clips:
 *                     - type: "text"
 *                       start: 0
 *                       duration: 3
 *                       text: "{{nombre}}"
 *                       position: { x: 100, y: 100 }
 *             mergeFields:
 *               nombre:
 *                 type: "string"
 *                 required: true
 *                 description: "Nombre para el saludo"
 *     responses:
 *       201:
 *         description: Plantilla creada exitosamente
 *       400:
 *         description: Error de validación
 *   get:
 *     summary: Listar plantillas
 *     tags: [Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoría
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filtrar por etiqueta
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar en nombre y descripción
 *     responses:
 *       200:
 *         description: Lista de plantillas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Template'
 */

// Create a new template
router.post('/', asyncHandler(async (req, res) => {
  const { error, value } = templateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  const templateData = {
    ...value,
    usageCount: 0
  };

  const template = await templateManager.createTemplate(templateData);

  logger.info(`Template created: ${template.id} - ${template.name}`);

  res.status(201).json({
    success: true,
    message: 'Template created successfully',
    template: {
      id: template.id,
      name: template.name,
      description: template.description,
      createdAt: template.metadata.createdAt,
      version: template.metadata.version
    }
  });
}));

// Get all templates
router.get('/', asyncHandler(async (req, res) => {
  const { category, tag, search, limit, offset } = req.query;
  
  const result = templateManager.listTemplates({
    limit: limit ? parseInt(limit) : 100,
    offset: offset ? parseInt(offset) : 0,
    search
  });

  let filteredTemplates = result.templates;

  // Filter by category
  if (category) {
    filteredTemplates = filteredTemplates.filter(t => 
      t.metadata?.category && t.metadata.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Filter by tag
  if (tag) {
    filteredTemplates = filteredTemplates.filter(t => 
      t.tags && t.tags.some(tTag => 
        tTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
  }

  // Return summary information
  const templateSummaries = filteredTemplates.map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.metadata?.category,
    tags: template.tags,
    createdAt: template.metadata?.createdAt,
    updatedAt: template.metadata?.updatedAt,
    version: template.metadata?.version,
    usageCount: template.usageCount || 0,
    mergeFields: template.mergeFields ? Object.keys(template.mergeFields) : []
  }));

  res.json({
    success: true,
    templates: templateSummaries,
    total: templateSummaries.length
  });
}));

/**
 * @swagger
 * /api/templates/{templateId}:
 *   get:
 *     summary: Obtener plantilla específica
 *     tags: [Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la plantilla
 *     responses:
 *       200:
 *         description: Plantilla encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 template:
 *                   $ref: '#/components/schemas/Template'
 *       404:
 *         description: Plantilla no encontrada
 *   put:
 *     summary: Actualizar plantilla
 *     tags: [Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la plantilla
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Template'
 *     responses:
 *       200:
 *         description: Plantilla actualizada
 *       404:
 *         description: Plantilla no encontrada
 *   delete:
 *     summary: Eliminar plantilla
 *     tags: [Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la plantilla
 *     responses:
 *       200:
 *         description: Plantilla eliminada
 *       404:
 *         description: Plantilla no encontrada
 */

// Get a specific template
router.get('/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = templateManager.getTemplate(templateId);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found',
      message: `No template found with ID: ${templateId}`
    });
  }

  res.json({
    success: true,
    template: template
  });
}));

// Update a template
router.put('/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const existingTemplate = templateManager.getTemplate(templateId);

  if (!existingTemplate) {
    return res.status(404).json({
      success: false,
      error: 'Template not found',
      message: `No template found with ID: ${templateId}`
    });
  }

  const { error, value } = templateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  const updatedTemplate = await templateManager.updateTemplate(templateId, value);

  logger.info(`Template updated: ${templateId} - ${updatedTemplate.name}`);

  res.json({
    success: true,
    message: 'Template updated successfully',
    template: {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      updatedAt: updatedTemplate.metadata.updatedAt,
      version: updatedTemplate.metadata.version
    }
  });
}));

// Delete a template
router.delete('/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = templateManager.getTemplate(templateId);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found',
      message: `No template found with ID: ${templateId}`
    });
  }

  await templateManager.deleteTemplate(templateId);

  logger.info(`Template deleted: ${templateId} - ${template.name}`);

  res.json({
    success: true,
    message: 'Template deleted successfully',
    templateId: templateId
  });
}));

/**
 * @swagger
 * /api/templates/{templateId}/render:
 *   post:
 *     summary: Renderizar video desde plantilla
 *     tags: [Templates]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la plantilla
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mergeFields:
 *                 type: object
 *                 description: Campos para reemplazar en la plantilla
 *               output:
 *                 $ref: '#/components/schemas/OutputConfig'
 *           example:
 *             mergeFields:
 *               nombre: "Juan Pérez"
 *               empresa: "Mi Empresa"
 *             output:
 *               format: "mp4"
 *               resolution: { width: 1920, height: 1080 }
 *     responses:
 *       202:
 *         description: Renderizado iniciado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 templateId:
 *                   type: string
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 statusUrl:
 *                   type: string
 *       404:
 *         description: Plantilla no encontrada
 */

// Render video from template
router.post('/:templateId/render', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = templateManager.getTemplate(templateId);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found',
      message: `No template found with ID: ${templateId}`
    });
  }

  const { mergeFields, output } = req.body;

  // Validate merge fields using TemplateManager
  try {
    await templateManager.validateMergeFields(template, mergeFields || {});
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Merge fields validation failed',
      message: error.message
    });
  }

  // Render template using TemplateManager
  const renderedData = await templateManager.renderTemplate(templateId, mergeFields || {}, output || {});

  // Forward to video rendering queue
  const { addTemplateRenderJob } = require('../queues/videoQueue');
  const jobId = uuidv4();

  logger.info(`Rendering template: ${templateId} with job: ${jobId}`);

  // Add job to queue
  try {
    await addTemplateRenderJob(templateId, mergeFields || {}, output || {}, {
      jobId,
      clientId: req.client?.id || 'unknown',
      apiKey: req.headers['x-api-key'],
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  } catch (error) {
    logger.error(`Failed to queue template rendering job ${jobId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start template rendering',
      message: error.message
    });
  }

  res.status(202).json({
    success: true,
    message: 'Template rendering started',
    templateId: templateId,
    jobId: jobId,
    status: 'processing',
    statusUrl: `/api/video/status/${jobId}`
  });
}));

// Get template categories
router.get('/meta/categories', asyncHandler(async (req, res) => {
  const result = templateManager.listTemplates();
  const categories = [...new Set(
    result.templates
      .map(t => t.metadata?.category)
      .filter(Boolean)
  )];

  res.json({
    success: true,
    categories: categories
  });
}));

// Get template tags
router.get('/meta/tags', asyncHandler(async (req, res) => {
  const allTags = [];
  const result = templateManager.listTemplates();
  
  result.templates.forEach(template => {
    if (template.tags) {
      allTags.push(...template.tags);
    }
  });

  const uniqueTags = [...new Set(allTags)];

  res.json({
    success: true,
    tags: uniqueTags
  });
}));

// Clone a template
router.post('/:templateId/clone', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const originalTemplate = templateManager.getTemplate(templateId);

  if (!originalTemplate) {
    return res.status(404).json({
      success: false,
      error: 'Template not found',
      message: `No template found with ID: ${templateId}`
    });
  }

  const { name, description } = req.body;

  const clonedTemplateData = {
    ...JSON.parse(JSON.stringify(originalTemplate)),
    name: name || `${originalTemplate.name} (Copy)`,
    description: description || `Cloned from ${originalTemplate.name}`,
    usageCount: 0,
    metadata: {
      ...originalTemplate.metadata,
      clonedFrom: templateId
    }
  };

  // Remove ID so a new one is generated
  delete clonedTemplateData.id;

  const clonedTemplate = await templateManager.createTemplate(clonedTemplateData);

  logger.info(`Template cloned: ${templateId} -> ${clonedTemplate.id}`);

  res.status(201).json({
    success: true,
    message: 'Template cloned successfully',
    template: {
      id: clonedTemplate.id,
      name: clonedTemplate.name,
      description: clonedTemplate.description,
      createdAt: clonedTemplate.metadata.createdAt
    }
  });
}));

// Export template
router.get('/:templateId/export', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = templateManager.getTemplate(templateId);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found',
      message: `No template found with ID: ${templateId}`
    });
  }

  const exportData = await templateManager.exportTemplate(templateId);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${template.name}.json"`);
  res.json(exportData);
}));

// Import template
router.post('/import', asyncHandler(async (req, res) => {
  const templateData = req.body;

  // Validate imported template
  const { error, value } = templateSchema.validate({
    name: templateData.name,
    description: templateData.description,
    timeline: templateData.timeline,
    mergeFields: templateData.mergeFields,
    tags: templateData.tags,
    category: templateData.category
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid template format',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  const importedTemplate = await templateManager.importTemplate({
    ...value,
    usageCount: 0
  });

  logger.info(`Template imported: ${importedTemplate.id} - ${importedTemplate.name}`);

  res.status(201).json({
    success: true,
    message: 'Template imported successfully',
    template: {
      id: importedTemplate.id,
      name: importedTemplate.name,
      description: importedTemplate.description,
      createdAt: importedTemplate.metadata.createdAt
    }
  });
}));

module.exports = router; 