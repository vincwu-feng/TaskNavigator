const STUCK_MARKERS = ['还是不行', '又失败', '再次报错', '仍然报错', '来回改', '一直报错', '没效果', '还是报错'];
const ERROR_MARKERS = ['error', 'failed', 'exception', 'fail', 'denied', 'not found', 'cannot', '失败', '报错', '异常', '拒绝'];
const REFERENTIAL_PATTERNS = [
  /^(这|那|它|这个|那个).{0,12}(不对|不是|不行|改|调整)/,
  /^(还是|仍然|继续|再)(不对|不行|改|调整|优化)/,
  /^(重做|再改改|按刚才|按上次|照之前)/,
  /(不是我想要的|和我说的不一样|没按我说的)/
];

function compact(value) {
  return String(value || '').replace(/\s+/g, '');
}

function parseArguments(call) {
  const raw = call && call.arguments;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return { raw: String(raw) }; }
}

function commandOf(call) {
  const args = parseArguments(call);
  return String(args.command || args.cmd || args.raw || call.arguments || '');
}

function isTestCall(call) {
  const text = `${call.name || ''} ${commandOf(call)}`.toLowerCase();
  return /(?:^|\s|\b)(test|pytest|vitest|jest|mocha|npm(?:\.cmd)?\s+(?:run\s+)?test|pnpm\s+test|yarn\s+test|cargo\s+test|go\s+test|dotnet\s+test|build|typecheck|lint)(?:\s|\b|$)/.test(text);
}

function outputMeta(raw) {
  const text = String(raw || '');
  const lower = text.toLowerCase();
  const exitMatch = text.match(/(?:exit code|exited with (?:code|status)|process exited with code)\s*[:=]?\s*(-?\d+)/i);
  const exitCode = exitMatch ? Number(exitMatch[1]) : null;
  const explicitFailure = exitCode !== null ? exitCode !== 0 : ERROR_MARKERS.some(marker => lower.includes(marker));
  const explicitSuccess = exitCode === 0 || /(?:tests? passed|\bpass(?:ed)?\b|success(?:ful(?:ly)?)?|done!|completed successfully|ok\b|成功|通过)/i.test(text);
  return {
    text: text.slice(0, 4000),
    exit_code: exitCode,
    succeeded: Boolean(text) && !explicitFailure && explicitSuccess,
    failed: explicitFailure
  };
}

function changedFiles(call, meta) {
  if (!call || !meta || meta.failed) return [];
  const args = parseArguments(call);
  if (call.name === 'apply_patch') {
    const patch = String(args.input || args.patch || args.raw || call.arguments || '');
    const files = [];
    const pattern = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gm;
    let match;
    while ((match = pattern.exec(patch))) files.push(match[1].trim());
    return [...new Set(files)];
  }
  if (['Edit', 'Write', 'NotebookEdit'].includes(call.name) && args.file_path) {
    return [String(args.file_path)];
  }
  return [];
}

function isReadOnlyCommand(command) {
  const value = String(command || '').trim().toLowerCase();
  return /^(?:get-childitem|dir\b|ls\b|rg\b|grep\b|select-string\b|get-content\b|type\b|cat\b|pwd\b|git\s+(?:status|diff|log|show)\b)/.test(value);
}

function isSubstantiveReply(reply) {
  const normalized = compact(reply);
  if (normalized.length < 30) return false;
  return !/^(完成|已完成|好的|收到|处理中|我会处理|没问题)[。！!]*$/.test(normalized);
}

function classifyPrompt(prompt) {
  const text = String(prompt || '').trim();
  return REFERENTIAL_PATTERNS.some(pattern => pattern.test(text)) ? 'referential' : 'self_contained';
}

