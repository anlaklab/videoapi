/**
 * JSON2VIDEO Simple API Test
 * 
 * Tests the simplified API with only core rendering functionality
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'dev-key-12345';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY
};

// Test data
const simpleTextVideo = {
  timeline: {
    duration: 5,
    fps: 30,
    resolution: {
      width: 1920,
      height: 1080
    },
    tracks: [
      {
        id: "text-track",
        type: "text",
        clips: [
          {
            type: "text",
            start: 0,
            duration: 5,
            text: "{{title}}",
            position: "center",
            style: {
              fontSize: 72,
              color: "#ffffff",
              fontFamily: "Arial"
            }
          }
        ]
      }
    ]
  },
  output: {
    format: "mp4",
    quality: "medium"
  },
  mergeFields: {
    title: "Hello JSON2VIDEO!"
  }
};

const multimediaVideo = {
  timeline: {
    duration: 10,
    fps: 30,
    resolution: {
      width: 1920,
      height: 1080
    },
    tracks: [
      {
        id: "background",
        type: "video",
        clips: [
          {
            type: "background",
            start: 0,
            duration: 10,
            color: "#1a1a1a"
          }
        ]
      },
      {
        id: "title",
        type: "text",
        clips: [
          {
            type: "text",
            start: 2,
            duration: 6,
            text: "{{message}}",
            position: {
              x: 100,
              y: 500
            },
            style: {
              fontSize: 48,
              color: "#00d4ff"
            }
          }
        ]
      }
    ]
  },
  output: {
    format: "mp4",
    quality: "high"
  },
  mergeFields: {
    message: "Professional Video Content"
  }
};

let testResults = [];

function logTest(name, success, message, data = null) {
  const result = {
    test: name,
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  testResults.push(result);
  
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${name}: ${message}`);
  
  if (data && success) {
    console.log(`   Data:`, JSON.stringify(data, null, 2));
  }
  console.log('');
}

async function testApiEndpoint(url, method = 'GET', data = null, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      headers,
      ...(data && { data })
    };
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      return { success: true, data: response.data };
    } else {
      return { 
        success: false, 
        error: `Expected status ${expectedStatus}, got ${response.status}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

async function runTests() {
  console.log('🧪 Starting JSON2VIDEO Simple API Tests\n');
  console.log('=' .repeat(60));
  
  // Test 1: Health Check
  console.log('📊 Testing Health Check...');
  const healthResult = await testApiEndpoint('/health');
  logTest(
    'Health Check',
    healthResult.success,
    healthResult.success ? 'API is healthy' : healthResult.error,
    healthResult.data
  );

  // Test 2: API Info
  console.log('ℹ️ Testing API Info...');
  const infoResult = await testApiEndpoint('/info');
  logTest(
    'API Information',
    infoResult.success,
    infoResult.success ? 'API info retrieved successfully' : infoResult.error,
    infoResult.data
  );

  // Test 3: Simple Text Video Rendering
  console.log('🎬 Testing Simple Text Video Rendering...');
  const simpleRenderResult = await testApiEndpoint('/render', 'POST', simpleTextVideo);
  logTest(
    'Simple Text Video',
    simpleRenderResult.success,
    simpleRenderResult.success ? 'Video rendered successfully' : simpleRenderResult.error,
    simpleRenderResult.data
  );

  // Test 4: Multimedia Video Rendering
  console.log('🎥 Testing Multimedia Video Rendering...');
  const multimediaRenderResult = await testApiEndpoint('/render', 'POST', multimediaVideo);
  logTest(
    'Multimedia Video',
    multimediaRenderResult.success,
    multimediaRenderResult.success ? 'Complex video rendered successfully' : multimediaRenderResult.error,
    multimediaRenderResult.data
  );

  // Test 5: Authentication (without API key)
  console.log('🔐 Testing Authentication...');
  try {
    await axios.post(`${API_BASE}/render`, simpleTextVideo, {
      headers: { 'Content-Type': 'application/json' } // No API key
    });
    logTest('Authentication Test', false, 'Should have rejected request without API key');
  } catch (error) {
    if (error.response?.status === 401) {
      logTest('Authentication Test', true, 'Correctly rejected unauthorized request');
    } else {
      logTest('Authentication Test', false, `Unexpected error: ${error.message}`);
    }
  }

  // Test 6: Invalid Request (missing timeline)
  console.log('🚫 Testing Invalid Request...');
  const invalidResult = await testApiEndpoint('/render', 'POST', { output: { format: 'mp4' } }, 400);
  logTest(
    'Invalid Request',
    invalidResult.success,
    invalidResult.success ? 'Correctly rejected invalid request' : 'Should have rejected invalid request',
    invalidResult.data
  );

  // Test 7: Non-existent Endpoint
  console.log('🔍 Testing Non-existent Endpoint...');
  const notFoundResult = await testApiEndpoint('/nonexistent', 'GET', null, 404);
  logTest(
    'Non-existent Endpoint',
    notFoundResult.success,
    notFoundResult.success ? 'Correctly returned 404' : 'Should have returned 404',
    notFoundResult.data
  );

  // Summary
  console.log('=' .repeat(60));
  console.log('🎯 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Success Rate: ${successRate}%`);
  
  if (successRate >= 90) {
    console.log('\n🎉 EXCELLENT! The simplified JSON2VIDEO API is working perfectly!');
  } else if (successRate >= 70) {
    console.log('\n👍 GOOD! The API is mostly working with some minor issues.');
  } else {
    console.log('\n⚠️ WARNING! The API has significant issues that need attention.');
  }

  console.log('\n📋 SIMPLIFIED API ENDPOINTS:');
  console.log('   POST /api/render    - Convert JSON to video');
  console.log('   GET  /api/health    - Health check');
  console.log('   GET  /api/info      - API information');
  console.log('   GET  /api-docs      - Swagger documentation');
  
  console.log('\n🔑 API Key: dev-key-12345');
  console.log('📚 Documentation: http://localhost:3000/api-docs');
  
  // Failed tests details
  if (failedTests > 0) {
    console.log('\n❌ FAILED TESTS DETAILS:');
    testResults
      .filter(r => !r.success)
      .forEach(test => {
        console.log(`   • ${test.test}: ${test.message}`);
      });
  }
  
  return { totalTests, passedTests, failedTests, successRate };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests }; 