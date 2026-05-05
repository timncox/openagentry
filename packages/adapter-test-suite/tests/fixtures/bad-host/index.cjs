'use strict';

// Bad fixture: minimal stub. Does not implement the full HostAdapter — the
// host functional suite will fail multiple checks against it.
const adapter = {
  category: 'host',
  id: 'bad-host',
  async createProject() {
    throw new Error('plain Error, not AgentryError'); // unstructured failure
  },
};

// Exposed twice — see good-host fixture for rationale.
module.exports = adapter;
module.exports.default = adapter;
