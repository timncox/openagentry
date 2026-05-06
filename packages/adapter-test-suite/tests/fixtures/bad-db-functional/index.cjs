'use strict';

let createCallCount = 0;
const adapter = {
  category: 'db',
  id: 'bad-db-functional',
  async createInstance(opts) {
    createCallCount += 1;
    return {
      id: 'instance-' + opts.slug,
      dbId: 'neon-' + createCallCount, // CHANGES per call → idempotency violation
      name: opts.name,
      slug: opts.slug,
      engine: opts.engine,
      region: opts.region ?? 'aws-us-east-2',
      createdAt: '2026-01-01T00:00:00Z',
    };
  },
  async destroyInstance() {
    // resolves on empty token → db/structured-errors fail
  },
  async connectionString() {
    return 'http://nope/'; // wrong protocol → db/connectionString fail
  },
  async exportState(inst) {
    return { version: 1, instance: inst, snapshotRef: '' };
  },
  async importState(bundle) {
    return { ...bundle.instance, dbId: 'CHANGED-dbId' }; // → db/exportState-importState fail
  },
};

module.exports = adapter;
module.exports.default = adapter;