function evidenceBuckets(evidence) {
  const calls = Array.isArray(evidence.tool_calls) ? evidence.tool_calls : [];
  const outputs = Array.isArray(evidence.tool_outputs) ? evidence.tool_outputs : [];
  const outputByCall = new Map(outputs.map(item => [item.call_id || item.callId || '', item.output]));
  const tests = [];
  const commands = [];
  const fileChanges = [];

  calls.forEach(call => {
    const callId = call.call_id || call.callId || '';
    const meta = outputMeta(outputByCall.get(callId));
    const command = commandOf(call);
    if (isTestCall(call)) {
      tests.push({ command: command || call.name, ...meta });
    } else if (call.name !== 'apply_patch') {
      commands.push({ command: command || call.name, read_only: isReadOnlyCommand(command), ...meta });
    }
    changedFiles(call, meta).forEach(path => fileChanges.push({ path, operation: 'changed', succeeded: true }));
  });

  return { tests, commands, file_changes: fileChanges };
}

function judgeTurn({ evidence, evidenceProfile = 'mixed' }) {
  const profile = ['code', 'content', 'mixed'].includes(evidenceProfile) ? evidenceProfile : 'mixed';
  const buckets = evidenceBuckets(evidence || {});
  const assistantReply = String(evidence && evidence.assistant_reply || '');
  const userRequest = String(evidence && evidence.user_request || '');
  const assistantClaim = /(?:完成了|已完成|全部完成|已经完成|搞定了|done|completed)/i.test(assistantReply);
  const claimsTested = /(?:测试通过|测试已通过|已测试|验证通过|tests? passed|verified)/i.test(assistantReply);
  const substantiveReply = isSubstantiveReply(assistantReply);
  const passedTest = buckets.tests.some(test => test.succeeded);
  const ranTest = buckets.tests.length > 0;
  const successfulFileChange = buckets.file_changes.length > 0;
  const substantiveCommand = buckets.commands.some(command => !command.read_only && (command.succeeded || !command.failed));
  const codeProgress = successfulFileChange || ranTest || substantiveCommand;
  const contentProgress = substantiveReply;
  const progress = profile === 'code' ? codeProgress : profile === 'content' ? contentProgress : codeProgress || contentProgress;

  const missingEvidence = [];
  if (assistantClaim && profile === 'code') {
    if (!successfulFileChange) missingEvidence.push('文件变更');
    if (!passedTest) missingEvidence.push('测试或验证结果');
  } else if (assistantClaim && profile === 'mixed' && !successfulFileChange && !passedTest && !substantiveReply) {
    missingEvidence.push('可核验产物');
  } else if (assistantClaim && profile === 'content' && !substantiveReply) {
    missingEvidence.push('实质交付内容');
  }
  if (claimsTested && !passedTest && !missingEvidence.includes('测试或验证结果')) missingEvidence.push('测试或验证结果');

  const repeated = {};
  let repeatedCount = 0;
  callsForRepeat(evidence).forEach(call => {
    if (call.name === 'apply_patch') return;
    const key = `${call.name}:${commandOf(call)}`;
    repeated[key] = (repeated[key] || 0) + 1;
    repeatedCount = Math.max(repeatedCount, repeated[key]);
  });
  const failureCount = [...buckets.tests, ...buckets.commands].filter(item => item.failed).length;
  const stuckHint = (repeatedCount >= 3 && failureCount >= 1) || STUCK_MARKERS.some(marker => assistantReply.includes(marker));
  const promptTypeHint = classifyPrompt(userRequest);
  const completionDoubt = assistantClaim && missingEvidence.length > 0;

  return {
    progress,
    prompt_type_hint: promptTypeHint,
    route: promptTypeHint === 'referential' || completionDoubt ? 'pro' : 'fast',
    rule_status: completionDoubt ? 'completion_doubt' : (!progress || stuckHint ? 'warn' : ''),
    completion_doubt: completionDoubt,
    missing_evidence: missingEvidence,
    stuck_hint: stuckHint,
    repeated_count: repeatedCount,
    failure_count: failureCount,
    evidence: {
      tests: buckets.tests,
      commands: buckets.commands,
      file_changes: buckets.file_changes,
      assistant_claim: assistantClaim,
      claims_tested: claimsTested,
      substantive_reply: substantiveReply
    }
  };
}

function callsForRepeat(evidence) {
  return Array.isArray(evidence && evidence.tool_calls) ? evidence.tool_calls : [];
}

module.exports = { judgeTurn, classifyPrompt, evidenceBuckets, outputMeta, isSubstantiveReply, compact };
