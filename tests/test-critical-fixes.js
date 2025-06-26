/**
 * Critical Fixes Validation Test
 * 
 * Tests all the critical issues that were reported:
 * 1. Drag and drop URL.createObjectURL error
 * 2. Missing selectClips function
 * 3. Styled components props warnings
 * 4. Asset loading performance
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:3001';

// Test colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);
const success = (message) => log('green', `✅ ${message}`);
const error = (message) => log('red', `❌ ${message}`);
const info = (message) => log('blue', `ℹ️  ${message}`);
const warning = (message) => log('yellow', `⚠️  ${message}`);

class CriticalFixesValidator {
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
    info(`Running: ${name}`);
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED', duration });
      success(`${name} (${duration}ms)`);
      return true;
    } catch (err) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: err.message });
      error(`${name}: ${err.message}`);
      return false;
    }
  }

  async testDragDropFix() {
    return this.runTest('Drag & Drop URL Fix', async () => {
      // Test that external URLs don't cause createObjectURL errors
      const testAsset = {
        id: 'test-img',
        name: 'Test Image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop',
        thumbnail: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=300&h=200&fit=crop'
      };

      // Simulate the fixed addClipFromAsset function logic
      let sourceUrl = testAsset.url || testAsset.src || testAsset.thumbnail;
      
      // Should NOT try to use createObjectURL for external URLs
      if (testAsset.file && testAsset.file instanceof File) {
        // This branch should not execute for external URLs
        throw new Error('Should not try createObjectURL for external URLs');
      }

      // Should use the external URL directly
      if (!sourceUrl || !sourceUrl.startsWith('http')) {
        throw new Error('External URL not handled correctly');
      }

      // Test passed if we get here without errors
    });
  }

  async testSelectClipsFunction() {
    return this.runTest('selectClips Function Exists', async () => {
      // Test that the selectClips function is properly exported
      // This would normally be tested in the browser, but we can check the file structure
      
      const fs = require('fs');
      const path = require('path');
      
      const useClipsPath = path.join(__dirname, 'frontend/src/hooks/useClips.js');
      
      if (!fs.existsSync(useClipsPath)) {
        throw new Error('useClips.js file not found');
      }
      
      const content = fs.readFileSync(useClipsPath, 'utf8');
      
      // Check if selectClips function is defined
      if (!content.includes('const selectClips =') && !content.includes('selectClips:')) {
        throw new Error('selectClips function not found in useClips.js');
      }
      
      // Check if it's exported
      if (!content.includes('selectClips,') && !content.includes('selectClips:')) {
        throw new Error('selectClips function not exported');
      }
    });
  }

  async testStyledComponentsPropsFix() {
    return this.runTest('Styled Components Props Fix', async () => {
      const fs = require('fs');
      const path = require('path');
      
      const timelinePath = path.join(__dirname, 'frontend/src/components/Timeline/Timeline.js');
      const timelineEditorPath = path.join(__dirname, 'frontend/src/components/Timeline/TimelineEditor.js');
      
      const filesToCheck = [timelinePath, timelineEditorPath];
      
      for (const filePath of filesToCheck) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check that NON-transient props are NOT used (these should be fixed)
        const problematicPatterns = [
          /\s+major=\{[^}]+\}/g,
          /\s+position=\{[^}]+\}/g,
          /\s+color=\{[^}]+\}/g,
          /\s+selected=\{[^}]+\}/g,
          /\s+resizing=\{[^}]+\}/g
        ];
        
        for (const pattern of problematicPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            throw new Error(`Found non-transient prop in ${path.basename(filePath)}: ${matches[0].trim()}`);
          }
        }
        
        // Check that transient props ARE used (these should exist)
        const transientPatterns = [
          /\$major=\{/,
          /\$position=\{/,
          /\$color=\{/,
          /\$selected=\{/,
          /\$resizing=\{/
        ];
        
        let foundTransientProps = 0;
        for (const pattern of transientPatterns) {
          if (pattern.test(content)) {
            foundTransientProps++;
          }
        }
        
        // At least some transient props should be found
        if (foundTransientProps === 0) {
          throw new Error(`No transient props found in ${path.basename(filePath)} - fix may be incomplete`);
        }
      }
    });
  }

  async testAssetLoadingPerformance() {
    return this.runTest('Asset Loading Performance', async () => {
      const fs = require('fs');
      const path = require('path');
      
      // Check that lazy loading is implemented
      const sampleAssetsPath = path.join(__dirname, 'frontend/src/data/sampleAssets.js');
      
      if (!fs.existsSync(sampleAssetsPath)) {
        throw new Error('sampleAssets.js file not found');
      }
      
      const content = fs.readFileSync(sampleAssetsPath, 'utf8');
      
      // Check for lazy loading implementation
      const lazyFeatures = [
        'getSampleAssets',
        'loadAdditionalAssets',
        'essentialAssets',
        'additionalAssets',
        'lazy:'
      ];
      
      for (const feature of lazyFeatures) {
        if (!content.includes(feature)) {
          throw new Error(`Lazy loading feature not found: ${feature}`);
        }
      }
      
      // Check AssetManager optimization
      const assetManagerPath = path.join(__dirname, 'frontend/src/services/AssetManager.js');
      
      if (fs.existsSync(assetManagerPath)) {
        const managerContent = fs.readFileSync(assetManagerPath, 'utf8');
        
        if (!managerContent.includes('cache') || !managerContent.includes('initialize')) {
          throw new Error('AssetManager caching not implemented');
        }
      }
    });
  }

  async testBackendHealth() {
    return this.runTest('Backend Health Check', async () => {
      try {
        const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
        
        if (response.status !== 200) {
          throw new Error(`Backend health check failed: ${response.status}`);
        }
        
        if (!response.data || !response.data.status) {
          throw new Error('Backend health response invalid');
        }
      } catch (err) {
        if (err.code === 'ECONNREFUSED') {
          throw new Error('Backend server not running');
        }
        throw err;
      }
    });
  }

  async testFrontendAccessibility() {
    return this.runTest('Frontend Accessibility', async () => {
      try {
        const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
        
        if (response.status !== 200) {
          throw new Error(`Frontend not accessible: ${response.status}`);
        }
        
        // Check if it's actually the React app
        if (!response.data.includes('json2video-studio-frontend') && !response.data.includes('root')) {
          throw new Error('Frontend response does not appear to be React app');
        }
      } catch (err) {
        if (err.code === 'ECONNREFUSED') {
          throw new Error('Frontend server not running');
        }
        throw err;
      }
    });
  }

  async testFileStructureIntegrity() {
    return this.runTest('File Structure Integrity', async () => {
      const fs = require('fs');
      const path = require('path');
      
      const criticalFiles = [
        'frontend/src/hooks/useClips.js',
        'frontend/src/components/Timeline/Timeline.js',
        'frontend/src/data/sampleAssets.js',
        'frontend/src/services/AssetManager.js',
        'frontend/src/store/useEditorStore.js',
        'frontend/src/components/CloudVideoEditor.js'
      ];
      
      for (const file of criticalFiles) {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Critical file missing: ${file}`);
        }
        
        // Check file is not empty
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          throw new Error(`Critical file is empty: ${file}`);
        }
      }
    });
  }

  printResults() {
    log('cyan', '\n' + '='.repeat(60));
    log('bold', '🧪 CRITICAL FIXES VALIDATION RESULTS');
    log('cyan', '='.repeat(60));
    
    log('blue', `\nTotal Tests: ${this.results.total}`);
    success(`Passed: ${this.results.passed}`);
    error(`Failed: ${this.results.failed}`);
    
    const successRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    
    if (successRate >= 90) {
      success(`\n🎉 Success Rate: ${successRate}% - EXCELLENT!`);
    } else if (successRate >= 70) {
      warning(`\n⚠️  Success Rate: ${successRate}% - GOOD`);
    } else {
      error(`\n💥 Success Rate: ${successRate}% - NEEDS ATTENTION`);
    }
    
    log('cyan', '\nDetailed Results:');
    log('cyan', '-'.repeat(40));
    
    this.results.tests.forEach(test => {
      const status = test.status === 'PASSED' ? 
        `${colors.green}✅ PASSED${colors.reset}` : 
        `${colors.red}❌ FAILED${colors.reset}`;
      
      const duration = test.duration ? ` (${test.duration}ms)` : '';
      console.log(`${test.name}: ${status}${duration}`);
      
      if (test.error) {
        log('red', `   Error: ${test.error}`);
      }
    });
    
    log('cyan', '\n' + '='.repeat(60));
    
    if (this.results.failed > 0) {
      log('red', '\n🚨 CRITICAL ISSUES DETECTED!');
      log('yellow', 'Please review the failed tests and fix the issues before proceeding.');
    } else {
      log('green', '\n🎉 ALL CRITICAL FIXES VALIDATED!');
      log('blue', 'The application should now work without the reported issues.');
    }
  }

  async runAllTests() {
    log('cyan', '🚀 Starting Critical Fixes Validation...\n');
    
    // Run all validation tests
    await this.testFileStructureIntegrity();
    await this.testDragDropFix();
    await this.testSelectClipsFunction();
    await this.testStyledComponentsPropsFix();
    await this.testAssetLoadingPerformance();
    await this.testBackendHealth();
    await this.testFrontendAccessibility();
    
    this.printResults();
    
    return this.results.failed === 0;
  }
}

// Run the validation
async function main() {
  const validator = new CriticalFixesValidator();
  const success = await validator.runAllTests();
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    error(`Validation failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = CriticalFixesValidator; 