const fs = require('fs');
const path = require('path');

function create(dataDir) {
  const file = path.join(dataDir, 'tasks.json');
  let state = { schemaVersion: 3, tasks: [], archived: [] };
  const recentlyDeleted = new Map();

  function ensureDir() {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  function load() {
    ensureDir();
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        state.archived = Array.isArray(parsed.archived) ? parsed.archived : [];
        [...state.tasks, ...state.archived].forEach(migrateTask);
        state.schemaVersion = 3;
        save();
      } catch (err) {
        console.error('[store] failed to load tasks.json:', err.message);
      }
    }
    return state;
  }

  function save() {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  }

  function nextId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function findTaskBySession(sessionId) {
    if (!sessionId) return null;
    return state.tasks.find(task => task.sessionId === sessionId) || null;
  }

  function getTask(id) {
    return state.tasks.find(task => String(task.id) === String(id)) || null;
  }

  function createTask(data) {
    const now = new Date().toISOString();
    const task = {
      id: nextId(),
      sessionId: data.sessionId || '',
      sessionTitle: data.sessionTitle || '未命名会话',
      source: ['codex', 'claude'].includes(data.source) ? data.source : 'codex',
      cwd: data.cwd || '',
      status: 'ok',
      intentChain: Array.isArray(data.intentChain) ? data.intentChain.slice(-4) : [],
      currentIntent: '',
      current: '等待下一轮回复',
      reason: '',
      suggest: '继续在 Codex 中提出下一步要求。',
      confidence: 0,
      token: '0',
      unread: false,
      evidenceProfile: ['code', 'content', 'mixed'].includes(data.evidenceProfile) ? data.evidenceProfile : 'code',
      lastEvidence: null,
      noProgressTurns: 0,
      lastEvaluatedTurnId: data.lastEvaluatedTurnId || '',
      lastEvaluatedAssistantFinal: data.lastEvaluatedAssistantFinal || '',
      lastTranscriptMtime: Number(data.lastTranscriptMtime || 0),
      lastTranscriptSignature: String(data.lastTranscriptSignature || ''),
      history: [],
      createdAt: now,
      updatedAt: now
    };
    state.tasks.unshift(task);
    save();
    return task;
  }

  function updateTask(id, patch) {
    const task = getTask(id);
    if (!task) return null;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    save();
    return task;
  }

  function archiveTask(id) {
    const idx = state.tasks.findIndex(task => String(task.id) === String(id));
    if (idx < 0) return null;
    const task = state.tasks.splice(idx, 1)[0];
    task.archivedAt = shortTime();
    state.archived.unshift(task);
    save();
    return task;
  }

  function deleteTask(id) {
    let idx = state.tasks.findIndex(task => String(task.id) === String(id));
    if (idx >= 0) {
      const removed = state.tasks.splice(idx, 1)[0];
      recentlyDeleted.set(String(removed.id), { task: removed, source: 'tasks' });
      save();
      return removed;
    }
    idx = state.archived.findIndex(task => String(task.id) === String(id));
    if (idx < 0) return null;
    const removed = state.archived.splice(idx, 1)[0];
    recentlyDeleted.set(String(removed.id), { task: removed, source: 'archived' });
    save();
    return removed;
  }

  function restoreTask(id) {
    const idx = state.archived.findIndex(task => String(task.id) === String(id));
    if (idx < 0) return null;
    const task = state.archived.splice(idx, 1)[0];
    delete task.archivedAt;
    task.updatedAt = new Date().toISOString();
    state.tasks.unshift(task);
    save();
    return task;
  }

  function undoDelete(id) {
    const record = recentlyDeleted.get(String(id));
    if (!record) return null;
    recentlyDeleted.delete(String(id));
    if (record.source === 'archived') state.archived.unshift(record.task);
    else state.tasks.unshift(record.task);
    save();
    return record.task;
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  return { load, save, nextId, findTaskBySession, getTask, createTask, updateTask, archiveTask, restoreTask, deleteTask, undoDelete, snapshot };
}

function migrateTask(task) {
  const legacyStatus = {
    on_track: 'ok',
    needs_intervention: 'warn',
    completion_unverified: 'completion_doubt',
    stuck: 'warn',
    done: 'ok'
  };
  task.status = legacyStatus[task.status] || (['ok', 'warn', 'completion_doubt'].includes(task.status) ? task.status : 'ok');
  task.source = ['codex', 'claude'].includes(task.source) ? task.source : 'codex';
  task.cwd = task.cwd || '';
  task.intentChain = Array.isArray(task.intentChain)
    ? task.intentChain.slice(-4)
    : Array.isArray(task.intent_chain) ? task.intent_chain.slice(-4) : [];
  task.currentIntent = task.currentIntent || task.current_intent || '';
  task.current = task.current || (task.currentIntent ? `本轮意图：${task.currentIntent}` : '等待下一轮回复');
  task.reason = task.reason || '';
  task.suggest = task.suggest || '继续在 Codex 中提出下一步要求。';
  task.confidence = Number(task.confidence || 0);
  task.token = task.token || '0';
  task.unread = Boolean(task.unread);
  const oldMode = task.taskMode || (task.contract && task.contract.task_mode);
  task.evidenceProfile = ['code', 'content', 'mixed'].includes(task.evidenceProfile)
    ? task.evidenceProfile
    : oldMode === 'non_code' ? 'content' : 'code';
  task.lastEvidence = task.lastEvidence || null;
  task.noProgressTurns = Number(task.noProgressTurns || 0);
  task.lastEvaluatedTurnId = task.lastEvaluatedTurnId || '';
  task.lastEvaluatedAssistantFinal = task.lastEvaluatedAssistantFinal || '';
  task.lastTranscriptMtime = Number(task.lastTranscriptMtime || 0);
  task.lastTranscriptSignature = String(task.lastTranscriptSignature || '');
  const seenTurns = new Set();
  task.history = Array.isArray(task.history) ? task.history
    .filter(item => item && item.turn_id)
    .filter(item => {
      if (seenTurns.has(item.turn_id)) return false;
      seenTurns.add(item.turn_id);
      return true;
    })
    .slice(0, 50)
    .map(item => ({
      time: item.time || shortTime(),
      status: legacyStatus[item.status] || (['ok', 'warn', 'completion_doubt'].includes(item.status) ? item.status : 'ok'),
      user_asked: item.user_asked || item.text || '',
      ai_did: item.ai_did || '',
      reason: item.reason || '',
      suggest: item.suggest || '',
      evidence_summary: item.evidence_summary || '',
      turn_id: item.turn_id
    })) : [];
  task.createdAt = task.createdAt || new Date().toISOString();
  task.updatedAt = task.updatedAt || task.createdAt;

  delete task.goal;
  delete task.contract;
  delete task.log;
  delete task.pendingPrompt;
  delete task.progressPct;
  delete task.taskMode;
  delete task.intent_chain;
  delete task.current_intent;
}

function shortTime(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

module.exports = { create, shortTime, migrateTask };
