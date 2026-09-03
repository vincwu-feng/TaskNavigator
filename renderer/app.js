(function () {
  const DAEMON_URL = (window.tasknav && window.tasknav.daemonUrl) || 'http://127.0.0.1:48763';
  const state = {
    tasks: [], archived: [], view: 'active', selectedId: null, connected: false,
    detailOpen: new Set(), selectedSessionIndex: 0, pickerPlatform: null
  };
  let pendingMode = null;
  let toastTimer;

  const $ = selector => document.querySelector(selector);
  const listEl = $('#taskList');
  const detailBody = $('#detailBody');

  async function api(path, options) {
    const response = await fetch(DAEMON_URL + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || `${path} -> ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function meta(status) {
    if (status === 'completion_doubt') return { label: '完成存疑', cls: 'completion-unverified', dot: 'completion-unverified' };
    if (status === 'warn') return { label: '需要介入', cls: 'needs-intervention', dot: 'needs-intervention' };
    return { label: '正常推进', cls: 'on-track', dot: 'on-track' };
  }

  function statusMessage(status) {
    if (status === 'completion_doubt') return 'Codex 说已经做完，但还缺少验证';
    if (status === 'warn') return '这轮回复没有完全满足你的要求';
    return '本轮要求已满足，无需处理';
  }

  function suggestionText(task) {
    if (task && task.suggest) return task.suggest;
    return task && task.status === 'ok'
      ? '本轮要求已满足，可继续下一步。'
      : '请对照我的要求继续处理未满足的部分。';
  }

  function sourceIcon(task) {
    return task && task.source === 'claude' ? 'assets/claude-source.png' : 'assets/codex-source.png';
  }

  function sourceLabel(task) {
    return task && task.source === 'claude' ? 'Claude Code 会话' : 'Codex 会话';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function short(value, limit = 90) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }

  function relativeTime(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  }

  function toast(title, body, action) {
    $('#toast').innerHTML = `<div class="t-head">${esc(title)}</div><div class="t-body">${esc(body || '')}</div>${action ? `<button class="toast-action" id="toastAction">${esc(action.label)}</button>` : ''}`;
    $('#toast').classList.add('show');
    if (action) $('#toastAction').addEventListener('click', () => { action.run(); $('#toast').classList.remove('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), action ? 5200 : 3200);
  }

  function setMode(mode) {
    if (!window.tasknav || !window.tasknav.setWindowMode) {
      document.body.className = `${mode}-mode`;
      return;
    }
    pendingMode = mode;
    window.tasknav.setWindowMode(mode);
    setTimeout(() => {
      if (pendingMode === mode) {
        document.body.className = `${mode}-mode`;
        pendingMode = null;
      }
    }, 260);
  }

  if (window.tasknav && window.tasknav.onWindowModeApplied) {
    window.tasknav.onWindowModeApplied(mode => {
      if (pendingMode === mode) {
        document.body.className = `${mode}-mode`;
        pendingMode = null;
      }
    });
  }

  function setConn(connected) {
    state.connected = connected;
    const dot = $('#connDot');
    dot.classList.toggle('online', connected);
    dot.classList.toggle('offline', !connected);
    dot.title = connected ? '连接正常' : '暂时无法获取 Codex 回复';
    $('#connectionBanner').style.display = connected ? 'none' : 'block';
  }

  async function refresh() {
    const scrollTop = detailBody.scrollTop;
    try {
      const snapshot = await api('/api/state');
      state.tasks = snapshot.tasks || [];
      state.archived = snapshot.archived || [];
      setConn(true);
    } catch {
      setConn(false);
    }
    render();
    if (state.selectedId) {
      const selected = [...state.tasks, ...state.archived].find(task => String(task.id) === String(state.selectedId));
      if (selected) {
        renderDetail(selected);
        requestAnimationFrame(() => { detailBody.scrollTop = scrollTop; });
      } else state.selectedId = null;
    }
  }

  function connectEvents() {
    const events = new EventSource(DAEMON_URL + '/api/events');
    events.onopen = () => setConn(true);
    events.onerror = () => {
      setConn(false);
      events.close();
      setTimeout(connectEvents, 3000);
    };
    events.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type && message.type !== 'hello') refresh();
      } catch { /* ignore malformed events */ }
    };
  }

  function priority(task) {
    const severity = task.status === 'warn' ? 3 : task.status === 'completion_doubt' ? 2 : 1;
    return severity;
  }

  function sortedTasks() {
    return state.tasks.slice().sort((a, b) => priority(b) - priority(a) || new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function aggregateStatus() {
    if (state.tasks.some(task => task.status === 'warn')) return 'warn';
    if (state.tasks.some(task => task.status === 'completion_doubt')) return 'completion_doubt';
    return 'ok';
  }

  function render() {
    $('#tabActive').classList.toggle('active', state.view === 'active');
    $('#tabArchived').classList.toggle('active', state.view === 'archived');
    $('#newBtn').style.display = state.view === 'active' ? 'flex' : 'none';
    const pending = state.tasks.filter(task => task.status !== 'ok').length;
    const actionableUnread = state.tasks.some(task => task.unread && task.status !== 'ok');
    const aggregate = aggregateStatus();
    const railDot = $('#railDot');
    railDot.style.background = aggregate === 'warn' ? 'var(--yellow)' : aggregate === 'completion_doubt' ? '#60a5fa' : 'var(--green)';
    railDot.classList.toggle('pulse', actionableUnread);
    $('#tabDot').style.display = actionableUnread ? 'inline-block' : 'none';
    $('#railCount').style.display = pending ? 'flex' : 'none';
    $('#railCount').textContent = pending > 9 ? '9+' : String(pending);

    if (state.view === 'archived') {
      listEl.innerHTML = state.archived.length ? state.archived.map(task => `
        <div class="arch-item" data-id="${esc(task.id)}">
          <div class="row1"><img class="source-icon" src="${sourceIcon(task)}" alt="${sourceLabel(task)}"><span class="goal">${esc(task.sessionTitle)}</span></div>
          <div class="meta">归档于 ${esc(task.archivedAt || '')}</div>
          <div class="arch-actions"><button data-restore="${esc(task.id)}">恢复监控</button><button data-goto="${esc(task.id)}">打开会话</button><button class="danger" data-delete="${esc(task.id)}">删除</button></div>
        </div>`).join('') : '<div class="empty-state"><strong>暂无归档记录</strong><span>归档后的会话会显示在这里。</span></div>';
      bindArchived();
      return;
    }

    const tasks = sortedTasks();
    listEl.innerHTML = tasks.length ? tasks.map(task => {
      const visual = meta(task.status);
      const copyText = suggestionText(task);
      const turn = latestTurn(task) || {};
      const askedText = task.currentIntent || turn.user_asked || '等待下一轮提问';
      return `<div class="task ${task.status !== 'ok' ? 'actionable' : ''} ${String(state.selectedId) === String(task.id) ? 'selected' : ''}" data-id="${esc(task.id)}">
        ${task.unread && task.status !== 'ok' ? '<span class="unread-dot"></span>' : ''}
        <div class="acts"><button class="act" data-act="archive">归档</button><button class="act del" data-act="del">删除</button></div>
        <div class="task-head"><img class="source-icon" src="${sourceIcon(task)}" alt="${sourceLabel(task)}"><span class="goal" title="${esc(task.sessionTitle)}">${esc(task.sessionTitle)}</span></div>
        <div class="task-state-row"><span class="badge ${visual.cls}">${visual.label}</span><span class="task-source-text">${sourceLabel(task)}</span><span class="task-time">${esc(relativeTime(task.updatedAt))}</span></div>
        <div class="task-ask"><span>本轮提问</span><div title="${esc(askedText)}">${esc(short(askedText, 112))}</div></div>
        <div class="task-result-box ${visual.cls}">
          <div class="task-status">${esc(statusMessage(task.status))}</div>
          <div class="task-reason">${esc(short(task.reason || task.currentIntent || '等待下一轮回复', 150))}</div>
          <div class="task-suggestion"><span>建议</span><div>${esc(copyText)}</div></div>
          <div class="task-result-foot"><span>本次消耗 ${esc(task.token || '0')} tokens</span><button data-copy-card="${esc(task.id)}">复制${task.status === 'ok' ? '结论' : '建议'}</button></div>
        </div>
        <div class="task-links"><button data-detail="${esc(task.id)}">查看详情 →</button><button data-goto="${esc(task.id)}">前往会话 ↗</button></div>
      </div>`;
    }).join('') : '<div class="empty-state"><strong>还没有监控任何会话</strong><span>选择一个 Codex 或 Claude Code 会话，每轮回复后自动帮你检查。</span><button id="emptyBind">选择会话</button></div>';
    bindList();
    if ($('#emptyBind')) $('#emptyBind').addEventListener('click', showSessionPicker);
  }

  function bindList() {
    listEl.querySelectorAll('.task').forEach(element => element.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      openDetail(element.dataset.id);
    }));
    listEl.querySelectorAll('[data-detail]').forEach(element => element.addEventListener('click', event => {
      event.stopPropagation();
      openDetail(element.dataset.detail);
    }));
    listEl.querySelectorAll('[data-goto]').forEach(element => element.addEventListener('click', event => {
      event.stopPropagation();
      gotoSession(element.dataset.goto);
    }));
    listEl.querySelectorAll('[data-copy-card]').forEach(element => element.addEventListener('click', event => {
      event.stopPropagation();
      copySuggestion(element.dataset.copyCard);
    }));
    listEl.querySelectorAll('.act').forEach(element => element.addEventListener('click', event => {
      event.stopPropagation();
      const id = element.closest('.task').dataset.id;
      if (element.dataset.act === 'archive') archive(id); else remove(id);
    }));
  }

  function bindArchived() {
    listEl.querySelectorAll('[data-restore]').forEach(button => button.addEventListener('click', () => restore(button.dataset.restore)));
    listEl.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => gotoSession(button.dataset.goto)));
    listEl.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => remove(button.dataset.delete)));
  }

  function markRead(id) {
    const task = state.tasks.find(item => String(item.id) === String(id));
    if (task && task.unread) api(`/api/tasks/${id}/read`, { method: 'POST' }).then(refresh).catch(() => {});
  }

  function writeSuggestion(task) {
    if (!task) return;
    const text = suggestionText(task);
    if (window.tasknav && window.tasknav.copyText) window.tasknav.copyText(text);
    else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  }

  function copySuggestion(id) {
    const task = state.tasks.find(item => String(item.id) === String(id));
    if (!task) return;
    writeSuggestion(task);
    toast('话术已复制', '可直接粘贴给对应的 AI 助手。');
  }

  function copyAndOpen(id) {
    const task = state.tasks.find(item => String(item.id) === String(id));
    if (!task) return;
    writeSuggestion(task);
    gotoSession(id, '话术已复制，正在打开对应会话。');
  }

  function gotoSession(id, successText) {
    const task = [...state.tasks, ...state.archived].find(item => String(item.id) === String(id));
    if (!task || !window.tasknav) return toast('无法打开', '未找到对应会话');
    if (task.source === 'claude') {
      if (!window.tasknav.openClaudeSession) return toast('无法打开', '未找到对应 Claude Code 会话');
      return window.tasknav.openClaudeSession(task.cwd || '')
        .then(result => { if (!result || !result.ok) throw new Error('open failed'); toast('已打开工作目录', successText || task.sessionTitle); })
        .catch(() => toast('无法打开', '请检查 VS Code 是否可用'));
    }
    if (!window.tasknav.openCodexThread) return toast('无法打开', '未找到对应 Codex 会话');
    return window.tasknav.openCodexThread(task.sessionId)
      .then(result => { if (!result || !result.ok) throw new Error('open failed'); toast('已打开 Codex', successText || task.sessionTitle); })
      .catch(() => toast('无法打开', '请检查 Codex 桌面应用是否可用'));
  }

  function latestTurn(task) {
    return (task.intentChain || []).slice().reverse()[0] || null;
  }

  function evidenceHtml(task) {
    const evidence = task.lastEvidence;
    if (!evidence) return '<div class="evidence-empty">等待下一轮完整回复后生成判断依据。</div>';
    const files = evidence.file_changes || [];
    const tests = evidence.tests || [];
    const missing = evidence.missing_evidence || [];
    const passed = tests.filter(item => item.succeeded).length;
    const failed = tests.filter(item => item.failed).length;
    const summary = `<div class="evidence-summary">${esc(evidenceExplanation(task, files, tests, missing, passed, failed))}</div>`;
    const fileRows = files.map(item => `<div class="evidence-item good">修改文件：${esc(item.path)}</div>`).join('');
    const testRows = tests.map(item => `<div class="evidence-item ${item.succeeded ? 'good' : item.failed ? 'bad' : ''}">${item.succeeded ? '测试通过' : item.failed ? '测试失败' : '测试结果未知'}：${esc(item.command)}</div>`).join('');
    const missingRows = missing.map(item => `<div class="evidence-item bad">缺少：${esc(item)}</div>`).join('');
    const degraded = evidence.dify_degraded ? '<div class="evidence-item bad">语义判断暂时不可用，本轮采用本地检查结果</div>' : '';
    return `${summary}${fileRows}${testRows}${missingRows}${degraded}`;
  }

  function evidenceExplanation(task, files, tests, missing, passed, failed) {
    const facts = [];
    facts.push(files.length ? `修改了 ${files.length} 个文件` : '未检测到文件修改');
    facts.push(tests.length ? (failed ? `${failed} 项测试失败` : `${passed} 项测试通过`) : '未检测到测试结果');
    if (missing.length) facts.push(`缺少${missing.join('、')}`);
    const factText = facts.join('，');
    if (task.status === 'warn') return `本轮${factText}，说明这轮回复没有完全满足你的要求。`;
    if (task.status === 'completion_doubt') return `Codex 声称已完成，但这轮${factText}，还缺少可核验的证据。`;
    return `本轮${factText}，与回复内容一致，因此判断无需处理。`;
  }

  function chainHtml(task) {
    const chain = task.intentChain || [];
    if (!chain.length) return '<div class="evidence-empty">还没有足够的对话记录。</div>';
    return chain.slice().reverse().map(item => `<div class="intent-item"><div class="intent-top">${esc(item.time || '较早对话')}</div><div class="intent-user"><span>你</span>${esc(item.user_asked)}</div><div class="intent-ai"><span>${sourceLabel(task)}</span>${esc(item.ai_did)}</div></div>`).join('');
  }

  function historyHtml(task) {
    const chainById = new Map((task.intentChain || []).map(item => [item.turn_id, item]));
    const history = task.history || [];
    if (!history.length) return '<div class="evidence-empty">还没有新的完整问答记录。</div>';
    return history.map(item => {
      const chain = chainById.get(item.turn_id) || {};
      return `<div class="turn-record"><div class="turn-meta"><span class="badge ${meta(item.status).cls}">${meta(item.status).label}</span><span>${esc(item.time)}</span></div><div class="turn-side"><b>你</b><span>${esc(item.user_asked || '')}</span></div><div class="turn-side"><b>${sourceLabel(task)}</b><span>${esc(item.ai_did || chain.ai_did || '该轮旧记录未保存回复摘要')}</span></div>${item.status !== 'ok' && item.reason ? `<div class="turn-reason">${esc(item.reason)}</div>` : ''}</div>`;
    }).join('');
  }

  function diagnostic(task, key, title, countText, content, defaultOpen) {
    const open = state.detailOpen.has(key) || defaultOpen;
    return `<details class="diagnostic" data-key="${key}" ${open ? 'open' : ''}><summary><span>${title}</span><em>${esc(countText)}</em></summary>${content}</details>`;
  }

  function renderDetail(task) {
    const visual = meta(task.status);
    const turn = latestTurn(task) || {};
    const needsAction = task.status !== 'ok' && !task.archivedAt;
    const evidence = task.lastEvidence || {};
    const evidenceCount = (evidence.file_changes || []).length + (evidence.tests || []).length + (evidence.missing_evidence || []).length;
    const isReferential = turn.prompt_type === 'referential';
    detailBody.innerHTML = `
      <div class="detail-nav"><button class="back" id="backBtn">‹ 返回</button><div class="detail-meta"><span>本次判断消耗 ${esc(task.token || '0')} tokens</span><span>${esc(relativeTime(task.updatedAt))}更新</span></div></div>
      <div class="detail-title"><img class="source-icon" src="${sourceIcon(task)}" alt="${sourceLabel(task)}"><span>${esc(task.sessionTitle)}</span></div>
      <section class="decision ${visual.cls} ${task.status === 'ok' ? 'compact' : ''}">
        <div class="decision-top"><span class="badge ${visual.cls}">${visual.label}</span></div>
        <h1>${esc(statusMessage(task.status))}</h1>
        ${task.status !== 'ok' ? `<p>${esc(task.reason || task.current || '')}</p>` : '<p>TaskNavigator 没有发现需要你介入的问题。</p>'}
        ${needsAction ? `<div class="suggestion-preview"><span>建议发给 Codex</span><div>${esc(suggestionText(task))}</div></div><div class="decision-actions"><button class="primary-action" id="copyOpenBtn">复制并打开 Codex</button><button class="secondary-action" id="copyBtn">仅复制</button></div>` : `<div class="decision-actions"><button class="secondary-action" id="gotoFromDetail">打开 Codex</button></div>`}
      </section>
      <section class="turn-compare">
        <div class="turn-compare-title">本轮对照</div>
        <div class="turn-bubble user">
          <div class="bubble-head"><span class="bubble-avatar user">你</span><span>你的要求</span></div>
          <p>${esc(task.currentIntent || turn.user_asked || '等待你提出下一步要求')}</p>
        </div>
        <div class="turn-bubble assistant">
          <div class="bubble-head"><img class="bubble-avatar-img" src="${sourceIcon(task)}" alt="${sourceLabel(task)}"><span>${sourceLabel(task)} 回复</span></div>
          <p>${esc(turn.ai_did || '等待完整回复')}</p>
        </div>
      </section>
      <div class="diagnostic-zone">
        ${diagnostic(task, 'evidence', '为什么这样判断', evidenceCount ? `${evidenceCount} 项检查` : '暂无检查', evidenceHtml(task), false)}
        ${diagnostic(task, 'conversation', '最近几轮对话', `${(task.intentChain || []).length}轮`, chainHtml(task), isReferential)}
        ${diagnostic(task, 'history', '完整问答记录', `${(task.history || []).length}次`, historyHtml(task), false)}
      </div>`;
    $('#backBtn').addEventListener('click', closeDetail);
    if ($('#copyOpenBtn')) $('#copyOpenBtn').addEventListener('click', () => copyAndOpen(task.id));
    if ($('#copyBtn')) $('#copyBtn').addEventListener('click', () => copySuggestion(task.id));
    if ($('#gotoFromDetail')) $('#gotoFromDetail').addEventListener('click', () => gotoSession(task.id));
    detailBody.querySelectorAll('.diagnostic').forEach(element => element.addEventListener('toggle', () => {
      if (element.open) state.detailOpen.add(element.dataset.key); else state.detailOpen.delete(element.dataset.key);
    }));
  }

  function openDetail(id) {
    const task = [...state.tasks, ...state.archived].find(item => String(item.id) === String(id));
    if (!task) return;
    state.selectedId = String(id);
    state.detailOpen = new Set();
    const turn = latestTurn(task);
    if (turn && turn.prompt_type === 'referential') state.detailOpen.add('conversation');
    render();
    renderDetail(task);
    markRead(id);
    setMode('detail');
  }

  function closeDetail() {
    state.selectedId = null;
    state.detailOpen = new Set();
    render();
    setMode('list');
  }

  function archive(id) {
    api(`/api/tasks/${id}/archive`, { method: 'POST' }).then(() => { toast('已归档', '会话已移入归档。'); refresh(); }).catch(() => toast('归档失败', '请检查连接状态'));
  }

  function restore(id) {
    api(`/api/tasks/${id}/restore`, { method: 'POST' }).then(() => { toast('已恢复监控', '会话已回到进行中列表。'); refresh(); }).catch(() => toast('恢复失败', '请检查连接状态'));
  }

  function remove(id) {
    api(`/api/tasks/${id}/delete`, { method: 'POST' }).then(() => {
      toast('监控记录已删除', '需要的话可以立即撤销。', { label: '撤销', run: () => api(`/api/tasks/${id}/undo-delete`, { method: 'POST' }).then(refresh).catch(() => toast('无法撤销', '撤销时间已过')) });
      refresh();
    }).catch(() => toast('删除失败', '请检查连接状态'));
  }

  const PLATFORMS = [
    { id: 'codex', name: 'Codex', desc: '监控 Codex 桌面会话', icon: 'assets/codex-source.png' },
    { id: 'claude', name: 'Claude Code', desc: '监控 VS Code 中的 Claude Code 会话', icon: 'assets/claude-source.png' }
  ];

  function showSessionPicker() {
    state.selectedId = null;
    state.selectedSessionIndex = 0;
    setMode('detail');
    renderPlatformStep();
  }

  function renderPlatformStep() {
    state.pickerPlatform = null;
    detailBody.innerHTML = `<button class="back" id="bindBack">‹ 取消</button><div class="picker-title">选择要监控的平台</div><div class="picker-subtitle">先选择 AI 助手，再选择要监控的会话</div><div class="platform-grid">${PLATFORMS.map(platform => `<button class="platform-option" data-platform="${platform.id}"><img src="${platform.icon}" alt="${platform.name}"><span class="p-name">${platform.name}</span><span class="p-desc">${platform.desc}</span></button>`).join('')}</div>`;
    $('#bindBack').addEventListener('click', closeDetail);
    detailBody.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', async () => {
      const platform = button.dataset.platform;
      detailBody.innerHTML = '<div class="empty-wizard">正在查找最近会话…</div>';
      try {
        const result = await api(`/api/sessions/latest?limit=10&platform=${encodeURIComponent(platform)}`);
        const sessions = result.sessions || [];
        if (!sessions.length) {
          const platformName = platform === 'claude' ? 'Claude Code' : 'Codex';
          detailBody.innerHTML = `<button class="back" id="bindBack">‹ 返回</button><div class="empty-wizard">没有找到 ${platformName} 会话。请先开始一个会话。</div>`;
          $('#bindBack').addEventListener('click', renderPlatformStep);
          return;
        }
        renderSessionStep(platform, sessions);
      } catch {
        detailBody.innerHTML = '<button class="back" id="bindBack">‹ 返回</button><div class="empty-wizard">读取会话失败，TaskNavigator 正在尝试重新连接。</div>';
        $('#bindBack').addEventListener('click', renderPlatformStep);
      }
    }));
  }

  function renderSessionStep(platform, sessions) {
    state.pickerPlatform = platform;
    state.selectedSessionIndex = 0;
    const platformName = platform === 'claude' ? 'Claude Code' : 'Codex';
    const renderPicker = () => {
      detailBody.innerHTML = `<button class="back" id="bindBack">‹ 返回</button><div class="picker-title">选择要监控的 ${platformName} 会话</div><div class="picker-subtitle">只会监控你手动选择的会话</div><div class="session-list">${sessions.map((session, index) => `<button class="session-option ${index === state.selectedSessionIndex ? 'selected' : ''}" data-session-index="${index}"><strong>${esc(short(session.title || session.lastPrompt || session.sessionId, 55))}</strong><span>${esc(short(session.cwd || `${platformName} 会话`, 55))}</span></button>`).join('')}</div><button class="primary-btn" id="bindSession">开始监控</button>`;
      $('#bindBack').addEventListener('click', renderPlatformStep);
      detailBody.querySelectorAll('[data-session-index]').forEach(button => button.addEventListener('click', () => { state.selectedSessionIndex = Number(button.dataset.sessionIndex); renderPicker(); }));
      $('#bindSession').addEventListener('click', async () => {
        const button = $('#bindSession');
        const session = sessions[state.selectedSessionIndex];
        button.textContent = '正在绑定…';
        button.disabled = true;
        try {
          const created = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ session_id: session.sessionId, session_title: session.title || session.lastPrompt || session.sessionId, source: platform }) });
          toast('已开始监控', created.task.sessionTitle);
          await refresh();
          openDetail(created.task.id);
        } catch (error) {
          if (error.status === 409 && error.body && error.body.task) {
            toast('该会话已在监控', error.body.task.sessionTitle);
            await refresh();
            openDetail(error.body.task.id);
          } else {
            button.textContent = '开始监控';
            button.disabled = false;
            toast('绑定失败', error.message || '请检查连接状态');
          }
        }
      });
    };
    renderPicker();
  }

  $('#rail').addEventListener('pointerdown', event => { if (!(event.target.closest && event.target.closest('.rail-drag'))) setMode('list'); });
  $('#collapseBtn').addEventListener('click', () => { state.selectedId = null; setMode('rail'); });
  $('#hideBtn').addEventListener('click', () => { if (window.tasknav) window.tasknav.hideWindow(); });
  $('#detailClose').addEventListener('click', closeDetail);
  $('#tabActive').addEventListener('click', () => { state.view = 'active'; state.selectedId = null; render(); });
  $('#tabArchived').addEventListener('click', () => { state.view = 'archived'; state.selectedId = null; render(); });
  $('#newBtn').addEventListener('click', showSessionPicker);

  setMode('rail');
  refresh();
  connectEvents();
})();
