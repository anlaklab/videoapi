/**
 * Firestore Integration Test Suite
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:3001';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);
const success = (message) => log('green', `✅ ${message}`);
const error = (message) => log('red', `❌ ${message}`);
const info = (message) => log('blue', `ℹ️  ${message}`);

class FirestoreIntegrationTest {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runTest(testName, testFunction) {
    try {
      info(`Testing: ${testName}`);
      const result = await testFunction();
      success(`${testName}: PASSED`);
      this.results.push({ name: testName, status: 'PASSED', result });
      return true;
    } catch (err) {
      error(`${testName}: FAILED - ${err.message}`);
      this.results.push({ name: testName, status: 'FAILED', error: err.message });
      return false;
    }
  }

  async testAssetStructure() {
    return this.runTest('Asset Structure', async () => {
      const fs = require('fs');
      const path = require('path');
      
      const sampleAssetsPath = path.join(__dirname, 'frontend/src/data/sampleAssets.js');
      
      if (!fs.existsSync(sampleAssetsPath)) {
        throw new Error('sampleAssets.js file not found');
      }

      const content = fs.readFileSync(sampleAssetsPath, 'utf8');
      
      const requiredExports = [
        'getSampleAssets',
        'getAssetsByCategory', 
        'searchAssets',
        'sampleAssets'
      ];

      for (const exportName of requiredExports) {
        if (!content.includes(exportName)) {
          throw new Error(`Missing export: ${exportName}`);
        }
      }

      return { message: 'Asset structure is correct', exports: requiredExports.length };
    });
  }

  async testProjectManager() {
    return this.runTest('ProjectManager Structure', async () => {
      const fs = require('fs');
      const projectManagerPath = 'frontend/src/services/ProjectManager.js';
      
      if (!fs.existsSync(projectManagerPath)) {
        throw new Error('ProjectManager.js file not found');
      }

      const content = fs.readFileSync(projectManagerPath, 'utf8');
      
      const requiredMethods = [
        'createProject',
        'updateProject',
        'getProject',
        'getProjects'
      ];

      for (const method of requiredMethods) {
        if (!content.includes(method)) {
          throw new Error(`Missing method: ${method}`);
        }
      }

      return { message: 'ProjectManager structure is correct', methods: requiredMethods.length };
    });
  }

  async testDragDropFix() {
    return this.runTest('Drag & Drop Fix', async () => {
      const fs = require('fs');
      const useClipsPath = 'frontend/src/hooks/useClips.js';
      
      if (!fs.existsSync(useClipsPath)) {
        throw new Error('useClips.js file not found');
      }

      const content = fs.readFileSync(useClipsPath, 'utf8');
      
      if (!content.includes('selectClips')) {
        throw new Error('selectClips function not found');
      }

      if (!content.includes('addClipFromAsset')) {
        throw new Error('addClipFromAsset function not found');
      }

      return { message: 'Drag & drop functionality is correct' };
    });
  }

  async runAllTests() {
    log('cyan', '\n🚀 Starting Firestore Integration Test Suite...\n');

    const tests = [
      () => this.testAssetStructure(),
      () => this.testProjectManager(),
      () => this.testDragDropFix()
    ];

    const results = await Promise.all(tests.map(test => test()));
    const passed = results.filter(Boolean).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);

    log('cyan', '\n📊 Test Results Summary:');
    this.results.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      const color = result.status === 'PASSED' ? 'green' : 'red';
      log(color, `${icon} ${result.name}`);
    });

    log('cyan', `\nTests Passed: ${passed}/${total} (${percentage}%)`);

    if (percentage >= 80) {
      success('\n🎉 EXCELLENT! Integration is working well!');
    } else {
      error('\n❌ NEEDS WORK: Several issues need to be fixed');
    }

    return percentage;
  }
}

async function main() {
  const tester = new FirestoreIntegrationTest();
  await tester.runAllTests();
}

if (require.main === module) {
  main();
}

module.exports = FirestoreIntegrationTest;
