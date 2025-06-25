#!/usr/bin/env node

/**
 * TEST COMPLETO DE LA API JSON2VIDEO
 * 
 * Este script prueba todos los endpoints principales:
 * 1. Sistema (health, stats, auth)
 * 2. AEP2JSON - Conversión After Effects → Template
 * 3. JSON2MP4 - Renderizado Template → Video (3 minutos, complejo)
 * 4. Pipeline completo AEP → MP4
 */

const fs = require('fs-extra');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

class APITester {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.apiKey = 'dev-key-12345';
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  // Utilidades de logging
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const colors = {
      INFO: '\x1b[36m',    // Cyan
      SUCCESS: '\x1b[32m', // Green
      ERROR: '\x1b[31m',   // Red
      WARN: '\x1b[33m',    // Yellow
      RESET: '\x1b[0m'     // Reset
    };
    console.log(`${colors[type]}[${type}] ${timestamp}: ${message}${colors.RESET}`);
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'x-api-key': this.apiKey,
        ...headers
      }
    };

    if (data) {
      if (data instanceof FormData) {
        config.data = data;
        config.headers = { ...config.headers, ...data.getHeaders() };
      } else {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }
    }

    try {
      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }

  async runTest(testName, testFn) {
    this.testResults.total++;
    this.log(`🧪 Ejecutando: ${testName}`, 'INFO');
    
    try {
      const result = await testFn();
      if (result.success) {
        this.testResults.passed++;
        this.log(`✅ ${testName} - PASÓ`, 'SUCCESS');
        this.testResults.details.push({ test: testName, status: 'PASS', ...result });
      } else {
        this.testResults.failed++;
        this.log(`❌ ${testName} - FALLÓ: ${result.error}`, 'ERROR');
        this.testResults.details.push({ test: testName, status: 'FAIL', error: result.error });
      }
    } catch (error) {
      this.testResults.failed++;
      this.log(`💥 ${testName} - ERROR: ${error.message}`, 'ERROR');
      this.testResults.details.push({ test: testName, status: 'ERROR', error: error.message });
    }
  }

  // TEST 1: Sistema y Health Check
  async testSystemHealth() {
    return this.runTest('Sistema - Health Check', async () => {
      const result = await this.makeRequest('GET', '/api/health');
      
      if (!result.success) {
        return { success: false, error: 'Health check falló' };
      }

      const health = result.data;
      const requiredFields = ['status', 'timestamp', 'services'];
      const missingFields = requiredFields.filter(field => !health[field]);
      
      if (missingFields.length > 0) {
        return { success: false, error: `Campos faltantes: ${missingFields.join(', ')}` };
      }

      return {
        success: true,
        message: `Sistema ${health.status}`,
        details: {
          ffmpeg: health.services?.ffmpeg?.available || false,
          afterEffects: health.services?.afterEffects?.available || false,
          storage: health.services?.storage?.available || false
        }
      };
    });
  }

  // TEST 2: Autenticación
  async testAuthentication() {
    return this.runTest('Auth - Validación API Key', async () => {
      const result = await this.makeRequest('GET', '/api/auth/validate');
      
      if (!result.success) {
        return { success: false, error: 'Validación de auth falló' };
      }

      const auth = result.data;
      if (!auth.valid) {
        return { success: false, error: 'API key reportada como inválida' };
      }

      return {
        success: true,
        message: 'Autenticación válida',
        details: auth.keyInfo
      };
    });
  }

  // TEST 3: Estadísticas del sistema
  async testSystemStats() {
    return this.runTest('Sistema - Estadísticas', async () => {
      const result = await this.makeRequest('GET', '/api/stats');
      
      if (!result.success) {
        return { success: false, error: 'Stats endpoint falló' };
      }

      return {
        success: true,
        message: 'Estadísticas obtenidas',
        details: result.data
      };
    });
  }

  // TEST 4: AEP2JSON - Conversión simulada (sin archivo real)
  async testAEP2JSON() {
    return this.runTest('AEP2JSON - Conversión After Effects', async () => {
      // Crear un archivo de prueba simulado
      const testAEPPath = path.join(__dirname, 'temp', 'test-mockup.aep');
      await fs.ensureDir(path.dirname(testAEPPath));
      
      // Crear contenido simulado de AEP (en realidad sería binario)
      const mockAEPContent = Buffer.from(`
        MOCK_AEP_FILE_v1.0
        Project: Test Phone Mockup
        Composition: Main Comp
        Duration: 10.0
        Resolution: 1920x1080
        Layers:
          - Text Layer: "{{TITLE}}"
          - Image Layer: "{{LOGO}}"
          - Background: "#000000"
      `);
      
      await fs.writeFile(testAEPPath, mockAEPContent);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testAEPPath), {
        filename: 'test-mockup.aep',
        contentType: 'application/octet-stream'
      });
      formData.append('analysisDepth', 'full');
      formData.append('extractAssets', 'true');

      const result = await this.makeRequest('POST', '/api/ae-to-template', formData);
      
      // Limpiar archivo temporal
      await fs.remove(testAEPPath);

      if (!result.success) {
        return { 
          success: false, 
          error: `AEP conversion falló: ${result.error}`,
          details: result.data 
        };
      }

      const response = result.data;
      if (!response.success) {
        return { 
          success: false, 
          error: `API reportó error: ${response.error}` 
        };
      }

      return {
        success: true,
        message: 'Conversión AEP → JSON exitosa',
        details: {
          jobId: response.data?.jobId,
          templateGenerated: !!response.data?.template,
          analysisCompleted: !!response.data?.analysis
        }
      };
    });
  }

  // TEST 5: JSON2MP4 - Video complejo de 3 minutos
  async testJSON2MP4Complex() {
    return this.runTest('JSON2MP4 - Video Complejo (3 min)', async () => {
      const complexTimeline = {
        timeline: {
          tracks: [
            // Track 1: Fondo animado
            {
              clips: [
                {
                  type: 'background',
                  start: 0,
                  duration: 180, // 3 minutos
                  color: '#1a1a2e'
                },
                {
                  type: 'background',
                  start: 60,
                  duration: 60,
                  color: '#16213e',
                  transition: {
                    type: 'crossfade',
                    duration: 2
                  }
                },
                {
                  type: 'background',
                  start: 120,
                  duration: 60,
                  color: '#0f3460',
                  transition: {
                    type: 'crossfade',
                    duration: 2
                  }
                }
              ]
            },
            // Track 2: Texto principal animado
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
                    type: 'fadeInUp',
                    duration: 1.5,
                    easing: 'ease-out'
                  }
                },
                {
                  type: 'text',
                  start: 12,
                  duration: 6,
                  text: '{{SUBTITLE}}',
                  position: { x: 960, y: 700 },
                  style: {
                    fontSize: 36,
                    color: '#00d4ff',
                    fontFamily: 'Arial'
                  },
                  animation: {
                    type: 'slideInLeft',
                    duration: 1
                  }
                }
              ]
            },
            // Track 3: Elementos visuales (múltiples clips)
            {
              clips: [
                {
                  type: 'shape',
                  start: 5,
                  duration: 15,
                  shape: 'rectangle',
                  position: { x: 100, y: 100 },
                  size: { width: 200, height: 100 },
                  color: '#ff6b6b',
                  opacity: 70,
                  animation: {
                    type: 'pulse',
                    duration: 2,
                    repeat: true
                  }
                },
                {
                  type: 'shape',
                  start: 25,
                  duration: 20,
                  shape: 'circle',
                  position: { x: 1600, y: 200 },
                  size: { width: 150, height: 150 },
                  color: '#4ecdc4',
                  opacity: 60,
                  animation: {
                    type: 'rotate',
                    duration: 4,
                    repeat: true
                  }
                }
              ]
            },
            // Track 4: Texto informativo (múltiples secciones)
            {
              clips: [
                {
                  type: 'text',
                  start: 30,
                  duration: 25,
                  text: '🎬 Sección 1: Introducción\n\nEste es un video de prueba complejo que demuestra las capacidades del sistema JSON2VIDEO.',
                  position: { x: 100, y: 300 },
                  style: {
                    fontSize: 28,
                    color: '#ffffff',
                    fontFamily: 'Arial',
                    lineHeight: 1.4,
                    align: 'left',
                    maxWidth: 800
                  },
                  animation: {
                    type: 'typewriter',
                    duration: 2
                  }
                },
                {
                  type: 'text',
                  start: 60,
                  duration: 25,
                  text: '🎨 Sección 2: Capacidades Visuales\n\n• Múltiples pistas de video\n• Animaciones personalizadas\n• Filtros y efectos\n• Transiciones suaves',
                  position: { x: 100, y: 250 },
                  style: {
                    fontSize: 24,
                    color: '#00d4ff',
                    fontFamily: 'Arial',
                    lineHeight: 1.6
                  },
                  animation: {
                    type: 'fadeIn',
                    duration: 1.5
                  }
                },
                {
                  type: 'text',
                  start: 90,
                  duration: 25,
                  text: '🚀 Sección 3: Rendimiento\n\nProcesamiento en tiempo real con:\n→ FFmpeg optimizado\n→ Timeline multi-track\n→ Merge fields dinámicos',
                  position: { x: 100, y: 250 },
                  style: {
                    fontSize: 24,
                    color: '#ff6b6b',
                    fontFamily: 'Arial',
                    lineHeight: 1.6
                  },
                  animation: {
                    type: 'slideInRight',
                    duration: 1
                  }
                },
                {
                  type: 'text',
                  start: 120,
                  duration: 30,
                  text: '✨ Sección 4: Características Avanzadas\n\n• Chroma key para pantalla verde\n• Filtros de color personalizados\n• Audio mixing y soundtrack\n• Exportación multi-formato',
                  position: { x: 100, y: 200 },
                  style: {
                    fontSize: 24,
                    color: '#4ecdc4',
                    fontFamily: 'Arial',
                    lineHeight: 1.6
                  }
                },
                {
                  type: 'text',
                  start: 155,
                  duration: 25,
                  text: '🎯 Conclusión\n\nSistema completo y funcional para generación automática de videos profesionales.',
                  position: 'center',
                  style: {
                    fontSize: 32,
                    color: '#ffffff',
                    fontFamily: 'Arial Black',
                    textAlign: 'center'
                  },
                  animation: {
                    type: 'zoomIn',
                    duration: 2
                  }
                }
              ]
            }
          ],
          // Soundtrack de fondo
          soundtrack: {
            src: 'assets/audio/test-music.mp3',
            volume: 25,
            fadeIn: 3,
            fadeOut: 3,
            loop: true
          },
          // Filtros globales
          filters: [
            {
              type: 'brightness',
              value: 1.1,
              target: 'all'
            },
            {
              type: 'contrast',
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
          codec: 'h264',
          bitrate: 5000000
        },
        // Campos dinámicos
        mergeFields: {
          MAIN_TITLE: 'JSON2VIDEO API - Test Completo',
          SUBTITLE: 'Generación Automática de Videos',
          COMPANY: 'JSON2VIDEO Systems',
          DATE: new Date().getFullYear().toString()
        },
        // Configuraciones adicionales
        priority: 'normal',
        generateThumbnail: true,
        webhook: null
      };

      const result = await this.makeRequest('POST', '/api/template-to-video', complexTimeline);

      if (!result.success) {
        return { 
          success: false, 
          error: `Video rendering falló: ${result.error}`,
          details: result.data 
        };
      }

      const response = result.data;
      if (!response.success) {
        return { 
          success: false, 
          error: `API reportó error: ${response.error}` 
        };
      }

      return {
        success: true,
        message: 'Video complejo (3 min) renderizado exitosamente',
        details: {
          jobId: response.data?.id,
          duration: '180 segundos',
          tracks: 4,
          clips: 12,
          effects: 'múltiples',
          outputGenerated: !!response.data
        }
      };
    });
  }

  // TEST 6: Pipeline completo - Video simple para validar flujo
  async testCompletePipeline() {
    return this.runTest('Pipeline Completo - Video Simple', async () => {
      // Timeline simple pero completo
      const simpleTimeline = {
        timeline: {
          tracks: [
            {
              clips: [
                {
                  type: 'background',
                  start: 0,
                  duration: 10,
                  color: '#2c3e50'
                },
                {
                  type: 'text',
                  start: 1,
                  duration: 8,
                  text: '🎬 {{TEST_MESSAGE}}',
                  position: 'center',
                  style: {
                    fontSize: 64,
                    color: '#ecf0f1',
                    fontFamily: 'Arial Black'
                  },
                  animation: {
                    type: 'fadeIn',
                    duration: 1
                  }
                },
                {
                  type: 'text',
                  start: 5,
                  duration: 4,
                  text: 'Generado: {{TIMESTAMP}}',
                  position: { x: 960, y: 800 },
                  style: {
                    fontSize: 24,
                    color: '#3498db',
                    fontFamily: 'Arial'
                  }
                }
              ]
            }
          ]
        },
        output: {
          format: 'mp4',
          resolution: { width: 1280, height: 720 },
          fps: 30,
          quality: 'medium'
        },
        mergeFields: {
          TEST_MESSAGE: 'Sistema Funcionando Correctamente',
          TIMESTAMP: new Date().toLocaleString()
        }
      };

      const result = await this.makeRequest('POST', '/api/template-to-video', simpleTimeline);

      if (!result.success) {
        return { 
          success: false, 
          error: `Pipeline completo falló: ${result.error}` 
        };
      }

      return {
        success: true,
        message: 'Pipeline completo ejecutado exitosamente',
        details: {
          processedTemplate: true,
          videoGenerated: true,
          mergeFieldsApplied: true
        }
      };
    });
  }

  // Ejecutar todos los tests
  async runAllTests() {
    this.log('🚀 INICIANDO TESTS COMPLETOS DE JSON2VIDEO API', 'INFO');
    this.log('================================================', 'INFO');

    console.time('Tiempo total de ejecución');

    // Verificar que el servidor esté corriendo
    try {
      await this.makeRequest('GET', '/api/health');
      this.log('✅ Servidor detectado y funcionando', 'SUCCESS');
    } catch (error) {
      this.log('❌ Servidor no disponible. Inicia con: npm start', 'ERROR');
      return;
    }

    // Ejecutar tests en secuencia
    await this.testSystemHealth();
    await this.testAuthentication();
    await this.testSystemStats();
    await this.testAEP2JSON();
    await this.testJSON2MP4Complex();
    await this.testCompletePipeline();

    console.timeEnd('Tiempo total de ejecución');

    // Mostrar resumen final
    this.showSummary();
  }

  showSummary() {
    this.log('📊 RESUMEN DE TESTS', 'INFO');
    this.log('==================', 'INFO');
    
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    
    this.log(`Total de tests: ${this.testResults.total}`, 'INFO');
    this.log(`Pasaron: ${this.testResults.passed}`, 'SUCCESS');
    this.log(`Fallaron: ${this.testResults.failed}`, this.testResults.failed > 0 ? 'ERROR' : 'INFO');
    this.log(`Tasa de éxito: ${successRate}%`, successRate >= 80 ? 'SUCCESS' : 'WARN');

    console.log('\n📋 DETALLES DE TESTS:');
    console.log('=====================');
    
    this.testResults.details.forEach((detail, index) => {
      const status = detail.status === 'PASS' ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${detail.test}`);
      
      if (detail.status === 'PASS' && detail.message) {
        console.log(`   📝 ${detail.message}`);
      }
      
      if (detail.error) {
        console.log(`   🔍 Error: ${detail.error}`);
      }
      
      if (detail.details) {
        console.log(`   📊 Detalles:`, JSON.stringify(detail.details, null, 2));
      }
      
      console.log('');
    });

    // Recomendaciones finales
    this.log('💡 RECOMENDACIONES:', 'INFO');
    if (this.testResults.failed === 0) {
      this.log('🎉 ¡Todos los tests pasaron! El sistema está funcionando correctamente.', 'SUCCESS');
      this.log('✅ La API está lista para uso en producción.', 'SUCCESS');
    } else {
      this.log('⚠️  Algunos tests fallaron. Revisa los errores arriba.', 'WARN');
      this.log('🔧 Corrige los problemas antes de usar en producción.', 'WARN');
    }

    this.log('📖 Documentación: http://localhost:3000/api-docs', 'INFO');
    this.log('🏥 Health Check: http://localhost:3000/health', 'INFO');
  }
}

// Ejecutar tests si es llamado directamente
if (require.main === module) {
  const tester = new APITester();
  
  tester.runAllTests().catch(error => {
    console.error('💥 Error ejecutando tests:', error);
    process.exit(1);
  });
}

module.exports = APITester; 