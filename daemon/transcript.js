const fs = require('fs');
const path = require('path');

const CONTEXT_MARKERS = [
  '<environment_context>',
  '<permissions',
  '<apps_instructions>',
  '<model_switch>',
  '<recommended_plugins>',
  '<skills_instructions>',
  '<collaboration_mode>',
  '<plugins_instructions>',
  '<filesystem',
  'Approved command prefixes'
];

const SYSTEM_USER_MARKERS = [
  'The user interrupted the previous turn',
  'The conversation was compacted',
  'Previous conversation summary',
  'Continue from where you left off',
  'as a continuation',
  'The user has requested that I continue'
];

function isContextText(text) {
  return CONTEXT_MARKERS.some(m => text.includes(m)) || SYSTEM_USER_MARKERS.some(m => text.includes(m));
}

function contentText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter(c => c && (c.type === 'input_text' || c.type === 'output_text'))
    .map(c => c.text || '')
    .join('\n');
}

function parseTranscript(filePath) {
  const userMessages = [];
  const assistantMessages = [];
  const toolCalls = [];
  const toolOutputs = [];
  const turns = [];
  let currentTurn = null;
  let sessionId = '';
  let cwd = '';
  let title = '';
  if (!fs.existsSync(filePath)) return { sessionId, cwd, title, userMessages, assistantMessages, toolCalls, toolOutputs, turns };

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const finishTurn = (endLine, opts = {}) => {
    if (!currentTurn) return;
    currentTurn.end_line = endLine;
    const phasedFinal = currentTurn.final_messages[currentTurn.final_messages.length - 1] || '';
    const legacyFinal = currentTurn.legacy_messages[currentTurn.legacy_messages.length - 1] || '';
    // Closure rules for the three ways a turn can end:
    // - next user message: the round is over, so the last assistant message
    //   (phase-less or not) is the final answer of that round;
    // - task_complete: the run finished, use its last_agent_message when the
    //   transcript does not tag phases;
    // - end of file: the model may still be working, so phase-less commentary
    //   must never be mistaken for the completed answer.
    currentTurn.assistant_final = phasedFinal
      || (opts.closedByTaskComplete ? (opts.lastAgentMessage || legacyFinal) : '')
      || (opts.closedByNextUser ? legacyFinal : '');
    currentTurn.complete = Boolean(currentTurn.assistant_final);
    delete currentTurn.final_messages;
    delete currentTurn.legacy_messages;
    turns.push(currentTurn);
    currentTurn = null;
  };
  // A round starts at the user's message. Codex records that message either as
  // an `event_msg/user_message` event (transcripts up to 2026-08) or only as a
  // `response_item/message` with role=user (2026-09 and later). Both shapes must
  // be able to open a turn, and transcripts carrying both must not double count.
  const startTurn = (lineIndex, rawText) => {
    const text = String(rawText || '').trim();
    const clean = coreUserMessage(text);
    if (!clean || isContextText(text)) return;
    if (currentTurn
      && currentTurn.user_prompt === clean
      && !currentTurn.assistant_messages.length
      && !currentTurn.tool_calls.length) {
      // The same prompt written in both shapes: keep the already open turn.
      return;
    }
    finishTurn(lineIndex, { closedByNextUser: true });
    userMessages.push(clean);
    currentTurn = {
      id: '',
      start_line: lineIndex + 1,
      end_line: lineIndex + 1,
      user_prompt: clean,
      assistant_messages: [],
      final_messages: [],
      legacy_messages: [],
      assistant_final: '',
      tool_calls: [],
      tool_outputs: [],
      complete: false
    };
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const p = obj.payload || {};
    if (obj.type === 'session_meta') {
      sessionId = p.session_id || sessionId;
      cwd = p.cwd || cwd;
      title = p.title || p.thread_title || title;
      continue;
    }
    if (obj.type === 'event_msg' && p.type === 'user_message') {
      startTurn(lineIndex, String(p.message || ''));
      continue;
    }
    if (obj.type === 'event_msg' && p.type === 'task_complete') {
      finishTurn(lineIndex + 1, {
        closedByTaskComplete: true,
        lastAgentMessage: p.last_agent_message
      });
      continue;
    }
    if (obj.type !== 'response_item') continue;
    if (p.type === 'message') {
      const text = contentText(p.content).trim();
      if (!text) continue;
      if (p.role === 'user') {
        startTurn(lineIndex, text);
      } else if (p.role === 'assistant') {
        if (currentTurn) currentTurn.assistant_messages.push(text);
        if (p.phase === 'final_answer') {
          assistantMessages.push(text);
          if (currentTurn) currentTurn.final_messages.push(text);
        } else if (!p.phase) {
          // Older Codex transcripts did not label assistant phases. Keep the
          // message as a legacy final candidate, while never treating a
          // phase=commentary progress update as the completed answer.
          assistantMessages.push(text);
          if (currentTurn) currentTurn.legacy_messages.push(text);
        }
      }
    } else if (p.type === 'function_call' || p.type === 'custom_tool_call') {
      let args = '';
      const rawArgs = p.type === 'custom_tool_call' ? p.input : p.arguments;
      if (typeof rawArgs === 'object' && rawArgs !== null) {
        args = JSON.stringify(rawArgs);
      } else {
        try {
          args = JSON.stringify(JSON.parse(rawArgs || '{}'));
        } catch {
          args = String(rawArgs || '');
        }
      }
      const call = { name: p.name, arguments: args, call_id: p.call_id || p.id || '', id: p.id };
      toolCalls.push(call);
      if (currentTurn) currentTurn.tool_calls.push(call);
    } else if (p.type === 'function_call_output' || p.type === 'custom_tool_call_output') {
      const rawOutput = typeof p.output === 'string' ? p.output : JSON.stringify(p.output || '');
      const output = { call_id: p.call_id || '', output: String(rawOutput || '').slice(0, 4000) };
      toolOutputs.push(output);
      if (currentTurn) currentTurn.tool_outputs.push(output);
    }
  }
  finishTurn(lines.length);
  turns.forEach(turn => { turn.id = `${sessionId || 'session'}:${turn.start_line}`; });
  return { sessionId, cwd, title, userMessages, assistantMessages, toolCalls, toolOutputs, turns };
}

