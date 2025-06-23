const AfterEffectsProcessor = require('./src/services/afterEffectsProcessor');
const logger = require('./src/utils/logger');
const path = require('path');

/**
 * Script de conversión de After Effects
 * 
 * Este script convierte archivos .aep a templates JSON utilizables
 * por nuestro sistema de renderizado de video.
 */

async function convertAfterEffectsProject() {
  try {
    logger.info('🎬 INICIANDO CONVERSIÓN DE AFTER EFFECTS');
    logger.info('==========================================');
    
    // Inicializar el procesador
    const aeProcessor = new AfterEffectsProcessor();
    
    // Ruta al archivo de After Effects
    const aepFilePath = path.resolve('assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep');
    
    logger.info(`📁 Archivo AEP: ${aepFilePath}`);
    
    // Verificar que el archivo existe
    const fs = require('fs-extra');
    if (!await fs.pathExists(aepFilePath)) {
      throw new Error(`❌ Archivo After Effects no encontrado: ${aepFilePath}`);
    }
    
    logger.info('✅ Archivo After Effects encontrado');
    logger.info('🔍 Iniciando análisis del proyecto...');
    
    // Convertir el proyecto
    const result = await aeProcessor.convertAepToTemplate(
      aepFilePath,
      'Phone Mockup Kit Professional'
    );
    
    // Mostrar resultados
    logger.info('');
    logger.info('🎉 CONVERSIÓN MODULAR COMPLETADA EXITOSAMENTE');
    logger.info('=============================================');
    logger.info(`📋 Template ID: ${result.templateId}`);
    logger.info(`📝 Nombre: ${result.templateName}`);
    logger.info(`📁 Archivo: ${result.filePath}`);
    logger.info(`🎯 Tipo de proyecto: ${result.projectInfo.projectType}`);
    logger.info(`⏱️  Duración: ${result.projectInfo.duration} segundos`);
    logger.info(`📐 Resolución: ${result.projectInfo.resolution.width}x${result.projectInfo.resolution.height}`);
    logger.info(`🎞️  Frame Rate: ${result.projectInfo.frameRate} fps`);
    logger.info(`⚡ Tiempo de procesamiento: ${result.processingTime}ms`);
    
    // Mostrar validación
    if (result.validation) {
      logger.info('');
      logger.info('🔍 VALIDACIÓN DEL PROYECTO:');
      logger.info('============================');
      if (result.validation.isValid) {
        logger.info('✅ Proyecto válido - sin errores detectados');
      } else {
        logger.info(`❌ ${result.validation.errors.length} errores encontrados:`);
        result.validation.errors.forEach((error, index) => {
          logger.info(`   ${index + 1}. ${error}`);
        });
      }
    }
    
    // Mostrar estadísticas del template
    if (result.template.stats) {
      logger.info('');
      logger.info('📊 ESTADÍSTICAS DEL TEMPLATE:');
      logger.info('==============================');
      logger.info(`🎬 Total tracks: ${result.template.stats.totalTracks}`);
      logger.info(`📽️  Total clips: ${result.template.stats.totalClips}`);
      logger.info(`🎞️  Frame rate: ${result.template.stats.frameRate} fps`);
      logger.info(`⏰ Duración: ${result.template.stats.duration}s`);
      logger.info(`🎨 Tiene animaciones: ${result.template.stats.hasAnimations ? 'Sí' : 'No'}`);
      logger.info(`✨ Tiene efectos: ${result.template.stats.hasEffects ? 'Sí' : 'No'}`);
      
      // Detalles por tipo de track
      logger.info('');
      logger.info('📋 Breakdown por tracks:');
      Object.entries(result.template.stats.trackStats).forEach(([type, stats]) => {
        logger.info(`   ${type}: ${stats.clipCount} clips (${stats.duration}s)`);
      });
      
      // Detalles por tipo de clip
      logger.info('');
      logger.info('🎯 Breakdown por clips:');
      Object.entries(result.template.stats.clipTypes).forEach(([type, count]) => {
        logger.info(`   ${type}: ${count} clips`);
      });
    }

    // Mostrar merge fields detectados
    logger.info('');
    logger.info('🔧 MERGE FIELDS DETECTADOS:');
    logger.info('============================');
    result.template.mergeFields.forEach((field, index) => {
      logger.info(`${index + 1}. ${field.key} (${field.type})`);
      logger.info(`   📝 ${field.description}`);
      logger.info(`   🎯 Valor por defecto: ${field.defaultValue || 'N/A'}`);
      logger.info('');
    });

    // Mostrar estructura optimizada del timeline
    logger.info('🎬 TIMELINE OPTIMIZADO:');
    logger.info('========================');
    result.template.timeline.tracks.forEach((track, trackIndex) => {
      logger.info(`Track ${trackIndex + 1}: ${track.name} (${track.clips.length} clips)`);
      
      // Mostrar optimizaciones si existen
      if (track.metadata?.optimizations) {
        const opt = track.metadata.optimizations;
        logger.info(`   ⚡ Optimizado: ${opt.originalCount} → ${opt.optimizedCount} clips (${opt.clipsRemoved} removidos)`);
      }
      
      // Mostrar metadata del track
      if (track.metadata) {
        logger.info(`   📊 Duración: ${track.metadata.duration}s`);
        logger.info(`   🎨 Animaciones: ${track.metadata.hasAnimations ? 'Sí' : 'No'}`);
        logger.info(`   ✨ Efectos: ${track.metadata.hasEffects ? 'Sí' : 'No'}`);
      }
      
      track.clips.forEach((clip, clipIndex) => {
        logger.info(`  📽️  Clip ${clipIndex + 1}: ${clip.name} (${clip.type})`);
        logger.info(`      ⏰ ${clip.start}s - ${clip.start + clip.duration}s`);
        if (clip.text) logger.info(`      📝 Texto: ${clip.text}`);
        if (clip.src) logger.info(`      📁 Fuente: ${clip.src}`);
        if (clip.effects?.length > 0) logger.info(`      ✨ Efectos: ${clip.effects.length}`);
        if (clip.animation || clip.animations) logger.info(`      🎨 Animación: ${clip.animation?.type || 'Múltiples'}`);
      });
      logger.info('');
    });

    // Mostrar reporte de assets
    if (result.report?.assets) {
      logger.info('🎨 REPORTE DE ASSETS:');
      logger.info('=====================');
      const assets = result.report.assets;
      logger.info(`📁 Total assets: ${assets.totalAssets}`);
      logger.info(`💾 Tamaño total: ${(assets.totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      if (assets.byType && Object.keys(assets.byType).length > 0) {
        logger.info('');
        logger.info('📋 Por tipo:');
        Object.entries(assets.byType).forEach(([type, count]) => {
          logger.info(`   ${type}: ${count} archivos`);
        });
      }
      
      if (assets.largestAsset) {
        logger.info('');
        logger.info(`📦 Asset más grande: ${assets.largestAsset.fileName} (${(assets.largestAsset.size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }

    // Mostrar assets disponibles del mockup
    if (result.projectInfo.availableAssets && result.projectInfo.availableAssets.length > 0) {
      logger.info('📱 VARIANTES DEL PHONE MOCKUP:');
      logger.info('==============================');
      result.projectInfo.availableAssets.forEach((assetGroup, index) => {
        logger.info(`${index + 1}. ${assetGroup.name} (ID: ${assetGroup.id})`);
        logger.info(`   📁 Componentes: ${assetGroup.components?.length || 0}`);
        logger.info(`   🔀 Múltiples variantes: ${assetGroup.hasMultipleComponents ? 'Sí' : 'No'}`);
        
        if (assetGroup.components) {
          assetGroup.components.forEach(component => {
            logger.info(`      ${component.component}: ${component.fileName} (${(component.size / 1024).toFixed(1)} KB)`);
          });
        }
        logger.info('');
      });
    }
    
    logger.info('✅ Template optimizado y listo para usar');
    logger.info(`🌐 Ahora puedes usar este template con el ID: ${result.templateId}`);
    logger.info(`📈 Rendimiento: ${result.template.stats?.totalClips || 0} clips procesados en ${result.processingTime}ms`);
    
    return result;
    
  } catch (error) {
    logger.error('❌ ERROR EN LA CONVERSIÓN:');
    logger.error('===========================');
    logger.error(error.message);
    logger.error(error.stack);
    throw error;
  }
}

// Ejecutar la conversión si se llama directamente
if (require.main === module) {
  convertAfterEffectsProject()
    .then(result => {
      logger.info('');
      logger.info('🚀 ¡Conversión completada! Puedes usar el template ahora.');
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Falló la conversión:', error.message);
      process.exit(1);
    });
}

module.exports = { convertAfterEffectsProject }; 
module.exports = { convertAfterEffectsProject }; 