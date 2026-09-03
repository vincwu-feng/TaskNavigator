const http = require('http');

const PORT = Number(process.env.TASKNAV_DAEMON_PORT || 48763);
const HOST = '127.0.0.1';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    payload = {};
  }
  if (process.argv[2] && !payload.session_id) payload.session_id = process.argv[2];

  const body = JSON.stringify({
    session_id: payload.session_id || '',
    transcript_path: payload.transcript_path || '',
    cwd: payload.cwd || ''
  });
  const req = http.request({
    host: HOST,
    port: PORT,
    path: '/api/turn-ended',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    res.resume();
    res.on('end', () => process.exit(0));
  });
  req.setTimeout(4000, () => {
    req.destroy();
    process.exit(0);
  });
  req.on('error', () => process.exit(0));
  req.end(body);
});

setTimeout(() => process.exit(0), 5000).unref();
