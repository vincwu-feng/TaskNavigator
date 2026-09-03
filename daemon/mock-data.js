function safeParse(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function mockUsage(value, seed = 1) {
  const size = JSON.stringify(value || {}).length;
  const prompt = 260 + Math.floor(size / 3) + seed * 7;
  const completion = 120 + seed * 5;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

function mockEval(inputs) {
  const chain = safeParse(inputs.intent_chain_json);
  const evidence = safeParse(inputs.evidence_json);
  const prompt = String(inputs.current_user_prompt || '').trim();
  const promptType = /^(?:这|那|它|这个|那个|还是|仍然|继续|再改改|重做)|不是我想要的|没按我说的/.test(prompt)
    ? 'referential'
    : 'self_contained';
  const previous = Array.isArray(chain) && chain.length ? chain[chain.length - 1] : null;
  let aligned = true;
  let reason = '本轮要求已满足。';
  let suggest = '本轮要求已满足，可继续下一步。';

  const hasObservableWork = Boolean(
    (evidence.file_changes || []).length ||
    (evidence.tests || []).length ||
    (evidence.commands || []).length ||
    evidence.substantive_reply
  );
  if (!hasObservableWork) {
    aligned = false;
    reason = 'AI 回复没有体现明确的本轮产出。';
    suggest = '请对照我本轮的要求，说明已经做到什么、还差什么，并给出下一步具体结果。';
  } else if (promptType === 'referential') {
    aligned = false;
    const anchor = previous && previous.user_asked ? previous.user_asked : '上一轮要求';
    reason = `本轮指代需要回溯「${anchor}」。`;
    suggest = `你上一轮针对的是「${anchor}」，请先复述被否定内容和真正想要的结果，再按该结果重做。`;
  }

  const result = {
    aligned,
    intent: prompt || (previous && previous.user_asked) || '未识别到本轮意图',
    reason,
    suggest
  };
  return {
    outputs: { eval_result: JSON.stringify(result) },
    usage: mockUsage(inputs, inputs.route === 'pro' ? 2 : 1)
  };
}

module.exports = { mockEval, safeParse };
