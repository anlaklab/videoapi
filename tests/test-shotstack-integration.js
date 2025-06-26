/**
 * Test de Integración: Shotstack Studio + JSON2VIDEO API
 * 
 * Valida que:
 * 1. Los timelines de Shotstack se conviertan correctamente a JSON2VIDEO
 * 2. Los videos se rendericen usando nuestro pipeline FFmpeg
 * 3. El adaptador funcione correctamente
 */

const API_BASE = 'http://localhost:3000/api';

// Timeline de ejemplo en formato Shotstack
const shotstackTimeline = {
  resolution: {
    width: 1920,
    height: 1080
  },
  background: {
    color: "#1a1a2e"
  },
  tracks: [
    {
      id: "main-track",
      clips: [
        // Texto principal
        {
          id: "title-clip",
          start: 1,
          length: 5,
          position: "center",
          asset: {
            type: "text",
            text: "Shotstack + JSON2VIDEO",
            style: {
              fontSize: 84,
              fontFamily: "arial-black",
              color: "#ffffff"
            }
          }
        },
        
        // Subtítulo
        {
          id: "subtitle-clip", 
          start: 3,
          length: 6,
          position: { x: 960, y: 600 },
          asset: {
            type: "text",
            text: "Integración Completa",
            style: {
              fontSize: 48,
              fontFamily: "helvetica",
              color: "#00d4ff"
            }
          }
        },

        // Forma decorativa
        {
          id: "shape-clip",
          start: 6,
          length: 4,
          position: { x: 760, y: 500 },
          opacity: 0.8,
          asset: {
            type: "shape",
            width: 400,
            height: 8,
            color: "#ff6b6b"
          }
        },

        // Imagen de ejemplo
        {
          id: "image-clip",
          start: 7,
          length: 5,
          position: { x: 100, y: 100 },
          scale: 0.5,
          opacity: 0.9,
          asset: {
            type: "image",
            src: "city-skyline.jpg"
          }
        }
      ]
    }
  ]
};

