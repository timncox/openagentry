'use strict';

// Default export claims category 'llm' but the manifest claims 'host'.
// The runner dispatches based on manifest category, so the host suite
// loads — and getAdapterDefault('host') sees a non-host adapter, returning
// undefined and producing a single fail check.

const adapter = {
  category: 'llm',
  id: 'bad-llm',
  async listModels() {
    return [];
  },
  async generate() {
    return { text: '', model: 'bad' };
  },
  async *stream() {
    yield { type: 'done' };
  },
};

module.exports = adapter;
module.exports.default = adapter;
