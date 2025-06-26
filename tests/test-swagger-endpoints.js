#!/usr/bin/env node

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const CLIENT_ID = 'dev-client';
const API_KEY = 'dev-api-key-2024';

const headers = {
  'x-client-id': CLIENT_ID,
  'x-api-key': API_KEY,
  'accept': 'application/json'
};

async function testEndpoint(name, method, endpoint, data = null, isFile = false) {
  console.log(`\n🧪 Testing ${name}...`);
  console.log(`   ${method} ${endpoint}`);
  
  try {
    let response;
    const config = { headers };

    if (method === 'GET') {
      response = await axios.get(`${BASE_URL}${endpoint}`, config);
    } else if (method === 'POST') {
      if (isFile && data) {
        const form = new FormData();
        Object.entries(data).forEach(([key, value]) => {
          if (key === 'file' && fs.existsSync(value)) {
            form.append(key, fs.createReadStream(value));
          } else {
            form.append(key, value);
          }
        });
        
        config.headers = {
          ...config.headers,
          ...form.getHeaders()
        };
        
        response = await axios.post(`${BASE_URL}${endpoint}`, form, config);
      } else {
        response = await axios.post(`${BASE_URL}${endpoint}`, data, config);
      }
    }

    console.log(`   ✅ Status: ${response.status}`);
    
    if (response.data) {
      if (response.data.success !== undefined) {
        console.log(`   📊 Success: ${response.data.success}`);
      }
      
      if (response.data.data) {
        const dataKeys = Object.keys(response.data.data);
        console.log(`   📦 Data keys: ${dataKeys.slice(0, 3).join(', ')}${dataKeys.length > 3 ? '...' : ''}`);
      }
      
      if (response.data.error) {
        console.log(`   ❌ Error: ${response.data.error}`);
      }
    }
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.response?.status || 'No response'}`);
    if (error.response?.data) {
      console.log(`   📝 Error: ${error.response.data.error || error.response.data.message}`);
    } else {
      console.log(`   📝 Error: ${error.message}`);
    }
    return { success: false, error: error.message, status: error.response?.status };
  }
}

async function runTests() {
  console.log('🚀 Testing JSON2VIDEO API Endpoints');
  console.log(`📡 Base URL: ${BASE_URL}`);
  console.log(`🔑 Client ID: ${CLIENT_ID}`);
  console.log(`🗝️  API Key: ${API_KEY.substring(0, 8)}...`);

  const tests = [
    // Basic endpoints
    {
      name: 'Health Check',
      method: 'GET',
      endpoint: '/api/health'
    },
    {
      name: 'API Stats',
      method: 'GET',
      endpoint: '/api/stats'
    },
    {
      name: 'After Effects Expressions',
      method: 'GET',
      endpoint: '/api/aftereffects/expressions'
    },
    // File conversion test (if AEP file exists)
    ...(fs.existsSync('./examples/sample-project.aep') ? [{
      name: 'After Effects Conversion',
      method: 'POST',
      endpoint: '/api/aftereffects/convert',
      data: {
        file: './examples/sample-project.aep',
        templateName: 'Test Template',
        saveTemplate: 'true'
      },
      isFile: true
    }] : [])
  ];

  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(
      test.name,
      test.method,
      test.endpoint,
      test.data,
      test.isFile
    );
    results.push({ ...test, result });
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Test Summary:');
  console.log('================');
  
  const passed = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.result.success)
      .forEach(test => {
        console.log(`   • ${test.name}: ${test.result.error}`);
      });
  }

  console.log('\n🎯 Next Steps for Swagger UI:');
  console.log('=============================');
  console.log('1. 🌐 Open: http://localhost:3000/api-docs');
  console.log('2. 🔐 Click "Authorize" button');
  console.log('3. 📝 Enter API Key: dev-api-key-2024');
  console.log('4. 👤 Add header: x-client-id = dev-client');
  console.log('5. 🎯 Use server: http://localhost:3000');

  return results;
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint }; 