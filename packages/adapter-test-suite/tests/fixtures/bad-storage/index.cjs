'use strict';

// Bad fixture: empty-key validation throws plain Error (not AgentryError) and
// list() doesn't filter by prefix — both will fail the suite.
const adapter = {
  category: 'storage',
  id: 'bad-storage',
  async put(key, _body) {
    if (!key) throw new Error('bad: not AgentryError');
    return { key, url: 'mem://x', size: 0, uploadedAt: new Date().toISOString() };
  },
  async get(_key) {
    return null;
  },
  async delete(_key) {},
  list(_prefix) {
    return (async function* () {})();
  },
};

// Exposed twice — see good-host fixture for rationale.
module.exports = adapter;
module.exports.default = adapter;
