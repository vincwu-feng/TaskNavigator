const http = require('http');
const configMod = require('./config');
const storeMod = require('./store');
const transcript = require('./transcript');
const judgment = require('./judgment');
const dify = require('./dify');
const codexIndex = require('./codex-index');
const claudeSessions = require('./claude-sessions');

function fmtTokens(usage) {
  const count = Number(usage && usage.total_tokens || 0);
  if (count < 1000) return String(count);
  return (count / 1000).toFixed(1) + 'k';
}

function nowShort() {
  return storeMod.shortTime();
}

function truncate(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function buildEvidence(turn, cwd) {
  return {
    turn_id: turn.id,
    user_request: turn.user_prompt || '',
    assistant_reply: turn.assistant_final || '',
    tool_calls: Array.isArray(turn.tool_calls) ? turn.tool_calls : [],
    tool_outputs: Array.isArray(turn.tool_outputs) ? turn.tool_outputs : [],
    turn_meta: { cwd: cwd || '', start_line: turn.start_line, end_line: turn.end_line }
  };
}

function summarizeAssistant(reply) {
  return truncate(reply, 140) || '未给出最终回复';
}

function seedIntentChain(parsed, limit = 4) {
  return (parsed.turns || [])
    .filter(turn => turn.complete)
    .slice(-limit)
    .map(turn => ({
      turn_id: turn.id,
      user_asked: truncate(turn.user_prompt, 140),
      ai_did: summarizeAssistant(turn.assistant_final),
      assessment: 'context',
      time: ''
    }));
}

function evaluationIntentChain(parsed, task, turn, promptType) {
  const limit = promptType === 'referential' ? 6 : 4;
  const stored = new Map((task.intentChain || []).map(item => [item.turn_id, item]));
  return (parsed.turns || [])
    .filter(item => item.complete && item.id !== turn.id)
    .slice(-limit)
    .map(item => stored.get(item.id) || {
      turn_id: item.id,
      user_asked: truncate(item.user_prompt, 140),
      ai_did: summarizeAssistant(item.assistant_final),
      assessment: 'context',
      time: ''
    });
}

function buildEvalInputs(parsed, task, turn, evidence, rule) {
  return {
    current_user_prompt: evidence.user_request,
    assistant_final: evidence.assistant_reply,
    intent_chain_json: JSON.stringify(evaluationIntentChain(parsed, task, turn, rule.prompt_type_hint)),
    evidence_json: JSON.stringify(rule.evidence),
    route: rule.route
  };
}

function evidenceSummary(rule) {
  const evidence = rule.evidence || {};
  const passed = (evidence.tests || []).filter(item => item.succeeded).length;
  const failed = (evidence.tests || []).filter(item => item.failed).length;
  const files = (evidence.file_changes || []).map(item => item.path);
  const parts = [];
  if (files.length) parts.push(`文件：${files.join('、')}`);
  if (passed) parts.push(`测试通过 ${passed} 项`);
  if (failed) parts.push(`测试失败 ${failed} 项`);
  if (!parts.length && (evidence.commands || []).length) parts.push(`命令 ${evidence.commands.length} 项`);
  if (evidence.assistant_claim) parts.push('AI 声明已完成');
  return parts.join('；') || '未检测到文件、命令或测试证据';
}

function normalizeEvalOutput(outputs) {
  const source = outputs && typeof outputs === 'object' ? outputs : {};
  const aligned = typeof source.aligned === 'boolean'
    ? source.aligned
    : source.status === 'ok'
      ? true
      : source.status === 'warn'
        ? false
        : null;
  return {
    aligned,
    intent: truncate(source.intent || source.current_intent, 240),
    reason: truncate(source.reason, 320),
    suggest: truncate(source.suggest, 420)
  };
}

function fallbackResult(rule, noProgressTurns, difyFailed) {
  const promptType = rule.prompt_type_hint;
  if (rule.completion_doubt) {
    const missing = rule.missing_evidence.join('、') || '验证证据';
    return {
      status: 'completion_doubt',
      reason: `AI 声明完成，但缺少${missing}。`,
      suggest: `你说完成了，但${missing}没有验证证据，请补充证据或明确说明尚未完成。`
    };
  }
  if (rule.stuck_hint) {
    return {
      status: 'warn',
      reason: '本轮出现重复失败或反复尝试，尚未收敛。',
      suggest: '请停止重复尝试，先说明失败原因、当前证据和下一步唯一验证动作。'
    };
  }
  if (!rule.progress) {
    return {
      status: 'warn',
      reason: noProgressTurns >= 2 ? `已 ${noProgressTurns} 轮无实质推进。` : '本轮没有可观察的实质推进。',
      suggest: noProgressTurns >= 2
        ? `已连续 ${noProgressTurns} 轮无实质输出，请说明当前卡点、已验证事实和下一步动作。`
        : '请说明当前进度、卡点，以及下一步要产生的具体结果。'
    };
  }
  if (promptType === 'referential') {
    return {
      status: 'warn',
      reason: '本轮使用了指代表达，但暂时无法可靠锚定你否定和期望的具体内容。',
      suggest: '请先复述我上一轮否定的内容和真正想要的结果，再按该结果重做。'
    };
  }
  return {
    status: 'ok',
    reason: difyFailed ? '本轮存在实质推进；语义评估暂不可用。' : '本轮要求已满足。',
    suggest: '本轮要求已满足，可继续下一步。'
  };
}

function clearIncompleteTurnArtifacts(task, incompleteTurn, completedTurns) {
  if (!task || !incompleteTurn || task.lastEvaluatedTurnId !== incompleteTurn.id) return false;
  const beforeHistory = Array.isArray(task.history) ? task.history.length : 0;
  const beforeChain = Array.isArray(task.intentChain) ? task.intentChain.length : 0;
  task.history = (task.history || []).filter(item => item.turn_id !== incompleteTurn.id);
  task.intentChain = (task.intentChain || []).filter(item => item.turn_id !== incompleteTurn.id);
  const previousTurn = (completedTurns || [])[completedTurns.length - 1];
  task.lastEvaluatedTurnId = previousTurn ? previousTurn.id : '';
  task.lastEvaluatedAssistantFinal = previousTurn ? previousTurn.assistant_final : '';
  const previousResult = task.history[0];
  if (previousResult) {
    task.status = previousResult.status;
    task.currentIntent = previousResult.user_asked || task.currentIntent;
    task.reason = previousResult.reason || '';
    task.suggest = previousResult.suggest || task.suggest;
  } else {
    task.status = 'ok';
    task.current = '等待本轮最终回复';
    task.reason = '';
    task.suggest = '继续等待 Codex 完成本轮回复。';
  }
  return beforeHistory !== task.history.length || beforeChain !== task.intentChain.length;
}

function refreshCodexTaskTitles(store, config) {
  const names = codexIndex.loadThreadNames(config.codexHome);
  if (!names.size) return;
  for (const item of store.snapshot().tasks || []) {
    if (item.source === 'claude') continue;
    const name = names.get(item.sessionId);
    if (name && name !== item.sessionTitle) store.updateTask(item.id, { sessionTitle: name });
  }
}

async function evaluateLatestTurn(task, opts, config, store, broadcast) {
  const found = opts.transcript_path
    ? { path: opts.transcript_path, mtimeMs: 0 }
    : task.source === 'claude'
      ? claudeSessions.findTranscript(config.claudeHome, task.sessionId || opts.session_id)
      : transcript.findTranscript(config.sessionsDir, task.sessionId || opts.session_id);
  if (!found) return { handled: false, reason: 'no_transcript' };

  const parsed = task.source === 'claude'
    ? claudeSessions.parseTranscript(found.path)
    : transcript.parseTranscript(found.path);
  const newestParsedTurn = (parsed.turns || [])[parsed.turns.length - 1];
  if (newestParsedTurn && !newestParsedTurn.complete && task.lastEvaluatedTurnId === newestParsedTurn.id) {
    const completedBeforeCurrent = (parsed.turns || []).filter(turn => turn.complete && turn.id !== newestParsedTurn.id);
    if (clearIncompleteTurnArtifacts(task, newestParsedTurn, completedBeforeCurrent)) {
      task.updatedAt = new Date().toISOString();
      store.save();
      broadcast('task-updated', { taskId: task.id, turnId: newestParsedTurn.id });
    }
    return { handled: false, reason: 'awaiting_final_answer', turnId: newestParsedTurn.id };
  }
  const completed = (parsed.turns || []).filter(turn => turn.complete);
  const turn = completed[completed.length - 1];
  if (!turn) return { handled: false, reason: 'no_complete_turn' };
  if (task.lastEvaluatedTurnId === turn.id && task.lastEvaluatedAssistantFinal === turn.assistant_final) {
    return { handled: false, reason: 'already_evaluated', turnId: turn.id };
  }

  const evidence = buildEvidence(turn, parsed.cwd);
  const rule = judgment.judgeTurn({ evidence, evidenceProfile: task.evidenceProfile });
  const nextNoProgressTurns = rule.completion_doubt || rule.progress
    ? 0
    : Number(task.noProgressTurns || 0) + 1;
  const inputs = buildEvalInputs(parsed, task, turn, evidence, rule);

  let evalOut = { outputs: {}, usage: { total_tokens: 0 }, mock: false };
  let difyFailed = false;
  try {
    evalOut = await dify.runWorkflow('eval', inputs, config);
  } catch (err) {
    difyFailed = true;
    console.warn(`[eval] Dify failed for ${task.id}/${turn.id}:`, err.message);
  }
  const llm = normalizeEvalOutput(evalOut.outputs);
  const fallback = fallbackResult(rule, nextNoProgressTurns, difyFailed);

  const localOverride = rule.completion_doubt || !rule.progress || rule.stuck_hint;
  let status = fallback.status;
  if (rule.completion_doubt) {
    status = 'completion_doubt';
  } else if (!rule.progress || rule.stuck_hint) {
    status = 'warn';
  } else if (llm.aligned !== null) {
    status = llm.aligned ? 'ok' : 'warn';
  }

  const promptType = rule.prompt_type_hint;
  const currentIntent = llm.intent || truncate(evidence.user_request, 240) || '未识别到本轮意图';
  const reason = localOverride ? fallback.reason : (llm.reason || fallback.reason);
  const suggest = llm.suggest || fallback.suggest;
  const summary = evidenceSummary(rule);
  const chainEntry = {
    turn_id: turn.id,
    user_asked: currentIntent,
    ai_did: summarizeAssistant(evidence.assistant_reply),
    assessment: status === 'ok' ? 'satisfied' : status === 'completion_doubt' ? 'unverified' : 'unsatisfied',
    prompt_type: promptType,
    time: nowShort()
  };

  task.status = status;
  task.intentChain = [...(task.intentChain || []).filter(item => item.turn_id !== turn.id), chainEntry].slice(-4);
  task.currentIntent = currentIntent;
  task.current = status === 'ok' ? '正常推进' : status === 'completion_doubt' ? '完成声明缺少证据' : '本轮需要你介入';
  task.reason = reason;
  task.suggest = suggest;
  task.confidence = 0;
  task.token = fmtTokens(evalOut.usage);
  task.unread = true;
  task.noProgressTurns = nextNoProgressTurns;
  task.lastEvaluatedTurnId = turn.id;
  task.lastEvaluatedAssistantFinal = turn.assistant_final;
  task.lastEvidence = {
    turn_id: turn.id,
    summary,
    tests: rule.evidence.tests,
    commands: rule.evidence.commands,
    file_changes: rule.evidence.file_changes,
    assistant_claim: rule.evidence.assistant_claim,
    missing_evidence: rule.missing_evidence,
    dify_degraded: difyFailed
  };
  task.updatedAt = new Date().toISOString();
  task.history = Array.isArray(task.history) ? task.history : [];
  const historyEntry = {
    time: nowShort(),
    status,
    user_asked: currentIntent,
    ai_did: summarizeAssistant(evidence.assistant_reply),
    reason,
    suggest,
    evidence_summary: summary,
    turn_id: turn.id
  };
  task.history = [historyEntry, ...task.history.filter(item => item.turn_id !== turn.id)];
  if (task.history.length > 50) task.history.length = 50;
  store.save();
  broadcast('task-updated', { taskId: task.id, turnId: turn.id });
  return { handled: true, task, mock: evalOut.mock, usage: evalOut.usage, difyDegraded: difyFailed };
}

function createApp(config) {
  const store = storeMod.create(config.dataDir);
  store.load();
  refreshCodexTaskTitles(store, config);
  const sseClients = new Set();

  function broadcast(type, data) {
    const message = `data: ${JSON.stringify({ type, data })}\n\n`;
    for (const response of sseClients) {
      try { response.write(message); } catch { /* client gone */ }
    }
  }

  function sendJson(response, code, value) {
    const body = JSON.stringify(value);
    response.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    response.end(body);
  }

  function readJson(request) {
    return new Promise((resolve, reject) => {
      let raw = '';
      request.on('data', chunk => {
        raw += chunk;
        if (raw.length > 2 * 1024 * 1024) {
          reject(new Error('body too large'));
          request.destroy();
        }
      });
      request.on('end', () => {
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
      });
      request.on('error', reject);
    });
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    const method = request.method;

    if (method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return response.end();
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'health') {
      return sendJson(response, 200, { ok: true, mock: config.dify.mock, version: '0.5.6' });
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'state') {
      return sendJson(response, 200, Object.assign({ daemon: { online: true, mock: config.dify.mock, port: config.port } }, store.snapshot()));
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'events') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      response.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
      sseClients.add(response);
      const ping = setInterval(() => { try { response.write(': ping\n\n'); } catch { clearInterval(ping); } }, 25000);
      request.on('close', () => { clearInterval(ping); sseClients.delete(response); });
      return;
    }
    if (method === 'GET' && parts[0] === 'api' && parts[1] === 'sessions' && parts[2] === 'latest') {
      const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '10', 10));
      const platform = String(url.searchParams.get('platform') || 'codex').toLowerCase();
      if (platform === 'claude') {
        let sessions = [];
        try {
          sessions = claudeSessions.listSessions(config.claudeHome, limit);
        } catch (err) {
          console.warn('[sessions] Claude session list failed:', err.message);
        }
        return sendJson(response, 200, { sessions, source: 'claude', platform: 'claude' });
      }
      const sessions = transcript.latestSessions(config.sessionsDir, limit);
      const names = codexIndex.loadThreadNames(config.codexHome);
      sessions.forEach(session => {
        const name = names.get(session.sessionId);
        if (name) {
          session.title = name;
          session.lastPrompt = name;
        }
      });
      return sendJson(response, 200, { sessions, source: 'codex', platform: 'codex' });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'turn-ended') {
      const body = await readJson(request);
      const task = store.findTaskBySession(body.session_id || '');
      if (!task) return sendJson(response, 200, { handled: false, reason: 'no_task' });
      const result = await evaluateLatestTurn(task, {
        session_id: task.sessionId,
        transcript_path: body.transcript_path || ''
      }, config, store, broadcast);
      return sendJson(response, 200, result);
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && !parts[2]) {
      const body = await readJson(request);
      const source = ['codex', 'claude'].includes(body.source) ? body.source : 'codex';
      const found = body.session_id
        ? source === 'claude'
          ? claudeSessions.findTranscript(config.claudeHome, body.session_id)
          : transcript.findTranscript(config.sessionsDir, body.session_id)
        : null;
      if (!found) return sendJson(response, 400, { error: source === 'claude' ? '请选择一个真实存在的 Claude Code 会话' : '请选择一个真实存在的 Codex 会话' });
      const duplicate = store.findTaskBySession(body.session_id);
      if (duplicate) return sendJson(response, 409, { error: '该会话已在监控', task: duplicate });
      const parsed = source === 'claude' ? claudeSessions.parseTranscript(found.path) : transcript.parseTranscript(found.path);
      const indexedCodexTitle = source === 'codex'
        ? codexIndex.loadThreadNames(config.codexHome).get(body.session_id)
        : '';
      const derivedTitle = source === 'claude'
        ? parsed.title || transcript.sessionTitle(parsed.userMessages, parsed.cwd, body.session_id)
        : indexedCodexTitle || transcript.sessionTitle(parsed.userMessages, parsed.cwd, body.session_id);
      const task = store.createTask({
        sessionId: body.session_id,
        sessionTitle: body.session_title || derivedTitle || (source === 'claude' ? 'Claude Code 会话' : '未命名会话'),
        source,
        cwd: parsed.cwd,
        evidenceProfile: body.evidence_profile || 'code',
        intentChain: seedIntentChain(parsed),
        lastEvaluatedTurnId: '',
        lastEvaluatedAssistantFinal: '',
        lastTranscriptMtime: found.mtimeMs,
        lastTranscriptSignature: `${found.path}:${Number(found.size || 0)}`
      });
      broadcast('task-created', { taskId: task.id });
      const result = await evaluateLatestTurn(task, {
        session_id: task.sessionId,
        transcript_path: found.path
      }, config, store, broadcast);
      task.lastTranscriptMtime = found.mtimeMs;
      task.lastTranscriptSignature = `${found.path}:${Number(found.size || 0)}`;
      store.save();
      return sendJson(response, 200, { task: result.task || task, evaluated: result.handled === true });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && parts[2] && parts[3] === 'archive') {
      const task = store.archiveTask(parts[2]);
      if (!task) return sendJson(response, 404, { error: 'not found' });
      broadcast('task-archived', { taskId: task.id });
      return sendJson(response, 200, { task });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && parts[2] && parts[3] === 'restore') {
      const task = store.restoreTask(parts[2]);
      if (!task) return sendJson(response, 404, { error: 'not found' });
      broadcast('task-restored', { taskId: task.id });
      return sendJson(response, 200, { task });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && parts[2] && parts[3] === 'delete') {
      const task = store.deleteTask(parts[2]);
      if (!task) return sendJson(response, 404, { error: 'not found' });
      broadcast('task-deleted', { taskId: task.id });
      return sendJson(response, 200, { task });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && parts[2] && parts[3] === 'undo-delete') {
      const task = store.undoDelete(parts[2]);
      if (!task) return sendJson(response, 404, { error: 'undo expired' });
      broadcast('task-delete-undone', { taskId: task.id });
      return sendJson(response, 200, { task });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && parts[2] && parts[3] === 'read') {
      const task = store.getTask(parts[2]);
      if (!task) return sendJson(response, 404, { error: 'not found' });
      task.unread = false;
      store.save();
      return sendJson(response, 200, { task });
    }
    if (method === 'POST' && parts[0] === 'api' && parts[1] === 'tasks' && parts[2] && parts[3] === 'evaluate') {
      const body = await readJson(request);
      const task = store.getTask(parts[2]);
      if (!task) return sendJson(response, 404, { error: 'not found' });
      const result = await evaluateLatestTurn(task, {
        session_id: task.sessionId,
        transcript_path: body.transcript_path || ''
      }, config, store, broadcast);
      return sendJson(response, 200, result);
    }
    return sendJson(response, 404, { error: 'not found', path: url.pathname });
  }

  const server = http.createServer((request, response) => {
    handle(request, response).catch(err => sendJson(response, 500, { error: err.message }));
  });
  return { server, store, broadcast };
}

