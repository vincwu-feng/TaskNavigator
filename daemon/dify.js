const mock = require('./mock-data');

async function runWorkflow(name, inputs, config) {
  const dify = config.dify;
  if (dify.mock) return mockResult(name, inputs);

  const key = (dify.apiKeys && dify.apiKeys[name]) || '';
  if (!key) {
    if (dify.fallbackToMock) return mockResult(name, inputs);
    throw new Error(`dify api key missing for workflow "${name}"`);
  }

  const url = String(dify.baseUrl).replace(/\/+$/, '') + '/v1/workflows/run';
  const controller = new AbortController();
  // The evaluation workflow runs an LLM and has been measured at 7-18s, so a
  // 15s ceiling aborted real runs and left rounds unevaluated.
  const timeoutMs = Math.max(5000, Number(dify.timeoutMs) || 45000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({ inputs, response_mode: 'blocking', user: 'tasknavigator' }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`dify http ${res.status}: ${String(errText).slice(0, 500)}`);
    }
    const data = await res.json();
    return normalize(name, data);
  } catch (err) {
    if (dify.fallbackToMock) return mockResult(name, inputs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function mockResult(name, inputs) {
  const r = mock['mock' + name[0].toUpperCase() + name.slice(1)](inputs);
  return {
    mock: true,
    outputs: pickStructured(r.outputs || {}),
    usage: r.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    elapsed_time: 0.05,
    status: 'succeeded'
  };
}

function normalize(name, data) {
  const d = data && data.data ? data.data : {};
  const rawUsage = d.usage || {};
  const total = rawUsage.total_tokens ?? d.total_tokens ?? 0;
  const usage = {
    prompt_tokens: rawUsage.prompt_tokens ?? 0,
    completion_tokens: rawUsage.completion_tokens ?? 0,
    total_tokens: total
  };
  return {
    mock: false,
    outputs: pickStructured(d.outputs || {}),
    usage,
    elapsed_time: d.elapsed_time || 0,
    status: d.status || 'succeeded'
  };
}

function pickStructured(outputs) {
  const preferred = ['eval_result', 'result', 'eval_json', 'result_Fast', 'result_Pro'];
  for (const k of preferred) {
    if (outputs[k] !== undefined && outputs[k] !== null && outputs[k] !== '') {
      const parsed = tryParse(outputs[k]);
      if (parsed !== null && typeof parsed === 'object') return parsed;
      if (typeof outputs[k] === 'object') return outputs[k];
    }
  }
  for (const k of Object.keys(outputs)) {
    const v = outputs[k];
    if (typeof v === 'object' && v !== null) return v;
    if (typeof v === 'string') {
      const parsed = tryParse(v);
      if (parsed !== null && typeof parsed === 'object') return parsed;
    }
  }
  return outputs;
}

function tryParse(v) {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
}

module.exports = { runWorkflow };
