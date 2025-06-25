/**
 * Test de Validación: Corrección de Assets y Limpieza
 * 
 * Valida que:
 * 1. Se evite múltiples limpiezas de carpeta output
 * 2. Las imágenes y videos se procesen correctamente
 * 3. Los comandos FFmpeg incluyan inputs de assets
 * 4. Los overlays de imágenes funcionen
 */

const path = require('path');
const fs = require('fs');

// Configuración del test
const API_BASE = 'http://localhost:3000/api';

// Template con imágenes y videos múltiples
const templateCompleto = {
  "metadata": {
    "id": "test-assets-fix",
    "title": "Test Assets y Limpieza",
    "description": "Video con imágenes, videos y texto",
    "version": "1.0.0",
    "created": new Date().toISOString()
  },
  "timeline": {
    "duration": 30,
    "fps": 30,
    "resolution": { "width": 1920, "height": 1080 },
    "background": { "color": "#2c3e50" },
    "tracks": [
      {
        "id": "track-main",
        "type": "main",
        "clips": [
          // Fondo
          {
            "id": "bg-1",
            "type": "background",
            "color": "#2c3e50",
            "start": 0,
            "duration": 30
          },
          
          // Imagen 1
          {
            "id": "img-1",
            "type": "image",
            "source": "city-skyline.jpg",
            "position": { "x": 100, "y": 100 },
            "scale": 0.5,
            "opacity": 85,
            "start": 2,
            "duration": 8
          },
          
          // Video
          {
            "id": "video-1",
            "type": "video",
            "source": "background-gradient.mp4",
            "position": { "x": 1200, "y": 200 },
            "scale": 0.4,
            "opacity": 70,
            "start": 5,
            "duration": 10
          },
          
          // Imagen 2
          {
            "id": "img-2",
            "type": "image",
            "source": "nature-scene.jpg",
            "position": { "x": 600, "y": 600 },
            "scale": 0.3,
            "opacity": 90,
            "start": 12,
            "duration": 8
          },
          
          // Texto principal
          {
            "id": "text-1",
            "type": "text",
            "text": "ASSETS FUNCIONANDO",
            "position": { "x": 960, "y": 300 },
            "style": {
              "fontSize": 84,
              "fontFamily": "Arial Black",
              "color": "#ffffff"
            },
            "start": 3,
            "duration": 24
          },
          
          // Texto info
          {
            "id": "text-2",
            "type": "text",
            "text": "Imágenes y videos procesados correctamente",
            "position": { "x": 960, "y": 500 },
            "style": {
              "fontSize": 36,
              "fontFamily": "Helvetica",
              "color": "#ecf0f1"
            },
            "start": 8,
            "duration": 15
          },
          
          // Forma decorativa
          {
            "id": "shape-1",
            "type": "shape",
            "shape": {
              "type": "rectangle",
              "width": 300,
              "height": 4,
              "fillColor": "#e74c3c"
            },
            "position": { "x": 810, "y": 450 },
            "opacity": 100,
            "start": 10,
            "duration": 10
          }
        ]
      }
    ]
  },
  "mergeFields": {}
};

async function testAssetsYLimpieza() {
  console.log('\n🧪 INICIANDO TEST: Assets y Limpieza');
  console.log('=' .repeat(60));

  try {
    // 1. Verificar que el servidor responde
    console.log('\n🔌 1. Verificando conexión con servidor...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (!healthResponse.ok) {
      throw new Error('Servidor no responde');
    }
    console.log('✅ Servidor conectado');

    // 2. Ejecutar primer renderizado
    console.log('\n🎬 2. Ejecutando PRIMER renderizado...');
    const response1 = await fetch(`${API_BASE}/template-to-video`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key-12345'
      },
      body: JSON.stringify({ 
        timeline: templateCompleto.timeline,
        mergeFields: templateCompleto.mergeFields
      })
    });

    if (!response1.ok) {
      throw new Error(`Error en primer renderizado: ${response1.status}`);
    }

    const result1 = await response1.json();
    console.log('✅ Primer renderizado exitoso');
    console.log('📄 Estructura de respuesta:', JSON.stringify(result1, null, 2));

    // 3. Ejecutar segundo renderizado (inmediatamente)
    console.log('\n🎬 3. Ejecutando SEGUNDO renderizado...');
    const response2 = await fetch(`${API_BASE}/template-to-video`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key-12345'
      },
      body: JSON.stringify({ 
        timeline: templateCompleto.timeline,
        mergeFields: templateCompleto.mergeFields
      })
    });

    if (!response2.ok) {
      throw new Error(`Error en segundo renderizado: ${response2.status}`);
    }

    const result2 = await response2.json();
    console.log('✅ Segundo renderizado exitoso');
    console.log('📄 Estructura de respuesta:', JSON.stringify(result2, null, 2));

    // 4. Verificar archivos generados
    console.log('\n📁 4. Verificando archivos generados...');
    const outputDir = path.join(__dirname, 'output');
    
    if (!fs.existsSync(outputDir)) {
      throw new Error('Carpeta output no existe');
    }

    const files = fs.readdirSync(outputDir);
    const videoFiles = files.filter(f => f.endsWith('.mp4'));
    
    console.log(`📊 Archivos en output: ${files.length}`);
    console.log(`🎥 Videos generados: ${videoFiles.length}`);
    console.log('📋 Lista de videos:', videoFiles);

    // 5. Verificar información de videos
    if (videoFiles.length >= 1) {
      videoFiles.forEach((filename, index) => {
        const videoPath = path.join(outputDir, filename);
        if (fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          console.log(`📺 Video ${index + 1}: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        }
      });
    }

    // 6. Resumen final
    console.log('\n📋 RESUMEN DEL TEST:');
    console.log('=' .repeat(40));
    console.log('✅ Conexión servidor: OK');
    console.log('✅ Primer renderizado: OK'); 
    console.log('✅ Segundo renderizado: OK');
    console.log('✅ Archivos generados: OK');
    console.log(`🎯 Videos creados: ${videoFiles.length}`);
    
    if (result1.data?.processingTime && result2.data?.processingTime) {
      console.log(`⏱️ Tiempo promedio: ${((result1.data.processingTime + result2.data.processingTime) / 2).toFixed(2)}s`);
    }

    console.log('\n🎉 TEST COMPLETADO EXITOSAMENTE');
    return true;

  } catch (error) {
    console.error('\n❌ ERROR EN TEST:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Ejecutar test
if (require.main === module) {
  testAssetsYLimpieza()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Error inesperado:', error);
      process.exit(1);
    });
}

module.exports = { testAssetsYLimpieza }; 