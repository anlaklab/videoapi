#!/usr/bin/env node

/**
 * Script de Prueba Completa: After Effects → Template → Video
 * 
 * Este script realiza el flujo completo:
 * 1. Convierte un archivo .aep a template JSON
 * 2. Valida el template generado
 * 3. Genera un video de demo usando el template
 * 4. Verifica el resultado final
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

// Configuración
const CONFIG = {
  afterEffectsFile: 'assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep',
  templateName: 'Phone Mockup Kit Professional - Test Complete',
  apiUrl: 'http://localhost:3000',
  apiKey: 'dev-key-12345',
  outputDir: 'test-results',
  
  // Merge fields para el video de demo
  demoMergeFields: {
    PHONE_BODY_ASSET: 'assets/aftereffects/(Footage)/Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders/1/Body.mov',
    PHONE_GLASS_ASSET: 'assets/aftereffects/(Footage)/Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders/1/Glass.mov',
    SCREEN_CONTENT: 'assets/aftereffects/(Footage)/Animated Phone Mockup Kit/05. Others/3D Models Pre-Renders/1/Screen.mov',
    BACKGROUND_COLOR: '#1E3A8A',
    TITLE_TEXT: '🚀 Test Completo Exitoso',
    SUBTITLE_TEXT: 'After Effects → Template → Video',
    TEXT_COLOR: '#F3F4F6'
  }
};

class CompleteAfterEffectsTest {
  constructor() {
    this.templateId = null;
    this.videoJobId = null;
    this.results = {
      conversion: null,
      validation: null,
      rendering: null,
      final: null
    };
  }

  async run() {
    console.log('🧪 === PRUEBA COMPLETA AFTER EFFECTS ===\n');
    
    try {
      // Preparar entorno
      await this.setupEnvironment();
      
      // Paso 1: Conversión AEP → Template
      await this.step1_ConvertAepToTemplate();
      
      // Paso 2: Validación del Template
      await this.step2_ValidateTemplate();
      
      // Paso 3: Renderizado de Video Demo
      await this.step3_RenderDemoVideo();
      
      // Paso 4: Verificación Final
      await this.step4_FinalVerification();
      
      // Generar reporte final
      await this.generateFinalReport();
      
      console.log('✅ === PRUEBA COMPLETA EXITOSA ===\n');
      
    } catch (error) {
      console.error('❌ === PRUEBA FALLÓ ===');
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      
      await this.generateErrorReport(error);
      process.exit(1);
    }
  }

  async setupEnvironment() {
    console.log('🔧 Configurando entorno de prueba...');
    
    // Crear directorio de resultados
    await fs.ensureDir(CONFIG.outputDir);
    
    // Verificar que el archivo AEP existe
    const aepPath = path.resolve(CONFIG.afterEffectsFile);
    const aepExists = await fs.pathExists(aepPath);
    
    if (!aepExists) {
      throw new Error(`Archivo After Effects no encontrado: ${aepPath}`);
    }
    
    console.log(`✅ Archivo AEP encontrado: ${aepPath}`);
    
    // Verificar que el servidor está ejecutándose
    try {
      const response = await axios.get(`${CONFIG.apiUrl}/health`, {
        headers: { 'X-API-KEY': CONFIG.apiKey },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ Servidor API está funcionando');
      }
    } catch (error) {
      throw new Error(`Servidor API no está disponible: ${CONFIG.apiUrl}`);
    }
    
    console.log('✅ Entorno configurado correctamente\n');
  }

  async step1_ConvertAepToTemplate() {
    console.log('📁 PASO 1: Convirtiendo After Effects a Template...');
    
    const startTime = Date.now();
    
    try {
      // Importar y usar el AfterEffectsProcessor
      const AfterEffectsProcessor = require('./src/services/afterEffectsProcessor');
      const processor = new AfterEffectsProcessor();
      
      console.log(`🔄 Procesando: ${CONFIG.afterEffectsFile}`);
      console.log(`📝 Nombre del template: ${CONFIG.templateName}`);
      
      // Convertir AEP a template
      const conversionResult = await processor.convertAepToTemplate(
        CONFIG.afterEffectsFile,
        CONFIG.templateName
      );
      
      this.templateId = conversionResult.templateId;
      const processingTime = Date.now() - startTime;
      
      // Guardar información de conversión
      this.results.conversion = {
        success: true,
        templateId: this.templateId,
        templatePath: conversionResult.templatePath,
        processingTime: `${processingTime}ms`,
        templateSize: conversionResult.fileSize,
        projectInfo: conversionResult.projectInfo,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Conversión exitosa:`);
      console.log(`   📋 Template ID: ${this.templateId}`);
      console.log(`   📁 Archivo: ${conversionResult.templatePath}`);
      console.log(`   📊 Tamaño: ${Math.round(conversionResult.fileSize / 1024)} KB`);
      console.log(`   ⏱️  Tiempo: ${processingTime}ms`);
      console.log(`   🎬 Tracks: ${conversionResult.projectInfo.stats?.totalTracks || 0}`);
      console.log(`   🎞️  Clips: ${conversionResult.projectInfo.stats?.totalClips || 0}`);
      console.log(`   🔧 Merge Fields: ${conversionResult.projectInfo.mergeFields?.length || 0}\n`);
      
    } catch (error) {
      this.results.conversion = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      throw new Error(`Error en conversión AEP: ${error.message}`);
    }
  }

  async step2_ValidateTemplate() {
    console.log('🔍 PASO 2: Validando Template Generado...');
    
    try {
      // Verificar que el template existe en el sistema
      const templatesResponse = await axios.get(`${CONFIG.apiUrl}/api/templates`, {
        headers: { 'X-API-KEY': CONFIG.apiKey }
      });
      
      const template = templatesResponse.data.templates.find(t => t.id === this.templateId);
      
      if (!template) {
        throw new Error(`Template ${this.templateId} no encontrado en el sistema`);
      }
      
      // Validar estructura del template
      const validation = this.validateTemplateStructure(template);
      
      this.results.validation = {
        success: validation.isValid,
        template: {
          id: template.id,
          name: template.name,
          type: template.type,
          duration: template.duration,
          mergeFieldsCount: template.mergeFields?.length || 0,
          tracksCount: template.timeline?.tracks?.length || 0
        },
        validation: validation,
        timestamp: new Date().toISOString()
      };
      
      if (!validation.isValid) {
        throw new Error(`Template inválido: ${validation.errors.join(', ')}`);
      }
      
      console.log(`✅ Template validado correctamente:`);
      console.log(`   📋 ID: ${template.id}`);
      console.log(`   📝 Nombre: ${template.name}`);
      console.log(`   🎬 Tipo: ${template.type}`);
      console.log(`   ⏱️  Duración: ${template.duration}s`);
      console.log(`   🔧 Merge Fields: ${template.mergeFields?.length || 0}`);
      console.log(`   🎞️  Tracks: ${template.timeline?.tracks?.length || 0}\n`);
      
    } catch (error) {
      this.results.validation = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      throw new Error(`Error en validación: ${error.message}`);
    }
  }

  async step3_RenderDemoVideo() {
    console.log('🎥 PASO 3: Renderizando Video Demo...');
    
    const startTime = Date.now();
    
    try {
      // Iniciar renderizado
      console.log(`🚀 Iniciando renderizado con template: ${this.templateId}`);
      console.log(`🔧 Merge fields:`, CONFIG.demoMergeFields);
      
      const renderResponse = await axios.post(
        `${CONFIG.apiUrl}/api/templates/${this.templateId}/render`,
        CONFIG.demoMergeFields,
        {
          headers: { 
            'Content-Type': 'application/json',
            'X-API-KEY': CONFIG.apiKey 
          },
          timeout: 10000
        }
      );
      
      if (renderResponse.status !== 200) {
        throw new Error(`Error iniciando renderizado: ${renderResponse.status}`);
      }
      
      this.videoJobId = renderResponse.data.jobId;
      console.log(`✅ Renderizado iniciado - Job ID: ${this.videoJobId}`);
      
      // Monitorear progreso
      const videoResult = await this.monitorRenderingProgress();
      
      const processingTime = Date.now() - startTime;
      
      this.results.rendering = {
        success: true,
        jobId: this.videoJobId,
        videoUrl: videoResult.url,
        duration: videoResult.duration,
        size: videoResult.size,
        format: videoResult.format,
        resolution: videoResult.resolution,
        processingTime: `${processingTime}ms`,
        processingInfo: videoResult.processingInfo,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Video renderizado exitosamente:`);
      console.log(`   🎬 Job ID: ${this.videoJobId}`);
      console.log(`   🔗 URL: ${videoResult.url}`);
      console.log(`   ⏱️  Duración: ${videoResult.duration}s`);
      console.log(`   📊 Tamaño: ${Math.round(videoResult.size / 1024)} KB`);
      console.log(`   📐 Resolución: ${videoResult.resolution.width}x${videoResult.resolution.height}`);
      console.log(`   🔧 Procesador: ${videoResult.processingInfo?.processor || 'N/A'}`);
      console.log(`   ⏱️  Tiempo total: ${processingTime}ms\n`);
      
    } catch (error) {
      this.results.rendering = {
        success: false,
        error: error.message,
        jobId: this.videoJobId,
        timestamp: new Date().toISOString()
      };
      throw new Error(`Error en renderizado: ${error.message}`);
    }
  }

  async step4_FinalVerification() {
    console.log('🔍 PASO 4: Verificación Final...');
    
    try {
      const checks = [];
      
      // Verificar que el template existe
      checks.push(await this.verifyTemplateExists());
      
      // Verificar que el video fue generado
      checks.push(await this.verifyVideoGenerated());
      
      // Verificar accesibilidad del video
      checks.push(await this.verifyVideoAccessible());
      
      const allPassed = checks.every(check => check.passed);
      
      this.results.final = {
        success: allPassed,
        checks: checks,
        summary: {
          totalChecks: checks.length,
          passed: checks.filter(c => c.passed).length,
          failed: checks.filter(c => !c.passed).length
        },
        timestamp: new Date().toISOString()
      };
      
      if (!allPassed) {
        const failedChecks = checks.filter(c => !c.passed);
        throw new Error(`Verificaciones fallaron: ${failedChecks.map(c => c.name).join(', ')}`);
      }
      
      console.log(`✅ Todas las verificaciones pasaron:`);
      checks.forEach(check => {
        console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}: ${check.message}`);
      });
      console.log('');
      
    } catch (error) {
      this.results.final = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      throw error;
    }
  }

  async monitorRenderingProgress() {
    const maxAttempts = 60; // 5 minutos máximo
    let attempts = 0;
    
    console.log('⏳ Monitoreando progreso del renderizado...');
    
    while (attempts < maxAttempts) {
      try {
        const statusResponse = await axios.get(
          `${CONFIG.apiUrl}/api/video/${this.videoJobId}/status`,
          {
            headers: { 'X-API-KEY': CONFIG.apiKey },
            timeout: 5000
          }
        );
        
        const status = statusResponse.data;
        
        if (status.status === 'completed') {
          console.log(`✅ Renderizado completado (${status.progress}%)`);
          return status.result;
        } else if (status.status === 'failed') {
          throw new Error(`Renderizado falló: ${status.error?.message || 'Error desconocido'}`);
        } else {
          // En progreso
          console.log(`⏳ Progreso: ${status.progress}% (${status.status})`);
        }
        
        // Esperar 5 segundos antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
        
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('⏳ Job aún no encontrado, esperando...');
        } else {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }
    
    throw new Error('Timeout esperando completar el renderizado');
  }

  validateTemplateStructure(template) {
    const errors = [];
    const warnings = [];
    
    // Validaciones básicas
    if (!template.id) errors.push('Template ID faltante');
    if (!template.name) errors.push('Template name faltante');
    if (template.type !== 'after-effects') errors.push('Template type debe ser "after-effects"');
    if (!template.timeline) errors.push('Timeline faltante');
    if (!template.mergeFields) warnings.push('Merge fields no definidos');
    
    // Validaciones del timeline
    if (template.timeline) {
      if (!template.timeline.tracks || !Array.isArray(template.timeline.tracks)) {
        errors.push('Timeline tracks debe ser un array');
      } else if (template.timeline.tracks.length === 0) {
        warnings.push('Timeline no tiene tracks');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async verifyTemplateExists() {
    try {
      const response = await axios.get(`${CONFIG.apiUrl}/api/templates`, {
        headers: { 'X-API-KEY': CONFIG.apiKey }
      });
      
      const template = response.data.templates.find(t => t.id === this.templateId);
      
      return {
        name: 'Template Exists',
        passed: !!template,
        message: template ? `Template ${this.templateId} encontrado` : `Template ${this.templateId} no encontrado`
      };
    } catch (error) {
      return {
        name: 'Template Exists',
        passed: false,
        message: `Error verificando template: ${error.message}`
      };
    }
  }

  async verifyVideoGenerated() {
    if (!this.results.rendering?.success) {
      return {
        name: 'Video Generated',
        passed: false,
        message: 'Video no fue generado exitosamente'
      };
    }
    
    return {
      name: 'Video Generated',
      passed: true,
      message: `Video generado: ${this.results.rendering.videoUrl}`
    };
  }

  async verifyVideoAccessible() {
    if (!this.results.rendering?.videoUrl) {
      return {
        name: 'Video Accessible',
        passed: false,
        message: 'URL del video no disponible'
      };
    }
    
    try {
      const response = await axios.head(this.results.rendering.videoUrl, { timeout: 10000 });
      
      return {
        name: 'Video Accessible',
        passed: response.status === 200,
        message: response.status === 200 ? 'Video accesible' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        name: 'Video Accessible',
        passed: false,
        message: `Error accediendo video: ${error.message}`
      };
    }
  }

  async generateFinalReport() {
    const reportPath = path.join(CONFIG.outputDir, `test-report-${Date.now()}.json`);
    
    const report = {
      testInfo: {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        templateId: this.templateId,
        videoJobId: this.videoJobId
      },
      results: this.results,
      summary: {
        success: Object.values(this.results).every(r => r?.success !== false),
        steps: {
          conversion: this.results.conversion?.success || false,
          validation: this.results.validation?.success || false,
          rendering: this.results.rendering?.success || false,
          final: this.results.final?.success || false
        }
      }
    };
    
    await fs.writeJson(reportPath, report, { spaces: 2 });
    
    console.log(`📋 Reporte generado: ${reportPath}`);
    
    // Mostrar resumen
    console.log('\n📊 === RESUMEN FINAL ===');
    console.log(`✅ Conversión AEP → Template: ${report.summary.steps.conversion ? 'EXITOSA' : 'FALLÓ'}`);
    console.log(`✅ Validación Template: ${report.summary.steps.validation ? 'EXITOSA' : 'FALLÓ'}`);
    console.log(`✅ Renderizado Video: ${report.summary.steps.rendering ? 'EXITOSO' : 'FALLÓ'}`);
    console.log(`✅ Verificación Final: ${report.summary.steps.final ? 'EXITOSA' : 'FALLÓ'}`);
    console.log(`\n🎯 RESULTADO GENERAL: ${report.summary.success ? '✅ EXITOSO' : '❌ FALLÓ'}`);
    
    if (this.results.rendering?.videoUrl) {
      console.log(`\n🎬 VIDEO FINAL: ${this.results.rendering.videoUrl}`);
    }
  }

  async generateErrorReport(error) {
    const errorReportPath = path.join(CONFIG.outputDir, `error-report-${Date.now()}.json`);
    
    const errorReport = {
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      partialResults: this.results,
      config: CONFIG
    };
    
    await fs.writeJson(errorReportPath, errorReport, { spaces: 2 });
    console.log(`📋 Reporte de error generado: ${errorReportPath}`);
  }
}

// Ejecutar prueba si es llamado directamente
if (require.main === module) {
  const test = new CompleteAfterEffectsTest();
  test.run().catch(console.error);
}

module.exports = CompleteAfterEffectsTest; 