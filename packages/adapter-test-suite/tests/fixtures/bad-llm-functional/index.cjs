'use strict';

// Manifest correctly claims llm; default export has category llm. But the
// methods break every functional check:
//   listModels: returns empty array
//   generate (Say hi): returns empty text
//   generate (Echo system): does not surface the system marker
//   stream: emits text but never done
//   generate (error:nonzero): throws plain Error (not AgentryError)

const adapter = {
  category: 'llm',
  id: 'bad-llm-functional',
  async listModels() {
    return [];
  },
  async generate(prompt) {
    if (prompt === 'error:nonzero') {
      throw new Error('plain error from bad-llm-functional');
    }
    return { text: '', model: 'bad' };
  },
  async *stream() {
    yield { type: 'text', text: 'partial-1' };
    yield { type: 'text', text: 'partial-2' };
    // Intentionally never yields { type: 'done' } — but the iterable now
    // ends naturally so the conformance loop terminates.
  },
};

module.exports = adapter;
module.exports.default = adapter;
