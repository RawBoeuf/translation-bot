const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3553';
const TEST_TIMEOUT = 30000;
const PROJECT_ROOT = path.join(__dirname, '..');

function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${endpoint}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(TEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

const tests = {
  async testServerRunning() {
    const res = await makeRequest('/');
    if (res.status !== 200) throw new Error(`Server not running, got status ${res.status}`);
    if (!res.data.includes('Translation Bot Dashboard')) throw new Error('Invalid HTML response');
    console.log('✓ Server is running and serving HTML');
  },

  async testApiStatus() {
    const res = await makeRequest('/api/status');
    if (res.status !== 200) throw new Error(`Status endpoint failed: ${res.status}`);
    if (!res.data.bot) throw new Error('Bot info missing');
    if (typeof res.data.ollama?.available !== 'boolean') throw new Error('Ollama status missing');
    console.log('✓ /api/status endpoint working');
  },

  async testApiStats() {
    const res = await makeRequest('/api/stats');
    if (res.status !== 200) throw new Error(`Stats endpoint failed: ${res.status}`);
    if (typeof res.data.totalTranslations !== 'number') throw new Error('totalTranslations missing');
    if (!res.data.uptime) throw new Error('Uptime missing');
    if (!res.data.memory) throw new Error('Memory stats missing');
    console.log('✓ /api/stats endpoint working');
  },

  async testApiConfig() {
    const res = await makeRequest('/api/config');
    if (res.status !== 200) throw new Error(`Config endpoint failed: ${res.status}`);
    if (!Array.isArray(res.data.channels)) throw new Error('Channels missing');
    if (!Array.isArray(res.data.ignoredUsers)) throw new Error('ignoredUsers missing');
    if (!res.data.allowedRoles) throw new Error('allowedRoles missing');
    console.log('✓ /api/config endpoint working');
  },

  async testApiLogs() {
    const res = await makeRequest('/api/logs');
    if (res.status !== 200) throw new Error(`Logs endpoint failed: ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('Logs not an array');
    console.log('✓ /api/logs endpoint working');
  },

  async testApiHistory() {
    const res = await makeRequest('/api/history');
    if (res.status !== 200) throw new Error(`History endpoint failed: ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('History not an array');
    console.log('✓ /api/history endpoint working');
  },

  async testApiTranslate() {
    const res = await makeRequest('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', language: 'spanish' })
    });
    if (res.status !== 200) throw new Error(`Translate endpoint failed: ${res.status}`);
    if (!res.data.translation) throw new Error('Translation missing');
    console.log('✓ /api/translate endpoint working');
  },

  async testApiModels() {
    const res = await makeRequest('/api/models');
    if (res.status !== 200) throw new Error(`Models endpoint failed: ${res.status}`);
    if (!Array.isArray(res.data.models)) throw new Error('Models not an array');
    console.log('✓ /api/models endpoint working');
  },

  testConfigFile() {
    const configPath = path.join(PROJECT_ROOT, 'translation-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('translation-config.json does not exist');
    }
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (typeof config !== 'object') throw new Error('Invalid config format');
      console.log('✓ Config file exists and is valid JSON');
    } catch (e) {
      throw new Error(`Config file invalid: ${e.message}`);
    }
  },

  testEnvFile() {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (!fs.existsSync(envPath)) {
      console.log('⚠ .env file not found (optional)');
      return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    if (!content.includes('DISCORD_TOKEN=')) {
      throw new Error('DISCORD_TOKEN not found in .env');
    }
    console.log('✓ .env file exists and has required fields');
  },

  testIndexJsSyntax() {
    const indexPath = path.join(PROJECT_ROOT, 'index.js');
    try {
      require(indexPath);
      console.log('✓ index.js has valid syntax');
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        console.log('✓ index.js syntax valid (missing optional deps)');
      } else if (e.message.includes('DISCORD_TOKEN')) {
        console.log('✓ index.js syntax valid (env not set)');
      } else {
        throw e;
      }
    }
  },

  testPublicHtmlExists() {
    const htmlPath = path.join(PROJECT_ROOT, 'public', 'index.html');
    if (!fs.existsSync(htmlPath)) {
      throw new Error('public/index.html does not exist');
    }
    const content = fs.readFileSync(htmlPath, 'utf8');
    if (!content.includes('Translation Bot Dashboard')) {
      throw new Error('HTML missing expected content');
    }
    console.log('✓ public/index.html exists and valid');
  }
};

async function runTests() {
  console.log('========================================');
  console.log('Translation Bot Test Suite');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  for (const [name, testFn] of Object.entries(tests)) {
    try {
      await testFn();
      passed++;
    } catch (e) {
      console.log(`✗ ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
