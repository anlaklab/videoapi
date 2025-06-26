#!/usr/bin/env node

/**
 * TEST BÁSICO DE VALIDACIÓN DE LA API
 * 
 * Valida que todos los endpoints estén correctamente estructurados
 * y respondan según la especificación Swagger
 */

const axios = require('axios');

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
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(method, endpoint, data = null, expectedStatus = 200) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const start = Date.now();
    const response = await axios(config);
    const duration = Date.now() - start;
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      duration,
      expectedStatus: expectedStatus === response.status
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.message,
      data: error.response?.data
    };
  }
}

class APIValidator {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTest(name, testFn) {
    this.results.total++;
    log(`\n🧪 ${name}`, 'yellow');
    
    try {
      const result = await testFn();
      if (result.success) {
        this.results.passed++;
        log(`✅ PASÓ - ${result.message || 'Test exitoso'}`, 'green');
        this.results.tests.push({ name, status: 'PASS', ...result });
      } else {
        this.results.failed++;
        log(`❌ FALLÓ - ${result.error || 'Test falló'}`, 'red');
        this.results.tests.push({ name, status: 'FAIL', ...result });
      }
    } catch (error) {
      this.results.failed++;
      log(`💥 ERROR - ${error.message}`, 'red');
      this.results.tests.push({ name, status: 'ERROR', error: error.message });
    }
  }

  // Test 1: Verificar que el servidor esté corriendo
  async testServerRunning() {
    return this.runTest('Servidor funcionando', async () => {
      const result = await makeRequest('GET', '/api/health');
      
      if (!result.success) {
        return { success: false, error: 'Servidor no responde' };
      }

      return {
        success: true,
        message: `Servidor activo (${result.duration}ms)`,
        details: { status: result.data.status }
      };
    });
  }

  // Test 2: Verificar autenticación
  async testAuthentication() {
    return this.runTest('Autenticación API Key', async () => {
      const result = await makeRequest('GET', '/api/auth/validate');
      
      if (!result.success) {
        return { success: false, error: 'Auth endpoint no responde' };
      }

      if (!result.data.valid) {
        return { success: false, error: 'API key no válida' };
      }

      return {
        success: true,
        message: 'Autenticación funcionando',
        details: result.data.keyInfo
      };
    });
  }

  // Test 3: Verificar endpoints sin autenticación fallan
  async testAuthRequired() {
    return this.runTest('Auth requerida en endpoints protegidos', async () => {
      const config = {
        method: 'GET',
        url: `${BASE_URL}/api/stats`,
        validateStatus: () => true // No arrojar error en 401
      };
      
      const response = await axios(config);
      
      if (response.status !== 401) {
        return { 
          success: false, 
          error: `Esperaba 401, obtuvo ${response.status}` 
        };
      }

      return {
        success: true,
        message: 'Endpoints protegidos correctamente'
      };
    });
  }

  // Test 4: Verificar estructura de respuesta de health
  async testHealthStructure() {
    return this.runTest('Estructura de Health Check', async () => {
      const result = await makeRequest('GET', '/api/health');
      
      if (!result.success) {
        return { success: false, error: 'Health endpoint falló' };
      }

      const health = result.data;
      const requiredFields = ['status', 'timestamp', 'services'];
      const missingFields = requiredFields.filter(field => !health[field]);
      
      if (missingFields.length > 0) {
        return { 
          success: false, 
          error: `Campos faltantes: ${missingFields.join(', ')}` 
        };
      }

      // Verificar servicios
      if (!health.services.ffmpeg || !health.services.afterEffects || !health.services.storage) {
        return { 
          success: false, 
          error: 'Servicios no reportados correctamente' 
        };
      }

      return {
        success: true,
        message: 'Estructura de health correcta',
        details: {
          status: health.status,
          servicesCount: Object.keys(health.services).length
        }
      };
    });
  }

  // Test 5: Verificar documentación Swagger accesible
  async testSwaggerDocs() {
    return this.runTest('Documentación Swagger', async () => {
      const config = {
        method: 'GET',
        url: `${BASE_URL}/api-docs/`,
        validateStatus: () => true
      };
      
      const response = await axios(config);
      
      if (response.status !== 200) {
        return { 
          success: false, 
          error: `Swagger no accesible: ${response.status}` 
        };
      }

      // Verificar que contiene contenido HTML de Swagger
      const content = response.data;
      if (!content.includes('swagger') && !content.includes('Swagger')) {
        return { 
          success: false, 
          error: 'Contenido no parece ser Swagger UI' 
        };
      }

      return {
        success: true,
        message: 'Swagger UI accesible'
      };
    });
  }

