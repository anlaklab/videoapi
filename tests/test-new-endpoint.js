/**
 * Test del nuevo endpoint /api/aftereffects/convert
 * Simula la petición curl del usuario
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testNewEndpoint() {
  console.log('🧪 TESTING NUEVO ENDPOINT /api/aftereffects/convert');
  console.log('================================================\n');

  const aepFile = './assets/aftereffects/Animated Phone Mockup Kit CC (15.x).aep';
  const serverUrl = 'http://localhost:3000';

  try {
    // Verificar que el archivo existe
    if (!fs.existsSync(aepFile)) {
      throw new Error(`Archivo AE no encontrado: ${aepFile}`);
    }

    console.log('📁 Archivo AE encontrado:', aepFile);
    const stats = fs.statSync(aepFile);
    console.log('📊 Tamaño:', Math.round(stats.size / 1024 / 1024), 'MB\n');

    // Crear FormData como en la petición curl
    const form = new FormData();
    form.append('aepFile', fs.createReadStream(aepFile));
    form.append('templateName', 'Test Template from Script');
    form.append('templateDescription', 'Template generado por script de test');
    form.append('saveTemplate', 'true');

    console.log('🚀 Enviando petición POST a /api/aftereffects/convert...\n');

    const startTime = Date.now();

    // Enviar petición
    const response = await axios.post(
      `${serverUrl}/api/aftereffects/convert`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'x-api-key': 'dev-key-12345',
          'x-correlation-id': 'test-' + Date.now()
        },
        timeout: 60000 // 60 segundos timeout
      }
    );

    const processingTime = Date.now() - startTime;

    console.log('✅ RESPUESTA EXITOSA');
    console.log('='.repeat(30));
    console.log('Status:', response.status);
    console.log('Tiempo de respuesta:', processingTime + 'ms');
    
    if (response.data.success) {
      console.log('\n📋 DATOS DEL TEMPLATE:');
      console.log('Template ID:', response.data.data.templateId);
      console.log('Template Name:', response.data.data.templateName);
      console.log('Método de análisis:', response.data.data.metadata.analysisMethod);
      console.log('Profundidad de contenido:', response.data.data.metadata.contentDepth);
      
      console.log('\n📊 ESTADÍSTICAS:');
      console.log('Tracks:', response.data.data.stats.tracks);
      console.log('Animaciones:', response.data.data.stats.animations);
      console.log('Efectos:', response.data.data.stats.effects);
      console.log('Merge Fields:', response.data.data.stats.mergeFields);
      
      if (response.data.data.templateSaved) {
        console.log('\n💾 Template guardado en:', response.data.data.templatePath);
      }
      
      console.log('\n🎉 TEST EXITOSO - El nuevo endpoint funciona correctamente!');
    } else {
      console.log('❌ Respuesta con success: false');
      console.log('Error:', response.data.error);
    }

  } catch (error) {
    console.error('\n❌ ERROR EN TEST:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor');
      console.error('¿Está el servidor corriendo en', serverUrl, '?');
    } else {
      console.error('Error:', error.message);
    }
    
    console.log('\n💡 SOLUCIONES SUGERIDAS:');
    console.log('1. Verificar que el servidor esté corriendo: npm start');
    console.log('2. Verificar que el puerto 3000 esté disponible');
    console.log('3. Verificar que el archivo AE exista en:', aepFile);
  }
}

// Ejecutar test
if (require.main === module) {
  testNewEndpoint().then(() => {
    console.log('\n🏁 Test completado');
  }).catch(error => {
    console.error('\n💥 Test falló:', error.message);
  });
}

module.exports = { testNewEndpoint }; 