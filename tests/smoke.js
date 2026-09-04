const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createApp, buildEvalInputs, normalizeEvalOutput, clearIncompleteTurnArtifacts } = require('../daemon/index');
const { judgeTurn, classifyPrompt } = require('../daemon/judgment');
const { parseTranscript, coreUserMessage, findTranscript } = require('../daemon/transcript');
const { migrateTask } = require('../daemon/store');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tasknav-test-'));
const sessionsDir = path.join(TMP, 'sessions');
const dataDir = path.join(TMP, 'data');
const codexHome = path.join(TMP, 'codex-home');
const claudeHome = path.join(TMP, 'claude-home');
const sessionId = 'smoke-session-001';
const fixturePath = path.join(sessionsDir, `rollout-2026-08-25T10-00-00-${sessionId}.jsonl`);
fs.mkdirSync(sessionsDir, { recursive: true });

function record(type, payload) {
  return JSON.stringify({ type, payload });
}

function initialFixture() {
  const rows = [record('session_meta', { session_id: sessionId, cwd: 'C:\\demo\\tower' })];
  rows.push(record('event_msg', { type: 'user_message', message: '帮我做一个三关塔防 H5' }));
  rows.push(record('response_item', { type: 'function_call', name: 'apply_patch', arguments: JSON.stringify({ input: '*** Begin Patch\n*** Add File: level1.js\n+ok\n*** End Patch' }), call_id: 'c1' }));
  rows.push(record('response_item', { type: 'function_call_output', call_id: 'c1', output: 'Done!' }));
  rows.push(record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '第一关已经实现，接下来可以继续补充关卡。' }] }));
  rows.push(record('event_msg', { type: 'task_complete', last_agent_message: '第一关已经实现，接下来可以继续补充关卡。' }));
  rows.push(record('event_msg', { type: 'user_message', message: '要轻松休闲一些，不要高压节奏' }));
  rows.push(record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '我已经整理了更轻松的节奏方案，并说明了敌人间隔和资源恢复方式。' }] }));
  rows.push(record('event_msg', { type: 'task_complete', last_agent_message: '我已经整理了更轻松的节奏方案，并说明了敌人间隔和资源恢复方式。' }));
  fs.writeFileSync(fixturePath, rows.join('\n') + '\n', 'utf8');
}

function appendTurn(user, reply, tools = []) {
  const rows = [record('event_msg', { type: 'user_message', message: user })];
  tools.forEach(tool => {
    rows.push(record('response_item', { type: 'function_call', name: tool.name, arguments: JSON.stringify(tool.arguments), call_id: tool.id }));
    rows.push(record('response_item', { type: 'function_call_output', call_id: tool.id, output: tool.output }));
  });
  rows.push(record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: reply }] }));
  rows.push(record('event_msg', { type: 'task_complete', last_agent_message: reply }));
  fs.appendFileSync(fixturePath, rows.join('\n') + '\n', 'utf8');
}

function setupCodexIndex() {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'session_index.jsonl'), JSON.stringify({
    id: sessionId,
    thread_name: '真实三关塔防标题',
    updated_at: '2026-08-25T10:00:00Z'
  }) + '\n', 'utf8');
}

function setupClaudeFixture() {
  const projectDir = path.join(claudeHome, 'projects', 'c--demo-claude-task');
  fs.mkdirSync(projectDir, { recursive: true });
  const file = path.join(projectDir, 'claude-session-001.jsonl');
  const rows = [
    JSON.stringify({ sessionId: 'claude-session-001', cwd: 'C:\\demo\\claude-task', type: 'user', origin: { kind: 'human' }, message: { content: [{ type: 'text', text: '检查 VS Code 插件里的 Claude 会话' }] } }),
    JSON.stringify({ sessionId: 'claude-session-001', cwd: 'C:\\demo\\claude-task', type: 'assistant', stop_reason: 'end_turn', message: { content: [{ type: 'text', text: '我已经检查了 VS Code 插件会话，并给出一个可监控方案。' }] } }),
    JSON.stringify({ sessionId: 'claude-session-001', type: 'ai-title', aiTitle: 'Claude VS 插件会话检查' })
  ];
  fs.writeFileSync(file, rows.join('\n') + '\n', 'utf8');
}