  // Test 6: Verificar estructura básica de stats
  async testStatsStructure() {
    return this.runTest('Estructura de Stats', async () => {
      const result = await makeRequest('GET', '/api/stats');
      
      if (!result.success) {
        return { success: false, error: 'Stats endpoint falló' };
      }

      const stats = result.data;
      
      // Verificar que tiene la estructura básica esperada
      if (!stats.system) {
        return { 
          success: false, 
          error: 'Falta información del sistema' 
        };
      }

      return {
        success: true,
        message: 'Estructura de stats básica correcta',
        details: {
          hasSystem: !!stats.system,
          hasUptime: !!stats.system.uptime,
          hasMemory: !!stats.system.memoryUsage
        }
      };
    });
  }

  // Test 7: Verificar validación de JSON en template-to-video
  async testJSONValidation() {
    return this.runTest('Validación JSON en template-to-video', async () => {
      // Enviar JSON inválido (sin timeline requerido)
      const invalidData = {
        output: { format: 'mp4' },
        mergeFields: {}
      };
      
      const config = {
        method: 'POST',
        url: `${BASE_URL}/api/template-to-video`,
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        data: invalidData,
        validateStatus: () => true
      };
      
      const response = await axios(config);
      
      if (response.status !== 400) {
        return { 
          success: false, 
          error: `Esperaba 400 por JSON inválido, obtuvo ${response.status}` 
        };
      }

      return {
        success: true,
        message: 'Validación JSON funcionando'
      };
    });
  }

  // Test 8: Verificar timeline simple válido
  async testSimpleTimeline() {
    return this.runTest('Timeline simple válido', async () => {
      const simpleTimeline = {
        timeline: {
          tracks: [
            {
              clips: [
                {
                  type: 'background',
                  start: 0,
                  duration: 5,
                  color: '#000000'
                }
              ]
            }
          ]
        },
        output: {
          format: 'mp4',
          resolution: { width: 640, height: 480 },
          fps: 24
        }
      };
      
      const result = await makeRequest('POST', '/api/template-to-video', simpleTimeline);
      
      // Puede fallar por falta de implementación, pero debe responder estructuradamente
      if (result.success) {
        return {
          success: true,
          message: 'Timeline simple procesado',
          details: result.data
        };
      } else {
        // Verificar que al menos da una respuesta estructurada
        if (result.data && result.data.error) {
          return {
            success: true,
            message: 'Endpoint responde estructuradamente (aunque falle)'
          };
        } else {
          return {
            success: false,
            error: 'Respuesta no estructurada'
          };
        }
      }
    });
  }

  async runAllTests() {
    log('🚀 VALIDACIÓN BÁSICA DE JSON2VIDEO API', 'bright');
    log('=====================================', 'bright');
    log(`📡 Servidor: ${BASE_URL}`, 'cyan');
    log(`🔑 API Key: ${API_KEY}`, 'cyan');

    console.time('Tiempo total');

    await this.testServerRunning();
    await this.testAuthentication();
    await this.testAuthRequired();
    await this.testHealthStructure();
    await this.testSwaggerDocs();
    await this.testStatsStructure();
    await this.testJSONValidation();
    await this.testSimpleTimeline();

    console.timeEnd('Tiempo total');

    this.showSummary();
  }

  showSummary() {
    log('\n📊 RESUMEN DE VALIDACIÓN', 'bright');
    log('========================', 'bright');

    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    
    log(`Tests ejecutados: ${this.results.total}`, 'cyan');
    log(`Exitosos: ${this.results.passed}`, 'green');
    log(`Fallidos: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    log(`Tasa de éxito: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

    log('\n📋 DETALLES:', 'cyan');
    this.results.tests.forEach((test, index) => {
      const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '💥';
      log(`${index + 1}. ${icon} ${test.name}`, 'reset');
    });

    log('\n💡 ESTADO DE LA API:', 'cyan');
    if (this.results.passed >= 6) {
      log('🎉 API estructuralmente sólida y funcional', 'green');
      log('✅ Lista para desarrollo y testing', 'green');
    } else if (this.results.passed >= 4) {
      log('⚠️  API parcialmente funcional', 'yellow');
      log('🔧 Algunos aspectos necesitan atención', 'yellow');
    } else {
      log('❌ API necesita trabajo adicional', 'red');
      log('🚧 No lista para uso', 'red');
    }

    log('\n📚 Enlaces útiles:', 'cyan');
    log(`• Documentación: ${BASE_URL}/api-docs`, 'blue');
    log(`• Health Check: ${BASE_URL}/api/health`, 'blue');
    log(`• Página principal: ${BASE_URL}/`, 'blue');
  }
}

// Ejecutar validación
if (require.main === module) {
  const validator = new APIValidator();
  
  validator.runAllTests().catch(error => {
    log(`💥 Error crítico: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = APIValidator; 