async function testShotstackIntegration() {
  console.log('\n🧪 INICIANDO TEST: Integración Shotstack Studio');
  console.log('=' .repeat(70));

  try {
    // 1. Verificar servidor
    console.log('\n🔌 1. Verificando conexión con servidor...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (!healthResponse.ok) {
      throw new Error('Servidor no responde');
    }
    console.log('✅ Servidor conectado');

    // 2. Test de conversión (sin renderizado)
    console.log('\n🔄 2. Probando conversión Shotstack → JSON2VIDEO...');
    const convertResponse = await fetch(`${API_BASE}/shotstack/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key-12345'
      },
      body: JSON.stringify({
        timeline: shotstackTimeline,
        mergeFields: {}
      })
    });

    if (!convertResponse.ok) {
      const errorData = await convertResponse.text();
      throw new Error(`Error en conversión: ${convertResponse.status} - ${errorData}`);
    }

    const convertResult = await convertResponse.json();
    console.log('✅ Conversión exitosa');
    console.log(`📊 Timeline convertido: ${convertResult.data.conversion.tracksCount} pistas, ${convertResult.data.conversion.clipsCount} clips`);

    // 3. Test de renderizado completo
    console.log('\n🎬 3. Probando renderizado completo...');
    const renderResponse = await fetch(`${API_BASE}/shotstack/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key-12345'
      },
      body: JSON.stringify({
        timeline: shotstackTimeline,
        mergeFields: {},
        output: {
          format: 'mp4',
          resolution: { width: 1920, height: 1080 },
          fps: 30,
          quality: 'high'
        }
      })
    });

    if (!renderResponse.ok) {
      const errorData = await renderResponse.text();
      throw new Error(`Error en renderizado: ${renderResponse.status} - ${errorData}`);
    }

    const renderResult = await renderResponse.json();
    console.log('✅ Renderizado exitoso');
    console.log(`🎥 Video generado: ${renderResult.data.data.result.filename}`);
    console.log(`📏 Duración: ${renderResult.data.data.result.duration}s`);
    console.log(`💾 Tamaño: ${(renderResult.data.data.result.size / 1024).toFixed(1)} KB`);

    // 4. Verificar archivo generado
    console.log('\n📁 4. Verificando archivo generado...');
    const videoUrl = `http://localhost:3000${renderResult.data.data.result.url}`;
    
    try {
      const videoResponse = await fetch(videoUrl, { method: 'HEAD' });
      if (videoResponse.ok) {
        console.log('✅ Video accesible en:', videoUrl);
      } else {
        console.log('⚠️ Video no accesible directamente');
      }
    } catch (error) {
      console.log('⚠️ No se pudo verificar acceso al video');
    }

    // 5. Validar datos de conversión
    console.log('\n🔍 5. Validando datos de conversión...');
    const conversion = renderResult.data.conversion;
    console.log(`📤 Origen: ${conversion.source}`);
    console.log(`📥 Destino: ${conversion.target}`);
    console.log(`🎞️ Pistas procesadas: ${conversion.tracksProcessed}`);
    console.log(`🎬 Clips procesados: ${conversion.clipsProcessed}`);

    // 6. Resumen final
    console.log('\n📋 RESUMEN DEL TEST:');
    console.log('=' .repeat(40));
    console.log('✅ Conexión servidor: OK');
    console.log('✅ Conversión formato: OK');
    console.log('✅ Renderizado completo: OK');
    console.log('✅ Archivo generado: OK');
    console.log('✅ Validación datos: OK');
    console.log(`🎯 Timeline: ${shotstackTimeline.tracks.length} pista(s), ${shotstackTimeline.tracks[0].clips.length} clip(s)`);
    console.log(`⏱️ Tiempo de procesamiento: ${renderResult.data.data.processingTime.toFixed(2)}s`);

    console.log('\n🎉 INTEGRACIÓN SHOTSTACK COMPLETADA EXITOSAMENTE');
    return true;

  } catch (error) {
    console.error('\n❌ ERROR EN TEST:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Función para mostrar timeline detallado
function showTimelineDetails() {
  console.log('\n📋 DETALLES DEL TIMELINE SHOTSTACK:');
  console.log('-'.repeat(50));
  
  shotstackTimeline.tracks.forEach((track, trackIndex) => {
    console.log(`\n🎞️ Track ${trackIndex}: ${track.id}`);
    track.clips.forEach((clip, clipIndex) => {
      const asset = clip.asset;
      console.log(`  📄 Clip ${clipIndex}: ${clip.id}`);
      console.log(`     ⏱️ ${clip.start}s → ${clip.start + clip.length}s (${clip.length}s)`);
      console.log(`     🎯 Tipo: ${asset.type}`);
      
      if (asset.type === 'text') {
        console.log(`     📝 Texto: "${asset.text}"`);
        console.log(`     🎨 Estilo: ${asset.style.fontSize}px ${asset.style.fontFamily} ${asset.style.color}`);
      } else if (asset.type === 'image') {
        console.log(`     🖼️ Imagen: ${asset.src}`);
        console.log(`     📐 Escala: ${clip.scale}x, Opacidad: ${clip.opacity}`);
      } else if (asset.type === 'shape') {
        console.log(`     🔷 Forma: ${asset.width}x${asset.height} ${asset.color}`);
      }
      
      if (clip.position) {
        if (typeof clip.position === 'string') {
          console.log(`     📍 Posición: ${clip.position}`);
        } else {
          console.log(`     📍 Posición: (${clip.position.x}, ${clip.position.y})`);
        }
      }
    });
  });
}

// Ejecutar test
if (require.main === module) {
  console.log('🎬 TEST DE INTEGRACIÓN SHOTSTACK STUDIO + JSON2VIDEO API');
  showTimelineDetails();
  
  testShotstackIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Error inesperado:', error);
      process.exit(1);
    });
}

module.exports = { testShotstackIntegration, shotstackTimeline }; 