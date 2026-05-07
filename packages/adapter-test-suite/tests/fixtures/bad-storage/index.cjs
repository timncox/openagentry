'use strict';

// Bad fixture: empty-key validation throws plain Error (not AgentryError) and
// list() doesn't filter by prefix and put({public:true}) returns a presigned-looking URL — all fail the suite.
const adapter = {
  category: 'storage',
  id: 'bad-storage',
  async put(key, _body, opts) {
    if (!key) throw new Error('bad: not AgentryError');
    const isPub = opts && opts.public === true;
    return {
      key,
      // bad: returns a presigned-looking URL even when caller asked for public
      url: isPub
        ? 'https://bad.example.com/' + key + '?X-Amz-Signature=deadbeef'
        : 'mem://x',
      size: 0,
      uploadedAt: new Date().toISOString(),
    };
  },
  async get(_key) {
    return null;
  },
  async delete(_key) {},
  list(_prefix) {
    return (async function* () {})();
  },
  getCapabilities() {
    return { supportsPublic: true };
  },
};

// Exposed twice — see good-host fixture for rationale.
module.exports = adapter;
module.exports.default = adapter;
