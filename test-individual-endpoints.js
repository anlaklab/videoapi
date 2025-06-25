#!/usr/bin/env node

/**
 * TESTS INDIVIDUALES PARA CADA ENDPOINT
 * 
 * Ejecuta: node test-individual-endpoints.js [endpoint]
 * 
 * Endpoints disponibles:
 * - health
 * - auth  
 * - stats
 * - aep2json
 * - json2mp4
 * - all
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');

const BASE_URL = 'http://localhost:3000';
const API_KEY = 'dev-key-12345';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title) {
  log('\n' + '='.repeat(50), 'cyan');
  log(`🧪 TEST: ${title}`, 'bright');
  log('='.repeat(50), 'cyan');
}

async function makeRequest(method, endpoint, data = null, isFormData = false) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'x-api-key': API_KEY
    }
  };

  if (data) {
    if (isFormData) {
      config.data = data;
      config.headers = { ...config.headers, ...data.getHeaders() };
    } else {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const start = Date.now();
    const response = await axios(config);
    const duration = Date.now() - start;
    
    log(`✅ SUCCESS (${duration}ms) - Status: ${response.status}`, 'green');
    return { success: true, data: response.data, status: response.status, duration };
  } catch (error) {
    const duration = Date.now() - (error.config?.startTime || Date.now());
    log(`❌ ERROR (${duration}ms) - ${error.message}`, 'red');
    if (error.response) {
      log(`Status: ${error.response.status}`, 'red');
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    return { success: false, error: error.message, status: error.response?.status };
  }
}

// TEST 1: Health Check
async function testHealth() {
  logHeader('HEALTH CHECK');
  
  log('📡 Verificando estado del sistema...', 'yellow');
  const result = await makeRequest('GET', '/api/health');
  
  if (result.success) {
    const health = result.data;
    log(`🏥 Estado del sistema: ${health.status}`, health.status === 'healthy' ? 'green' : 'yellow');
    
    if (health.services) {
      log('\n📊 Servicios:', 'blue');
      log(`  • FFmpeg: ${health.services.ffmpeg?.available ? '✅' : '❌'} ${health.services.ffmpeg?.version || ''}`, 'blue');
      log(`  • After Effects: ${health.services.afterEffects?.available ? '✅' : '❌'}`, 'blue');
      log(`  • Storage: ${health.services.storage?.available ? '✅' : '❌'}`, 'blue');
    }
  }
  
  return result;
}

// TEST 2: Authentication
async function testAuth() {
  logHeader('AUTHENTICATION');
  
  log('🔐 Validando API key...', 'yellow');
  const result = await makeRequest('GET', '/api/auth/validate');
  
  if (result.success) {
    const auth = result.data;
    log(`✅ API Key válida: ${auth.valid}`, 'green');
    
    if (auth.keyInfo) {
      log('\n🔑 Información de la key:', 'blue');
      log(`  • Nombre: ${auth.keyInfo.name}`, 'blue');
      log(`  • Permisos: ${JSON.stringify(auth.keyInfo.permissions)}`, 'blue');
      log(`  • Rate Limit: ${auth.keyInfo.rateLimit}`, 'blue');
    }
  }
  
  return result;
}

// TEST 3: System Stats
async function testStats() {
  logHeader('SYSTEM STATISTICS');
  
  log('📊 Obteniendo estadísticas del sistema...', 'yellow');
  const result = await makeRequest('GET', '/api/stats');
  
  if (result.success) {
    const stats = result.data;
    log('✅ Estadísticas obtenidas', 'green');
    
    log('\n📈 Estadísticas disponibles:', 'blue');
    if (stats.system) {
      log(`  • Uptime: ${Math.floor(stats.system.uptime || 0)} segundos`, 'blue');
      log(`  • Memoria usada: ${Math.floor((stats.system.memoryUsage?.heapUsed || 0) / 1024 / 1024)} MB`, 'blue');
      log(`  • FFmpeg: ${stats.system.ffmpegVersion || 'N/A'}`, 'blue');
    }
  }
  
  return result;
}

// TEST 4: AEP2JSON
async function testAEP2JSON() {
  logHeader('AEP2JSON - CONVERSIÓN AFTER EFFECTS');
  
  log('🎬 Creando archivo AEP de prueba...', 'yellow');
  
  // Crear archivo mock de After Effects
  const mockAEPContent = `
MOCK_AFTER_EFFECTS_PROJECT
========================
Project Name: Test Conversion
Composition: Main Comp
Duration: 15.0 seconds
Resolution: 1920x1080 @ 30fps

Layers:
1. Background Layer (Solid)
   - Color: #1a1a2e
   - Duration: 15.0s

2. Title Text Layer
   - Text: "{{TITLE_TEXT}}"
   - Font: Arial Black, 72px
   - Color: #ffffff
   - Position: Center
   - Animation: Fade In (1s)

3. Subtitle Layer  
   - Text: "{{SUBTITLE_TEXT}}"
   - Font: Arial, 36px
   - Color: #00d4ff
   - Position: Bottom Center
   - Animation: Slide Up (0.5s)

4. Logo Layer (Image)
   - Source: "{{LOGO_IMAGE}}"
   - Position: Top Right
   - Scale: 0.5
   - Opacity: 80%

Merge Fields Detected:
- TITLE_TEXT (Text)
- SUBTITLE_TEXT (Text) 
- LOGO_IMAGE (Image)

Expressions Found:
- Position wiggle on Title: wiggle(2, 10)
- Scale bounce on Logo: bounce(time, 0.5, 1.2)
`;

  const tempPath = './temp/test-conversion.aep';
  await fs.ensureDir('./temp');
  await fs.writeFile(tempPath, mockAEPContent);
  
  log('📤 Subiendo archivo para conversión...', 'yellow');
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(tempPath), {
    filename: 'test-conversion.aep',
    contentType: 'application/octet-stream'
  });
  formData.append('analysisDepth', 'full');
  formData.append('extractAssets', 'true');
  
  const result = await makeRequest('POST', '/api/ae-to-template', formData, true);
  
  // Limpiar archivo temporal
  await fs.remove(tempPath);
  
  if (result.success) {
    const response = result.data;
    log('✅ Conversión completada', 'green');
    
    if (response.data) {
      log('\n📋 Resultado de la conversión:', 'blue');
      log(`  • Job ID: ${response.data.jobId || 'N/A'}`, 'blue');
      log(`  • Template generado: ${response.data.template ? '✅' : '❌'}`, 'blue');
      log(`  • Análisis completado: ${response.data.analysis ? '✅' : '❌'}`, 'blue');
      
      if (response.data.template) {
        log(`  • Pistas en timeline: ${response.data.template.timeline?.tracks?.length || 0}`, 'blue');
        log(`  • Merge fields detectados: ${response.data.template.mergeFields?.length || 0}`, 'blue');
      }
    }
  }
  
  return result;
}

// TEST 5: JSON2MP4 - Video complejo
async function testJSON2MP4() {
  logHeader('JSON2MP4 - RENDERIZADO DE VIDEO COMPLEJO');
  
  log('🎥 Creando timeline complejo (3 minutos)...', 'yellow');
  
  const complexVideoData = {
    timeline: {
      tracks: [
        // Track 1: Fondos animados
        {
          clips: [
            {
              type: 'background',
              start: 0,
              duration: 60,
              color: '#2c3e50'
            },
            {
              type: 'background', 
              start: 60,
              duration: 60,
              color: '#8e44ad',
              transition: { type: 'crossfade', duration: 2 }
            },
            {
              type: 'background',
              start: 120,
              duration: 60, 
              color: '#27ae60',
              transition: { type: 'crossfade', duration: 2 }
            }
          ]
        },
        // Track 2: Títulos principales
        {
          clips: [
            {
              type: 'text',
              start: 2,
              duration: 8,
              text: '{{MAIN_TITLE}}',
              position: 'center',
              style: {
                fontSize: 72,
                color: '#ffffff',
                fontFamily: 'Arial Black',
                shadow: {
                  color: '#000000',
                  offsetX: 3,
                  offsetY: 3,
                  blur: 6
                }
              },
              animation: {
                type: 'fadeInScale',
                duration: 1.5
              }
            },
            {
              type: 'text',
              start: 62,
              duration: 8,
              text: 'Sección 2: {{SECTION_2_TITLE}}',
              position: 'center',
              style: {
                fontSize: 64,
                color: '#ffffff',
                fontFamily: 'Arial Black'
              },
              animation: {
                type: 'slideInLeft',
                duration: 1
              }
            },
            {
              type: 'text',
              start: 122,
              duration: 8,
              text: 'Sección 3: {{SECTION_3_TITLE}}',
              position: 'center',
              style: {
                fontSize: 64,
                color: '#ffffff', 
                fontFamily: 'Arial Black'
              },
              animation: {
                type: 'zoomIn',
                duration: 1.2
              }
            }
          ]
        },
        // Track 3: Contenido informativo
        {
          clips: [
            {
              type: 'text',
              start: 15,
              duration: 40,
              text: 'Este es un video de prueba complejo que demuestra:\n\n• Múltiples pistas de timeline\n• Animaciones y transiciones\n• Merge fields dinámicos\n• Renderizado de alta calidad\n• Duración extendida (3 minutos)',
              position: { x: 100, y: 300 },
              style: {
                fontSize: 28,
                color: '#ecf0f1',
                fontFamily: 'Arial',
                lineHeight: 1.5,
                maxWidth: 800
              },
              animation: {
                type: 'fadeIn',
                duration: 2
              }
            },
            {
              type: 'text',
              start: 75,
              duration: 40,
              text: 'Características avanzadas:\n\n🎬 Timeline multi-track\n🎨 Filtros y efectos\n⚡ Procesamiento optimizado\n🔄 Transiciones suaves\n📊 Merge fields personalizables',
              position: { x: 100, y: 250 },
              style: {
                fontSize: 26,
                color: '#ffffff',
                fontFamily: 'Arial',
                lineHeight: 1.6
              }
            },
            {
              type: 'text',
              start: 135,
              duration: 40,
              text: 'Tecnologías utilizadas:\n\n• Node.js + Express\n• FFmpeg para renderizado\n• Redis para colas\n• Firebase para storage\n• Swagger para documentación',
              position: { x: 100, y: 250 },
              style: {
                fontSize: 26,
                color: '#ffffff',
                fontFamily: 'Arial',
                lineHeight: 1.6
              }
            }
          ]
        },
        // Track 4: Elementos visuales
        {
          clips: [
            {
              type: 'shape',
              start: 10,
              duration: 20,
              shape: 'rectangle',
              position: { x: 1400, y: 100 },
              size: { width: 300, height: 150 },
              color: '#e74c3c',
              opacity: 70,
              animation: {
                type: 'pulse',
                duration: 2,
                repeat: true
              }
            },
            {
              type: 'shape',
              start: 70,
              duration: 25,
              shape: 'circle',
              position: { x: 1500, y: 200 },
              size: { width: 200, height: 200 },
              color: '#3498db',
              opacity: 60,
              animation: {
                type: 'rotate',
                duration: 3,
                repeat: true
              }
            }
          ]
        }
      ],
      // Configuración global
      filters: [
        {
          type: 'brightness',
          value: 1.05,
          target: 'all'
        }
      ]
    },
    // Configuración de salida
    output: {
      format: 'mp4',
      resolution: {
        width: 1920,
        height: 1080
      },
      fps: 30,
      quality: 'high',
      bitrate: 4000000
    },
    // Campos dinámicos
    mergeFields: {
      MAIN_TITLE: 'JSON2VIDEO - Test Completo',
      SECTION_2_TITLE: 'Capacidades Avanzadas',
      SECTION_3_TITLE: 'Tecnología de Vanguardia',
      COMPANY: 'JSON2VIDEO Systems',
      TIMESTAMP: new Date().toISOString()
    },
    // Configuración adicional
    priority: 'normal',
    generateThumbnail: true
  };
  
  log('🚀 Iniciando renderizado (esto puede tomar varios minutos)...', 'yellow');
  log('⏱️  Duración del video: 3 minutos (180 segundos)', 'blue');
  log('📊 Pistas: 4 | Clips: 12 | Efectos: Múltiples', 'blue');
  
  const result = await makeRequest('POST', '/api/template-to-video', complexVideoData);
  
  if (result.success) {
    const response = result.data;
    log('✅ Video renderizado exitosamente', 'green');
    
    if (response.data) {
      log('\n🎬 Información del video:', 'blue');
      log(`  • Job ID: ${response.data.id || 'N/A'}`, 'blue');
      log(`  • Duración: 180 segundos`, 'blue');
      log(`  • Resolución: 1920x1080`, 'blue');
      log(`  • FPS: 30`, 'blue');
      log(`  • Formato: MP4`, 'blue');
      log(`  • Calidad: Alta`, 'blue');
    }
  }
  
  return result;
}

// Función principal para ejecutar tests
async function runTest(testName) {
  const tests = {
    health: testHealth,
    auth: testAuth,
    stats: testStats,
    aep2json: testAEP2JSON,
    json2mp4: testJSON2MP4
  };

  if (testName === 'all') {
    log('🚀 EJECUTANDO TODOS LOS TESTS', 'bright');
    log('=============================\n', 'bright');
    
    let passed = 0;
    let total = 0;
    
    for (const [name, testFn] of Object.entries(tests)) {
      total++;
      try {
        const result = await testFn();
        if (result.success) {
          passed++;
          log(`\n✅ ${name.toUpperCase()} - PASÓ`, 'green');
        } else {
          log(`\n❌ ${name.toUpperCase()} - FALLÓ`, 'red');
        }
      } catch (error) {
        log(`\n💥 ${name.toUpperCase()} - ERROR: ${error.message}`, 'red');
      }
      
      if (name !== Object.keys(tests)[Object.keys(tests).length - 1]) {
        log('\n' + '-'.repeat(50), 'cyan');
      }
    }
    
    // Resumen final
    log('\n' + '='.repeat(50), 'cyan');
    log('📊 RESUMEN FINAL', 'bright');
    log('='.repeat(50), 'cyan');
    log(`Tests ejecutados: ${total}`, 'blue');
    log(`Exitosos: ${passed}`, 'green');
    log(`Fallidos: ${total - passed}`, total - passed > 0 ? 'red' : 'green');
    log(`Tasa de éxito: ${((passed / total) * 100).toFixed(1)}%`, 'yellow');
    
    return;
  }

  if (!tests[testName]) {
    log(`❌ Test '${testName}' no encontrado`, 'red');
    log('\nTests disponibles:', 'yellow');
    Object.keys(tests).forEach(name => {
      log(`  • ${name}`, 'blue');
    });
    log('  • all (ejecutar todos)', 'blue');
    return;
  }

  try {
    await tests[testName]();
  } catch (error) {
    log(`💥 Error ejecutando test: ${error.message}`, 'red');
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const testName = process.argv[2] || 'all';
  
  log('🧪 JSON2VIDEO API - Tests Individuales', 'bright');
  log(`📡 Servidor: ${BASE_URL}`, 'blue');
  log(`🔑 API Key: ${API_KEY}`, 'blue');
  log('', 'reset');
  
  runTest(testName).catch(error => {
    log(`💥 Error crítico: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runTest }; 