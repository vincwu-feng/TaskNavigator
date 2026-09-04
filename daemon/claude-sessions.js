const fs = require('fs');
const path = require('path');

function decodeProjectDir(dirName) {
  const value = String(dirName || '').replace(/^[g-z]--/, match => `${match[0].toUpperCase()}:\\`).replace(/-/g, '\\');
  return value;
}

function readSessionMeta(filePath) {
  let title = '';
  let sessionId = '';
  let cwd = '';
  let firstPrompt = '';
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
    const head = lines.slice(0, 20);
    const tail = lines.slice(-40);
    for (const line of head) {
      try {
        const obj = JSON.parse(line);
        if (!obj) continue;
        if (obj.sessionId && !sessionId) sessionId = obj.sessionId;
        if (obj.cwd && !cwd) cwd = obj.cwd;
        if (obj.type === 'user' && obj.message && Array.isArray(obj.message.content)) {
          const text = obj.message.content.filter(c => c && c.type === 'text' && c.text).map(c => c.text).join(' ');
          if (text && !firstPrompt) firstPrompt = text.trim().slice(0, 120);
        }
      } catch {
        // skip malformed lines
      }
    }
    for (const line of tail) {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.type === 'ai-title' && obj.aiTitle) title = obj.aiTitle;
        if (obj && obj.sessionId && !sessionId) sessionId = obj.sessionId;
        if (obj && obj.cwd && !cwd) cwd = obj.cwd;
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // unreadable file
  }
  return { sessionId, cwd, title, firstPrompt };
}

function listSessions(claudeHome, limit = 10) {
  const sessions = [];
  const seen = new Set();
  if (!claudeHome || !fs.existsSync(claudeHome)) return sessions;

  const activeDir = path.join(claudeHome, 'sessions');
  try {
    for (const file of fs.readdirSync(activeDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(activeDir, file), 'utf8'));
        if (!meta.sessionId || seen.has(meta.sessionId)) continue;
        seen.add(meta.sessionId);
        sessions.push({
          sessionId: meta.sessionId,
          cwd: meta.cwd || '',
          title: meta.name || 'Claude Code 会话',
          mtime: Number(meta.startedAt || 0),
          active: true,
          source: 'claude'
        });
      } catch {
        // unreadable active-session metadata
      }
    }
  } catch {
    // no active-session directory
  }

  const projectsDir = path.join(claudeHome, 'projects');
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.jsonl')) continue;
      const sessionId = entry.name.replace(/\.jsonl$/, '');
      if (seen.has(sessionId)) continue;
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      const meta = readSessionMeta(full);
      const id = meta.sessionId || sessionId;
      if (seen.has(id)) continue;
      seen.add(id);
      sessions.push({
        sessionId: id,
        cwd: meta.cwd || decodeProjectDir(dir),
        title: meta.title || meta.firstPrompt || 'Claude Code 会话',
        mtime: stat.mtimeMs,
        active: false,
        source: 'claude'
      });
    }
  };
  walk(projectsDir);

  sessions.sort((a, b) => b.mtime - a.mtime);
  return sessions.slice(0, limit);
}

function findTranscript(claudeHome, sessionId) {
  if (!claudeHome || !sessionId || !fs.existsSync(claudeHome)) return null;
  const projectsDir = path.join(claudeHome, 'projects');
  let best = null;
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === `${sessionId}.jsonl`) {
        try {
          const stat = fs.statSync(full);
          if (!best || stat.mtimeMs > best.mtimeMs) best = { path: full, mtimeMs: stat.mtimeMs, size: stat.size };
        } catch {
          // unreadable
        }
      }
    }
  };
  walk(projectsDir);
  return best;
}

function parseTranscript(filePath) {
  const userMessages = [];
  const assistantMessages = [];
  const toolCalls = [];
  const toolOutputs = [];
  const turns = [];
  let sessionId = '';
  let cwd = '';
  let title = '';
  if (!fs.existsSync(filePath)) return { sessionId, cwd, title, userMessages, assistantMessages, toolCalls, toolOutputs, turns };

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  let currentTurn = null;
  const finishTurn = (endLine, allowFinal) => {
    if (!currentTurn) return;
    currentTurn.end_line = endLine;
    const last = currentTurn.assistant_messages[currentTurn.assistant_messages.length - 1] || '';
    currentTurn.assistant_final = allowFinal ? last : '';
    currentTurn.complete = Boolean(currentTurn.assistant_final);
    turns.push(currentTurn);
    currentTurn = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;
    if (obj.sessionId && !sessionId) sessionId = obj.sessionId;
    if (obj.cwd && !cwd) cwd = obj.cwd;
    if (obj.type === 'ai-title' && obj.aiTitle) title = obj.aiTitle;

    if (obj.type === 'user' && obj.message && Array.isArray(obj.message.content)) {
      const content = obj.message.content;
      const isToolResult = content.some(c => c && (c.type === 'tool_result' || c.tool_use_id));
      if (isToolResult) {
        for (const block of content) {
          if (!block || block.type !== 'tool_result') continue;
          const raw = typeof block.content === 'string' ? block.content : JSON.stringify(block.content || '');
          const output = { call_id: String(block.tool_use_id || ''), output: String(raw).slice(0, 4000) };
          toolOutputs.push(output);
          if (currentTurn) currentTurn.tool_outputs.push(output);
        }
        continue;
      }
      const text = content.filter(c => c && c.type === 'text' && c.text).map(c => c.text).join('\n').trim();
      if (!text) continue;
      if (obj.origin && obj.origin.kind && obj.origin.kind !== 'human') continue;
      finishTurn(i, true);
      userMessages.push(text);
      currentTurn = {
        id: '',
        start_line: i + 1,
        end_line: i + 1,
        user_prompt: text,
        assistant_messages: [],
        assistant_ended: false,
        assistant_final: '',
        tool_calls: [],
        tool_outputs: [],
        complete: false
      };
      continue;
    }

    if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
      const content = obj.message.content;
      const text = content.filter(c => c && c.type === 'text' && c.text).map(c => c.text).join('\n').trim();
      if (text) {
        assistantMessages.push(text);
        if (currentTurn) currentTurn.assistant_messages.push(text);
      }
      for (const block of content) {
        if (!block || block.type !== 'tool_use') continue;
        const args = typeof block.input === 'object' && block.input !== null
          ? JSON.stringify(block.input)
          : String(block.input || '');
        const call = { name: block.name || '', arguments: args, call_id: block.id || '', id: block.id || '' };
        toolCalls.push(call);
        if (currentTurn) currentTurn.tool_calls.push(call);
      }
      if (obj.stop_reason && obj.stop_reason !== 'tool_use') {
        if (currentTurn) currentTurn.assistant_ended = true;
        finishTurn(i, true);
      }
    }
  }
  finishTurn(lines.length, false);
  turns.forEach(turn => { turn.id = `${sessionId || 'session'}:${turn.start_line}`; });
  return { sessionId, cwd, title, userMessages, assistantMessages, toolCalls, toolOutputs, turns };
}

module.exports = { listSessions, findTranscript, parseTranscript, readSessionMeta, decodeProjectDir };
