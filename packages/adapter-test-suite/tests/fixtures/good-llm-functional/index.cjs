'use strict';

// Self-contained LlmAdapter that produces deterministic responses for the
// conformance test prompts. No subprocess, no network — just a switch over
// known prompts. Mirrors the good-auth pattern.

const ADAPTER_ID = 'good-llm-functional';

function makeAgentryError(code, message, phase) {
  const err = new Error(message);
  err.name = 'AgentryError';
  err.code = code;
  err.phase = phase;
  err.adapter = ADAPTER_ID;
  return err;
}

function pickResponse(prompt, system) {
  if (prompt === 'Say hi.') return 'hi from good-llm-functional';
  if (prompt === 'Echo system.') {
    return system != null && system.length > 0 ? system : 'no-system-provided';
  }
  if (prompt === 'Count to three.') return '1\n2\n3';
  if (prompt === 'error:nonzero') {
    throw makeAgentryError(
      'E_GOOD_LLM_NONZERO',
      'simulated nonzero exit for conformance test',
      'generate',
    );
  }
  return 'default-response';
}

const adapter = {
  category: 'llm',
  id: 'good-llm-functional',
  async listModels() {
    return [
      {
        id: 'good-llm-1',
        label: 'Good Stub Model 1',
        contextWindow: 128000,
        capabilities: { tools: false, streaming: true, vision: false },
      },
    ];
  },
  async generate(prompt, opts) {
    const system = opts && typeof opts === 'object' ? opts.system : undefined;
    const text = pickResponse(prompt, system);
    return { text, model: 'good-llm-1', usage: { inputTokens: 10, outputTokens: 5 } };
  },
  async *stream(prompt, opts) {
    const system = opts && typeof opts === 'object' ? opts.system : undefined;
    let text;
    try {
      text = pickResponse(prompt, system);
    } catch (err) {
      yield { type: 'error', message: err.message };
      return;
    }
    for (const line of text.split('\n')) {
      yield { type: 'text', text: line };
    }
    yield { type: 'done', usage: { inputTokens: 10, outputTokens: 5 } };
  },
};

module.exports = adapter;
module.exports.default = adapter;
