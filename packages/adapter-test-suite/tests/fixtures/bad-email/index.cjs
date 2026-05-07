'use strict';

// Bad fixture: send() throws plain Error (not AgentryError) — fails
// email/structured-errors. Manifest declares no llmDocs — fails docs/llm-md.
const adapter = {
  category: 'email',
  id: 'bad-email',
  async send(_message) {
    throw new Error('bad: not AgentryError');
  },
};

// Exposed twice — see good-host fixture for rationale (CJS/ESM interop).
module.exports = adapter;
module.exports.default = adapter;