function startBoundSessionMonitor(app, config) {
  const intervalMs = Math.max(3000, Number(config.monitorPollMs) || 8000);
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      for (const snapshotTask of app.store.snapshot().tasks) {
        const task = app.store.getTask(snapshotTask.id);
        if (!task || !task.sessionId) continue;
        const found = task.source === 'claude'
          ? claudeSessions.findTranscript(config.claudeHome, task.sessionId)
          : transcript.findTranscript(config.sessionsDir, task.sessionId);
        if (!found) continue;
        // Windows keeps a stale mtime while the agent still holds the rollout
        // open, so growth in file size (or a switch to another rollout file of
        // the same thread) is what reliably signals a new round.
        const signature = `${found.path}:${Number(found.size || 0)}`;
        if (signature === String(task.lastTranscriptSignature || '')) continue;
        try {
          await evaluateLatestTurn(task, { session_id: task.sessionId, transcript_path: found.path }, config, app.store, app.broadcast);
        } catch (err) {
          console.warn(`[monitor] task ${task.id} failed:`, err.message);
        } finally {
          task.lastTranscriptSignature = signature;
          task.lastTranscriptMtime = found.mtimeMs;
          app.store.save();
        }
      }
    } finally {
      polling = false;
    }
  };
  const firstRun = setTimeout(poll, 1000);
  const timer = setInterval(poll, intervalMs);
  firstRun.unref();
  timer.unref();
  return () => { clearTimeout(firstRun); clearInterval(timer); };
}

async function main() {
  const config = configMod.load();
  const app = createApp(config);
  app.server.listen(config.port, config.host, () => {
    console.log(`[TaskNavigator daemon] http://${config.host}:${config.port} mock=${config.dify.mock} data=${config.dataDir}`);
  });
  const stopMonitor = startBoundSessionMonitor(app, config);
  const shutdown = () => {
    stopMonitor();
    app.server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });

module.exports = { createApp, startBoundSessionMonitor, buildEvidence, seedIntentChain, evaluationIntentChain, buildEvalInputs, normalizeEvalOutput, clearIncompleteTurnArtifacts, evaluateLatestTurn };