async function main() {
  const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  const rendererHtml = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  const rendererStyles = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(!rendererHtml.includes('rail-arrow'), 'collapsed rail has no misleading play icon');
  assert(rendererSource.includes('suggestion-preview') && rendererSource.includes('建议发给 Codex'), 'detail shows the full suggestion before copy');
  assert(rendererSource.includes('data-detail=') && rendererSource.includes('data-goto='), 'list keeps explicit detail and Codex navigation actions');
  assert(rendererSource.includes('codex-source.png') && rendererSource.includes('claude-source.png') && rendererSource.includes('sourceIcon'), 'task titles choose a source icon per monitored platform');
  assert(rendererSource.includes('platform-option') && rendererSource.includes('renderPlatformStep') && rendererSource.includes('Claude Code'), 'picker selects a platform first, then sessions');
  assert(rendererSource.includes('turn-compare') && rendererSource.includes('turn-bubble') && rendererSource.includes('本轮对照'), 'detail compares the user request and assistant reply as readable message blocks');
  assert(rendererSource.includes('task-source-text') && rendererSource.includes('<span class="task-time"'), 'task card time is rendered on the status row');
  assert(rendererStyles.includes('padding-right: 112px') && rendererStyles.includes('margin-left: auto'), 'task card header reserves room for hover actions and status-row time aligns right');
  assert(rendererSource.includes('task-ask') && rendererSource.includes('本轮提问') && rendererSource.includes('askedText'), 'task card shows which user prompt is being judged');
  assert(rendererSource.indexOf('task-ask') < rendererSource.indexOf('task-result-box'), 'task card prompt preview sits before the judgment result box');
  assert(rendererStyles.includes('-webkit-line-clamp: 2') && rendererStyles.includes('border-left: 2px solid') && rendererStyles.includes('.task-ask'), 'task card prompt preview is a compact context strip');
  assert(rendererSource.includes('openClaudeSession') && rendererSource.includes('task.cwd'), 'Claude sessions open their workspace folder');
  assert(rendererSource.includes('task-result-box') && rendererSource.includes('data-copy-card'), 'task card keeps result and copy action inside one bordered panel');
  assert(rendererSource.includes('本次判断消耗') && rendererSource.includes("task.token || '0'"), 'detail shows evaluation token usage');
  assert(rendererSource.includes("evidenceHtml(task), false"), 'judgment evidence is collapsed by default');
  assert(rendererSource.includes('evidence-summary') && rendererSource.includes('缺少可核验的证据'), 'evidence reads as a plain-language judgment explanation');
  assert(mainSource.includes('detail: { width: 680'), 'detail window keeps both panels the same width as the task list');
  assert(mainSource.includes("rail: { width: 72, height: 84 }"), 'collapsed rail is compact top to bottom');
  assert(!mainSource.includes('setOpacity('), 'mode switches never blank the window, which would read as a blink');
  assert(rendererSource.includes('function markSelected(') && !/function openDetail\([\s\S]*?\n    render\(\);/.test(rendererSource), 'opening a task highlights it in place instead of rebuilding the list, which flashed');
  assert(rendererSource.includes('lastListHtml') && rendererSource.includes('if (html === lastListHtml)'), 'identical list markup is not repainted, so daemon events do not flash the list');
  assert(rendererSource.includes('lastDetailHtml') && rendererSource.includes("detailBody.querySelector('#backBtn')"), 'identical detail markup is not repainted, but the cache is bypassed when the picker owns the pane');
  assert(!/api\(`\/api\/tasks\/\$\{id\}\/read`, \{ method: 'POST' \}\)\.then\(refresh\)/.test(rendererSource), 'clearing the unread dot does not trigger a full list re-render');
  assert(mainSource.indexOf('placeWindow(mode)') < mainSource.indexOf("webContents.send('window-mode-applied'"), 'the frame is resized before the renderer lays out, so panels are never squeezed into a narrow viewport');
  assert(!rendererSource.includes('MODE_WIDTH') && !rendererSource.includes('pendingMode'), 'renderer no longer guesses resize direction with timers');
  assert(rendererStyles.includes('height: 14px;') && rendererStyles.includes('width: 42px;'), 'collapsed rail trims vertical padding around the icon');
  assert(rendererStyles.includes('body.detail-mode .panel.detail { width: 340px; }'), 'detail panel matches the 340px task card width');
  assert(!rendererSource.includes('>复制并处理</button>'), 'list never copies an unseen suggestion');
  assert(mainSource.includes('function rememberPosition(') && mainSource.includes("win.on('moved'"), 'a dragged window position is remembered instead of recomputed from the screen corner');
  assert(mainSource.includes('railPos') && mainSource.includes('panelRight'), 'collapsed puck and expanded panels remember their own anchors');
  assert(!/const x = area\.x \+ area\.width - width;/.test(mainSource), 'mode switches never snap the widget back to the bottom-right corner');
  assert(mainSource.includes('function clamp(') && mainSource.includes('targetBounds'), 'a remembered position is clamped into the current work area');
  initialFixture();
  setupCodexIndex();
  setupClaudeFixture();
  const config = {
    host: '127.0.0.1',
    port: 0,
    sessionsDir,
    codexHome,
    claudeHome,
    dataDir,
    dify: { baseUrl: 'http://127.0.0.1:8800', apiKeys: { eval: '' }, mock: true, fallbackToMock: true }
  };
  const app = createApp(config);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const request = async (method, route, body) => {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    return { status: response.status, data };
  };

  const parsed = parseTranscript(fixturePath);
  assert(parsed.turns.length === 2 && parsed.turns.every(turn => turn.complete), 'transcript groups complete turns');
  assert(parsed.turns[0].tool_calls[0].call_id === parsed.turns[0].tool_outputs[0].call_id, 'tool calls and outputs share call_id');
  assert(classifyPrompt('还是不对，再改改') === 'referential', 'referential prompt classified locally');
  assert(classifyPrompt('加一个记住密码功能') === 'self_contained', 'self-contained prompt classified locally');
  const minimalInputs = buildEvalInputs(parsed, { intentChain: [] }, parsed.turns[1], {
    user_request: parsed.turns[1].user_prompt,
    assistant_reply: parsed.turns[1].assistant_final
  }, {
    prompt_type_hint: 'self_contained',
    route: 'fast',
    evidence: { tests: [], commands: [], file_changes: [], substantive_reply: true }
  });
  assert(JSON.stringify(Object.keys(minimalInputs).sort()) === JSON.stringify([
    'assistant_final', 'current_user_prompt', 'evidence_json', 'intent_chain_json', 'route'
  ]), 'Dify receives exactly five minimal inputs');
  const simpleOutput = normalizeEvalOutput({
    aligned: false,
    intent: '把登录功能补完',
    reason: '只说明了方案，没有完成实现。',
    suggest: '请完成登录功能并给出测试结果。'
  });
  assert(JSON.stringify(Object.keys(simpleOutput).sort()) === JSON.stringify([
    'aligned', 'intent', 'reason', 'suggest'
  ]), 'Dify returns exactly four flat fields');
  assert(simpleOutput.aligned === false && simpleOutput.intent === '把登录功能补完', 'simple Dify output is normalized');
  const workflowPayload = '{ "session_title": "old", "recent_user_prompts": "1. old", "existing_contract": "" }';
  assert(coreUserMessage(`修复消息采集\n${workflowPayload}`) === '修复消息采集', 'copied Dify payload stripped');

  const phasedFile = path.join(sessionsDir, 'rollout-phased-session.jsonl');
  fs.writeFileSync(phasedFile, [
    record('session_meta', { session_id: 'phased-session', cwd: 'C:\\demo' }),
    record('event_msg', { type: 'user_message', message: '检查登录页' }),
    record('response_item', { type: 'message', role: 'assistant', phase: 'commentary', content: [{ type: 'output_text', text: '我正在检查代码。' }] })
  ].join('\n'), 'utf8');
  const inProgress = parseTranscript(phasedFile);
  assert(inProgress.turns.length === 1 && !inProgress.turns[0].complete, 'commentary does not close a user turn');
  const phaseLessInProgressFile = path.join(sessionsDir, 'rollout-phase-less-in-progress.jsonl');
  fs.writeFileSync(phaseLessInProgressFile, [
    record('session_meta', { session_id: 'phase-less-session', cwd: 'C:\\demo' }),
    record('event_msg', { type: 'user_message', message: '检查登录页' }),
    record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '我正在检查代码。' }] })
  ].join('\n'), 'utf8');
  const phaseLessInProgress = parseTranscript(phaseLessInProgressFile);
  assert(phaseLessInProgress.turns.length === 1 && !phaseLessInProgress.turns[0].complete, 'phase-less commentary without task_complete does not close a turn');
  fs.appendFileSync(phasedFile, '\n' + [
    record('response_item', { type: 'message', role: 'assistant', phase: 'final_answer', content: [{ type: 'output_text', text: '登录页检查完成，发现一个校验问题。' }] }),
    record('event_msg', { type: 'task_complete' })
  ].join('\n'), 'utf8');
  const completedPhase = parseTranscript(phasedFile);
  assert(completedPhase.turns.length === 1 && completedPhase.turns[0].complete, 'final answer closes exactly one user turn');
  assert(completedPhase.turns[0].assistant_final.includes('发现一个校验问题'), 'final answer replaces commentary as the assistant result');
  const pollutedTask = {
    lastEvaluatedTurnId: inProgress.turns[0].id,
    lastEvaluatedAssistantFinal: '我正在检查代码。',
    status: 'warn', currentIntent: '检查登录页', reason: '旧污染判断', suggest: '旧话术',
    history: [{ turn_id: inProgress.turns[0].id, status: 'warn', user_asked: '检查登录页' }],
    intentChain: [{ turn_id: inProgress.turns[0].id, user_asked: '检查登录页' }]
  };
  assert(clearIncompleteTurnArtifacts(pollutedTask, inProgress.turns[0], []), 'polluted in-progress turn is detected');
  assert(pollutedTask.history.length === 0 && pollutedTask.intentChain.length === 0, 'in-progress turn artifacts are removed');
  assert(!pollutedTask.lastEvaluatedTurnId, 'cursor rolls back until the final answer arrives');

  const reliable = judgeTurn({
    evidenceProfile: 'code',
    evidence: {
      user_request: '完成登录页并测试',
      assistant_reply: '已经完成并测试通过。',
      tool_calls: [
        { name: 'apply_patch', arguments: JSON.stringify({ input: '*** Begin Patch\n*** Update File: login.js\n+x\n*** End Patch' }), call_id: 'p1' },
        { name: 'shell_command', arguments: JSON.stringify({ command: 'npm.cmd test' }), call_id: 't1' }
      ],
      tool_outputs: [
        { call_id: 'p1', output: 'Done!' },
        { call_id: 't1', output: 'Exit code: 0\nTests passed' }
      ]
    }
  });
  assert(reliable.evidence.file_changes[0].path === 'login.js', 'successful patch becomes file evidence');
  assert(reliable.evidence.tests[0].succeeded, 'exit code zero becomes passing test evidence');
  assert(!reliable.completion_doubt, 'code completion with file and test evidence is not doubtful');

  const customSessionId = 'custom-session-001';
  const customFile = path.join(sessionsDir, `rollout-custom-${customSessionId}.jsonl`);
  fs.writeFileSync(customFile, [
    record('session_meta', { session_id: customSessionId, cwd: 'C:\\demo' }),
    record('event_msg', { type: 'user_message', message: '修改文件' }),
    record('response_item', { type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch\n*** Update File: custom.js\n+x\n*** End Patch', call_id: 'custom-1' }),
    record('response_item', { type: 'custom_tool_call_output', call_id: 'custom-1', output: 'Exit code: 0\nSuccess. Updated the following files:\nM custom.js' }),
    record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '文件已经修改完成。' }] }),
    record('event_msg', { type: 'task_complete', last_agent_message: '文件已经修改完成。' })
  ].join('\n'), 'utf8');
  const customParsed = parseTranscript(customFile);
  const customRule = judgeTurn({ evidenceProfile: 'code', evidence: {
    user_request: customParsed.turns[0].user_prompt,
    assistant_reply: customParsed.turns[0].assistant_final,
    tool_calls: customParsed.turns[0].tool_calls,
    tool_outputs: customParsed.turns[0].tool_outputs
  } });
  assert(customRule.evidence.file_changes[0].path === 'custom.js', 'custom apply_patch events become file evidence');

  const content = judgeTurn({
    evidenceProfile: 'content',
    evidence: { user_request: '评估方案', assistant_reply: '评估已经完成：方案的核心风险是证据口径不统一，建议先统一数据结构再推进。', tool_calls: [], tool_outputs: [] }
  });
  assert(content.progress && !content.completion_doubt, 'substantive content is valid for content profile');

  const codexSessions = await request('GET', '/api/sessions/latest?platform=codex&limit=5');
  const indexedCodex = codexSessions.data.sessions.find(item => item.sessionId === sessionId);
  assert(indexedCodex && indexedCodex.title === '真实三关塔防标题', 'Codex picker shows indexed thread titles');
  const claudeSessions = await request('GET', '/api/sessions/latest?platform=claude&limit=5');
  assert(claudeSessions.data.sessions[0].title === 'Claude VS 插件会话检查', 'Claude picker lists VS Code plugin sessions');
  const claudeCreated = await request('POST', '/api/tasks', { session_id: 'claude-session-001', session_title: 'Claude VS 插件会话检查', source: 'claude' });
  assert(claudeCreated.status === 200 && claudeCreated.data.task.source === 'claude', 'Claude Code session can be bound');
  assert(claudeCreated.data.task.sessionTitle === 'Claude VS 插件会话检查', 'Claude binding preserves the selected title');
  assert(claudeCreated.data.evaluated === true && claudeCreated.data.task.history.length === 1, 'Claude binding immediately evaluates the latest completed turn');

  const created = await request('POST', '/api/tasks', { session_id: sessionId, session_title: '真实三关塔防标题' });
  assert(created.status === 200, 'existing Codex session can be bound');
  const taskId = created.data.task.id;
  assert(!('contract' in created.data.task) && !('goal' in created.data.task), 'new task has no goal contract');
  assert(created.data.task.intentChain.length === 2, 'binding seeds the sliding intent chain');
  assert(created.data.task.sessionTitle === '真实三关塔防标题', 'Codex binding preserves the selected title');
  assert(created.data.evaluated === true && created.data.task.history.length === 1, 'Codex binding immediately evaluates the latest completed turn');

  const duplicate = await request('POST', '/api/tasks', { session_id: sessionId });
  assert(duplicate.status === 409, 'duplicate session binding rejected');
  const sameTurn = await request('POST', `/api/tasks/${taskId}/evaluate`, { transcript_path: fixturePath });
  assert(!sameTurn.data.handled && sameTurn.data.reason === 'already_evaluated', 'same completed turn is idempotent');

  appendTurn('把登录功能补完', '登录功能已经全部完成了。');
  const doubtful = await request('POST', `/api/tasks/${taskId}/evaluate`, { transcript_path: fixturePath });
  assert(doubtful.data.task.status === 'completion_doubt', 'completion claim without file/test evidence is blue');
  assert(doubtful.data.task.lastEvidence.missing_evidence.includes('测试或验证结果'), 'missing verification recorded');
  assert(doubtful.data.task.intentChain.length <= 4, 'intent chain stays within four turns');

  appendTurn('继续处理', '好的，我会继续处理。');
  const idle1 = await request('POST', `/api/tasks/${taskId}/evaluate`, { transcript_path: fixturePath });
  assert(idle1.data.task.status === 'warn' && idle1.data.task.noProgressTurns === 1, 'first empty turn is intervention');
  appendTurn('现在怎么样', '还在处理中。');
  const idle2 = await request('POST', `/api/tasks/${taskId}/evaluate`, { transcript_path: fixturePath });
  assert(idle2.data.task.status === 'warn' && idle2.data.task.noProgressTurns === 2, 'two empty turns produce no-progress streak');
  assert(idle2.data.task.suggest === '请对照我本轮的要求，说明已经做到什么、还差什么，并给出下一步具体结果。', 'Dify suggest is shown even for no-progress turns');

  appendTurn('还是不对，再改改', '我调整了交互节奏并给出了具体修改结果。', [
    { id: 'p2', name: 'apply_patch', arguments: { input: '*** Begin Patch\n*** Update File: game.js\n+x\n*** End Patch' }, output: 'Done!' },
    { id: 't2', name: 'shell_command', arguments: { command: 'npm.cmd test' }, output: 'Exit code: 0\nTests passed' }
  ]);
  const referential = await request('POST', `/api/tasks/${taskId}/evaluate`, { transcript_path: fixturePath });
  assert(referential.data.task.intentChain[3].prompt_type === 'referential', 'referential result stored in chain');
  assert(referential.data.task.token !== '0', 'single mock eval usage is read back');
  assert(referential.data.task.history.length === 5, 'each evaluated user-assistant turn creates one history record');
  assert(new Set(referential.data.task.history.map(item => item.turn_id)).size === referential.data.task.history.length, 'history turn ids are unique');
  assert(referential.data.task.history.every(item => item.user_asked && item.ai_did), 'history stores both sides of each completed turn');

  const legacy = {
    goal: 'old',
    status: 'completion_unverified',
    taskMode: 'non_code',
    contract: { goal: 'old' },
    log: [{}],
    pendingPrompt: {},
    history: [
      { text: 'AI 正在推进', status: 'ok', turn_id: '' },
      { text: '真实问题', ai_did: '真实回答', status: 'warn', turn_id: 'turn-1' },
      { text: '重复问题', ai_did: '重复回答', status: 'warn', turn_id: 'turn-1' }
    ]
  };
  migrateTask(legacy);
  assert(legacy.status === 'completion_doubt' && legacy.evidenceProfile === 'content', 'legacy status and profile migrate');
  assert(!('contract' in legacy) && !('pendingPrompt' in legacy), 'legacy contract fields removed');
  assert(legacy.history.length === 1 && legacy.history[0].turn_id === 'turn-1', 'invalid and duplicate legacy history is removed');

  const hook = await runHook(port);
  assert(hook.ok, 'turn-ended hook still forwards safely');
  const archived = await request('POST', `/api/tasks/${taskId}/archive`);
  assert(archived.status === 200 && archived.data.task.archivedAt, 'task archives');
  const restored = await request('POST', `/api/tasks/${taskId}/restore`);
  assert(restored.status === 200 && !restored.data.task.archivedAt, 'archived task restores to active monitoring');
  await request('POST', `/api/tasks/${taskId}/archive`);
  const deleted = await request('POST', `/api/tasks/${taskId}/delete`);
  assert(deleted.status === 200, 'archived task can be deleted');
  const undone = await request('POST', `/api/tasks/${taskId}/undo-delete`);
  assert(undone.status === 200 && undone.data.task.id === taskId, 'deleted task can be immediately restored');

  // Regression: Codex stopped emitting `event_msg/user_message` in 2026-09 and
  // now records the prompt only as `response_item/message` role=user. A parser
  // that keys on the event alone finds zero turns, so nothing is ever evaluated.
  const modernId = 'smoke-modern-001';
  const modernPath = path.join(sessionsDir, `rollout-2026-09-04T14-31-09-${modernId}.jsonl`);
  fs.writeFileSync(modernPath, [
    record('session_meta', { session_id: modernId, cwd: 'C:\\demo\\modern' }),
    record('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: '看下有没有 bak 文件' }] }),
    record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '有的，README.md.bak 存在。' }] }),
    record('event_msg', { type: 'task_complete', last_agent_message: '有的，README.md.bak 存在。' })
  ].join('\n') + '\n');
  const modernParsed = parseTranscript(modernPath);
  assert(modernParsed.turns.length === 1, 'response_item-only transcripts still produce a turn');
  assert(modernParsed.turns[0].complete, 'response_item-only turn is recognised as complete');
  assert(modernParsed.turns[0].user_prompt === '看下有没有 bak 文件', 'prompt is read from the response_item message');

  // Regression: transcripts that carry both shapes of the same prompt must not
  // be counted as two rounds.
  const dualId = 'smoke-dual-001';
  const dualPath = path.join(sessionsDir, `rollout-2026-08-30T14-09-00-${dualId}.jsonl`);
  fs.writeFileSync(dualPath, [
    record('session_meta', { session_id: dualId, cwd: 'C:\\demo\\dual' }),
    record('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: '同一个问题' }] }),
    record('event_msg', { type: 'user_message', message: '同一个问题' }),
    record('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '答完了。' }] }),
    record('event_msg', { type: 'task_complete', last_agent_message: '答完了。' })
  ].join('\n') + '\n');
  const dualParsed = parseTranscript(dualPath);
  assert(dualParsed.turns.length === 1, 'a prompt written in both shapes counts as one turn');

  // Regression: Windows leaves a rollout's mtime stale while Codex holds the
  // handle, so the newest file of a thread must be picked by its filename
  // timestamp and change must be detected by size rather than mtime.
  const forkId = 'smoke-fork-001';
  const oldFork = path.join(sessionsDir, `rollout-2026-09-04T10-00-00-${forkId}.jsonl`);
  const newFork = path.join(sessionsDir, `rollout-2026-09-04T18-00-00-${forkId}.jsonl`);
  fs.writeFileSync(oldFork, record('session_meta', { session_id: forkId, cwd: 'C:\\demo\\fork' }) + '\n');
  fs.writeFileSync(newFork, record('session_meta', { session_id: forkId, cwd: 'C:\\demo\\fork' }) + '\n');
  const staleTime = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(newFork, staleTime, staleTime);
  const picked = findTranscript(sessionsDir, forkId);
  assert(picked && picked.path === newFork, 'newest rollout wins even when its mtime is stale');
  assert(typeof picked.size === 'number', 'findTranscript reports size so growth can be detected without mtime');
  console.log('SMOKE PASS: turn cursor, evidence, intent chain, single eval, migration, transcript formats, stale mtime, UI APIs');
  app.server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}

function runHook(port) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'hook', 'turn-ended.js')], {
      env: Object.assign({}, process.env, { TASKNAV_DAEMON_PORT: String(port) }),
      stdio: ['pipe', 'ignore', 'ignore']
    });
    const timer = setTimeout(() => { child.kill(); resolve({ ok: false }); }, 6000);
    child.on('exit', () => { clearTimeout(timer); resolve({ ok: true }); });
    child.stdin.write(JSON.stringify({ session_id: sessionId, transcript_path: fixturePath }));
    child.stdin.end();
  });
}

function assert(condition, label) {
  if (!condition) throw new Error(`ASSERT FAILED: ${label}`);
}

main().catch(err => {
  console.error(err);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
