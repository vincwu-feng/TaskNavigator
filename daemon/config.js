const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');

function defaults() {
  return {
    host: '127.0.0.1',
    port: 48763,
    monitorPollMs: 8000,
    sessionsDir: path.join(os.homedir(), '.codex', 'sessions'),
    codexHome: path.join(os.homedir(), '.codex'),
    claudeHome: path.join(os.homedir(), '.claude'),
    dataDir: path.join(ROOT, 'data'),
    dify: {
      baseUrl: 'http://127.0.0.1:8800',
      apiKeys: { eval: '' },
      mock: true,
      fallbackToMock: true
    }
  };
}

function load() {
  const cfg = defaults();
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const user = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      Object.assign(cfg, user);
      cfg.dify = Object.assign(defaults().dify, user.dify || {});
    } catch (err) {
      console.error('[config] failed to parse config.json, using defaults:', err.message);
    }
  }
  return cfg;
}

module.exports = { load, defaults, ROOT, CONFIG_PATH };
