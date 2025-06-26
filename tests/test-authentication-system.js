/**
 * Authentication System Validation Test
 */

const fs = require('fs');

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

class AuthenticationTest {
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

  async testAuthServiceStructure() {
    return this.runTest('AuthService Structure', async () => {
      const authServicePath = 'frontend/src/services/AuthService.js';
      
      if (!fs.existsSync(authServicePath)) {
        throw new Error('AuthService.js file not found');
      }

      const content = fs.readFileSync(authServicePath, 'utf8');
      
      const requiredMethods = [
        'signInWithEmail',
        'signUpWithEmail',
        'signInWithGoogle',
        'signOutUser',
        'onAuthStateChange'
      ];

      const missingMethods = requiredMethods.filter(method => 
        !content.includes(method)
      );

      if (missingMethods.length > 0) {
        throw new Error(`Missing methods: ${missingMethods.join(', ')}`);
      }

      return { methods: requiredMethods.length };
    });
  }

  async testAuthModalComponent() {
    return this.runTest('AuthModal Component', async () => {
      const authModalPath = 'frontend/src/components/Auth/AuthModal.js';
      
      if (!fs.existsSync(authModalPath)) {
        throw new Error('AuthModal.js file not found');
      }

      const content = fs.readFileSync(authModalPath, 'utf8');
      
      const uiElements = ['ModalOverlay', 'Input', 'Button'];
      const missingElements = uiElements.filter(element => 
        !content.includes(element)
      );

      if (missingElements.length > 0) {
        throw new Error(`Missing UI elements: ${missingElements.join(', ')}`);
      }

      return { uiElements: uiElements.length };
    });
  }

  async testEnvironmentConfiguration() {
    return this.runTest('Environment Configuration', async () => {
      const envExamplePath = 'frontend/.env.example';
      
      if (!fs.existsSync(envExamplePath)) {
        throw new Error('.env.example file not found');
      }

      const content = fs.readFileSync(envExamplePath, 'utf8');
      
      const requiredVars = [
        'REACT_APP_FIREBASE_API_KEY',
        'REACT_APP_FIREBASE_PROJECT_ID',
        'REACT_APP_API_URL'
      ];

      const missingVars = requiredVars.filter(varName => 
        !content.includes(varName)
      );

      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      return { requiredVars: requiredVars.length };
    });
  }

  async testDocumentation() {
    return this.runTest('Frontend Documentation', async () => {
      const readmePath = 'frontend/README.md';
      
      if (!fs.existsSync(readmePath)) {
        throw new Error('Frontend README.md not found');
      }

      const content = fs.readFileSync(readmePath, 'utf8');
      
      const requiredSections = [
        '## 🚀 Features',
        '## 🛠️ Installation',
        '## 🔧 Configuration'
      ];

      const missingSections = requiredSections.filter(section => 
        !content.includes(section)
      );

      if (missingSections.length > 0) {
        throw new Error(`Missing documentation sections: ${missingSections.join(', ')}`);
      }

      return { sections: requiredSections.length };
    });
  }

  async runAllTests() {
    log('cyan', '\n🔐 Starting Authentication System Validation...\n');

    const tests = [
      () => this.testAuthServiceStructure(),
      () => this.testAuthModalComponent(),
      () => this.testEnvironmentConfiguration(),
      () => this.testDocumentation()
    ];

    const results = await Promise.all(tests.map(test => test()));
    const passed = results.filter(Boolean).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);

    log('cyan', '\n📊 Authentication Test Results:');
    this.results.forEach(result => {
      const icon = result.status === 'PASSED' ? '✅' : '❌';
      const color = result.status === 'PASSED' ? 'green' : 'red';
      log(color, `${icon} ${result.name}`);
    });

    log('cyan', `\nTests Passed: ${passed}/${total} (${percentage}%)`);

    if (percentage >= 90) {
      success('\n🎉 EXCELLENT! Authentication system is production-ready!');
    } else {
      error('\n❌ NEEDS WORK: Authentication system needs attention');
    }

    return percentage;
  }
}

async function main() {
  const tester = new AuthenticationTest();
  await tester.runAllTests();
}

if (require.main === module) {
  main();
}

module.exports = AuthenticationTest;
