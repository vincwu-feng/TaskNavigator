const { spawn } = require('child_process');

const REQUEST_TIMEOUT_MS = 7000;

function listThreads(limit = 10) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['app-server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let buffer = '';
    let completed = false;
    let nextId = 1;
    let timer;

    const finish = (err, value) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (!child.killed) child.kill();
      if (err) reject(err);
      else resolve(value);
    };
    const request = (method, params) => {
      const id = nextId++;
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
      return id;
    };

    child.on('error', err => finish(new Error(`Unable to start Codex session service: ${err.message}`)));
    child.on('exit', code => {
      if (!completed && code !== 0) finish(new Error(`Codex session service exited (${code})`));
    });
    child.stderr.on('data', () => {});
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.error) return finish(new Error(message.error.message || 'Codex session service request failed'));
        if (message.id === 1) {
          request('thread/list', { limit: Math.min(50, Math.max(1, limit)), archived: false, sortKey: 'recency_at', sortDirection: 'desc' });
        } else if (message.id === 2) {
          const data = message.result && Array.isArray(message.result.data) ? message.result.data : [];
          return finish(null, data.map(thread => ({
            sessionId: thread.sessionId || thread.id,
            title: thread.name || thread.preview || `会话 ${String(thread.sessionId || thread.id || '').slice(0, 8)}`,
            lastPrompt: thread.name || thread.preview || '',
            latestPrompt: thread.preview || '',
            cwd: thread.cwd || '',
            path: thread.path || '',
            mtime: Number(thread.recencyAt || thread.updatedAt || 0) * 1000,
            source: 'codex_app_server'
          })).filter(thread => thread.sessionId));
        }
      }
    });

    timer = setTimeout(() => finish(new Error('Timed out while reading Codex session titles')), REQUEST_TIMEOUT_MS);
    request('initialize', { clientInfo: { name: 'TaskNavigator', version: '0.2.8' }, capabilities: { experimentalApi: true } });
  });
}

module.exports = { listThreads };
