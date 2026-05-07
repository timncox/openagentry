'use strict';

// Bad fixture: checkAvailability() throws plain Error (not AgentryError) —
// fails domain/structured-errors. Other methods are stubs that also throw
// plain Error for consistency. The manifest declares llmDocs so docs/llm-md
// passes, isolating the failure to the structured-errors check.
const adapter = {
  category: 'domain',
  id: 'bad-domain',
  async checkAvailability(_domain) {
    throw new Error('bad: not AgentryError');
  },
  async purchase(_domain, _years) {
    throw new Error('bad: not AgentryError');
  },
  async listRecords(_domain) {
    throw new Error('bad: not AgentryError');
  },
  async setRecord(_domain, _record) {
    throw new Error('bad: not AgentryError');
  },
  async deleteRecord(_domain, _record) {
    throw new Error('bad: not AgentryError');
  },
  async initiateTransfer(_domain, _authCode) {
    throw new Error('bad: not AgentryError');
  },
};

// Exposed twice for CJS/ESM interop — same pattern as bad-email and good-host.
module.exports = adapter;
module.exports.default = adapter;
