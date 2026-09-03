const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../daemon/index');
const configMod = require('../daemon/config');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tasknav-real-'));
  const sessionsDir = path.join(root, 'sessions');
  const dataDir = path.join(root, 'data');
  const sessionId = 'real-chain-session';
  fs.mkdirSync(sessionsDir, { recursive: true });
  const file = path.join(sessionsDir, `rollout-${sessionId}.jsonl`);
  const rows = [
    line('session_meta', { session_id: sessionId, cwd: 'C:\\demo' }),
    line('event_msg', { type: 'user_message', message: '先建立监控上下文' }),
    line('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '上下文已经建立，等待下一步要求。' }] })
  ];
  fs.writeFileSync(file, rows.join('\n') + '\n', 'utf8');

  const config = configMod.load();
  config.host = '127.0.0.1';
  config.port = 0;
  config.sessionsDir = sessionsDir;
  config.dataDir = dataDir;
  config.dify.mock = false;
  config.dify.fallbackToMock = false;
  const app = createApp(config);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (route, body) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(async response => ({ status: response.status, body: await response.json() }));

  const created = await post('/api/tasks', { session_id: sessionId });
  assert(created.status === 200, 'task bound');
  append(file, '还是不对，请按上一轮真正想要的结果修改', '我完成了修改并测试通过。');
  const evaluated = await post(`/api/tasks/${created.body.task.id}/evaluate`, { transcript_path: file });
  assert(evaluated.status === 200, 'real tn_eval request completed');
  assert(['ok', 'warn', 'completion_doubt'].includes(evaluated.body.task.status), 'new three-state output');
  assert(evaluated.body.task.currentIntent, 'current intent returned');
  assert(evaluated.body.task.suggest, 'copyable wording returned');
  console.log('REAL CHAIN PASS: single tn_eval workflow');
  app.server.close();
  fs.rmSync(root, { recursive: true, force: true });
}

function line(type, payload) { return JSON.stringify({ type, payload }); }
function append(file, user, assistant) {
  fs.appendFileSync(file, [
    line('event_msg', { type: 'user_message', message: user }),
    line('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: assistant }] })
  ].join('\n') + '\n', 'utf8');
}
function assert(condition, label) { if (!condition) throw new Error(`ASSERT FAILED: ${label}`); }
main().catch(err => { console.error(err); process.exit(1); });
