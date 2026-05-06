'use strict';

// Default export claims category 'wiki' but the manifest claims 'host'.
// The runner dispatches based on manifest category, so the host suite
// loads — and getAdapterDefault('host') sees a non-host adapter, returning
// undefined and producing a single fail check.

const adapter = {
  category: 'wiki',
  id: 'bad-wiki',
  async list() { return []; },
  async read() { return ''; },
  async write(p) { return { path: p, status: 'created' }; },
  async append(p) { return { path: p, status: 'created' }; },
  async search() { return []; },
};

module.exports = adapter;
module.exports.default = adapter;