// Windows does not flush a file's mtime while Codex still holds the handle, so
// the newest rollout of a thread cannot be ranked by mtime alone. The rollout
// filename carries the start timestamp, which is always ordered correctly.
function rolloutStartMs(fileName) {
  const m = String(fileName).match(/rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const [, y, mo, d, h, mi, sec] = m;
  const ms = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function findTranscript(sessionsDir, sessionId) {
  if (!sessionId || !fs.existsSync(sessionsDir)) return null;
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
      } else if (entry.name.includes(sessionId) && entry.name.endsWith('.jsonl')) {
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        const candidate = {
          path: full,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          rank: Math.max(stat.mtimeMs, rolloutStartMs(entry.name))
        };
        if (!best || candidate.rank > best.rank) best = candidate;
      }
    }
  };
  walk(sessionsDir);
  return best;
}

function latestSessions(sessionsDir, limit = 10) {
  if (!fs.existsSync(sessionsDir)) return [];
  const found = [];
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
      } else if (entry.name.endsWith('.jsonl') && entry.name.startsWith('rollout-')) {
        try {
          const st = fs.statSync(full);
          found.push({ path: full, mtime: st.mtimeMs, size: st.size });
        } catch {
          // ignore unreadable
        }
      }
    }
  };
  walk(sessionsDir);
  found.sort((a, b) => b.mtime - a.mtime);
  const sessions = [];
  const seen = new Set();
  for (const f of found) {
    const parsed = parseTranscript(f.path);
    if (!parsed.sessionId || seen.has(parsed.sessionId)) continue;
    seen.add(parsed.sessionId);
    sessions.push({
      sessionId: parsed.sessionId,
      path: f.path,
      cwd: parsed.cwd,
      title: parsed.title || sessionTitle(parsed.userMessages, parsed.cwd, parsed.sessionId),
      mtime: f.mtime,
      userPromptCount: parsed.userMessages.length,
      lastPrompt: parsed.title || sessionTitle(parsed.userMessages, parsed.cwd, parsed.sessionId),
      latestPrompt: parsed.userMessages[parsed.userMessages.length - 1] || ''
    });
    if (sessions.length >= limit) break;
  }
  return sessions;
}

function sessionTitle(messages, cwd, sessionId) {
  const first = (messages || []).map(coreUserMessage).find(text => String(text).trim());
  if (first) {
    return String(first).replace(/\s+/g, ' ').trim().slice(0, 24);
  }
  const folder = String(cwd || '').split(/[\\/]/).filter(Boolean).pop();
  return folder || `会话 ${String(sessionId || '').slice(0, 8)}`;
}

function coreUserMessage(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const request = raw.match(/My request for Codex:\s*([\s\S]*)/i);
  const message = request ? request[1] : raw;
  const payloadStart = message.indexOf('{');
  const beforePayload = payloadStart >= 0 ? message.slice(0, payloadStart).trim() : message;
  const payload = payloadStart >= 0 ? message.slice(payloadStart) : '';
  const workflowKeys = [
    'current_user_prompt', 'assistant_final', 'intent_chain_json', 'evidence_json', 'route',
    'session_title', 'first_user_msg', 'recent_user_prompts', 'existing_contract', 'is_update',
    'sys.files', 'sys.user_id', 'sys.app_id', 'sys.timestamp', 'sys.workflow_id', 'sys.workflow_run_id'
  ];
  const hasWorkflowField = workflowKeys.some(key => new RegExp(`['\"]?${key.replace('.', '\\.')}['\"]?\\s*:`).test(payload));
  // A copied Dify request/response is debugging data, not a task instruction.
  // Keep any natural-language explanation preceding it, otherwise omit it.
  const clean = hasWorkflowField ? beforePayload : message;
  return clean.replace(/\s+/g, ' ').trim();
}

module.exports = { parseTranscript, findTranscript, latestSessions, isContextText, sessionTitle, coreUserMessage, rolloutStartMs };
