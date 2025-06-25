/**
 * Test de Debug - Error 400
 * Para verificar qué está causando el error en el endpoint template-to-video
 */

const API_BASE = 'http://localhost:3000/api';

// Template simple y básico
const templateSimple = {
  timeline: {
    duration: 10,
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    background: { color: "#000000" },
    tracks: [
      {
        id: "track-1",
        clips: [
          {
            id: "text-1",
            type: "text",
            text: "Texto de prueba",
            start: 1,
            duration: 8,
            style: {
              fontSize: 48,
              color: "#ffffff"
            }
          }
        ]
      }
    ]
  },
  mergeFields: {}
};

async function debugError400() {
  console.log('\n🔍 DEBUGGEANDO ERROR 400');
  console.log('=' .repeat(50));

  try {
    console.log('\n📤 Enviando template simple...');
    const response = await fetch(`${API_BASE}/template-to-video`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'dev-key-12345'
      },
      body: JSON.stringify({ template: templateSimple })
    });

    console.log(`📊 Status: ${response.status}`);
    
    const responseText = await response.text();
    console.log('📄 Response:');
    console.log(responseText);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        console.log('\n🔍 Error details:');
        console.log('- Mensaje:', errorData.message || errorData.error);
        console.log('- Detalles:', errorData.details || 'No hay detalles');
      } catch (parseError) {
        console.log('\n⚠️ Response no es JSON válido');
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

// Ejecutar debug
debugError400(); 