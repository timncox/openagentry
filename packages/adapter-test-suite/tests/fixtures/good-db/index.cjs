'use strict';

const adapter = {
  category: 'db',
  id: 'good-db',
  async createInstance(opts) {
    return {
      id: 'instance-' + opts.slug,
      dbId: 'neon-' + opts.slug,
      name: opts.name,
      slug: opts.slug,
      engine: opts.engine,
      region: opts.region ?? 'aws-us-east-2',
      createdAt: '2026-01-01T00:00:00Z',
    };
  },
  async destroyInstance(_inst, confirm) {
    if (!confirm || confirm.length === 0) {
      const err = new Error('Confirm token required.');
      err.name = 'AgentryError';
      err.code = 'E_DB_CONFIRM';
      err.phase = 'destroyInstance';
      err.adapter = 'good-db';
      throw err;
    }
  },
  async connectionString(_inst, _env) {
    return 'postgres://probe@localhost/probe';
  },
  async exportState(inst) {
    return {
      version: 1,
      instance: inst,
      snapshotRef: 'fixture:as-of:2026-01-01T00:00:00Z',
    };
  },
  async importState(bundle) {
    return bundle.instance;
  },
};

// Exposed twice — see good-host fixture for rationale.
module.exports = adapter;
module.exports.default = adapter;
