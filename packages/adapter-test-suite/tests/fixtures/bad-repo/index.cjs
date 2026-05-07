'use strict';

// Bad fixture: all methods throw plain Error (not AgentryError) —
// fails repo/structured-errors. The manifest declares llmDocs so
// docs/llm-md passes, isolating the failure to the structured-errors check.
const adapter = {
  category: 'repo',
  id: 'bad-repo',
  async create(_opts) {
    throw new Error('bad: not AgentryError');
  },
  async delete(_repo, _confirm) {
    throw new Error('bad: not AgentryError');
  },
  async get(_owner, _name) {
    throw new Error('bad: not AgentryError');
  },
  remoteUrl(_repo, _mode) {
    throw new Error('bad: not AgentryError');
  },
};

// Exposed twice for CJS/ESM interop — same pattern as bad-domain and bad-email.
module.exports = adapter;
module.exports.default = adapter;
