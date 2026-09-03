const fs = require('fs');
const path = require('path');

function loadThreadNames(codexHome) {
  const map = new Map();
  if (!codexHome) return map;
  const file = path.join(codexHome, 'session_index.jsonl');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return map;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.id && entry.thread_name) map.set(entry.id, entry.thread_name);
    } catch {
      // ignore malformed index lines
    }
  }
  return map;
}

module.exports = { loadThreadNames };
