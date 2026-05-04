'use strict';
// Exported as module.exports so that ESM dynamic import gives
// { default: <this object>, ...spread } — i.e. module.default === this object.
module.exports = {
  category: 'host',
  id: 'fake-host',
  async createProject(opts) { return { id: '1', name: opts.name, slug: opts.slug, createdAt: '2026-05-04T00:00:00Z', hostId: 'fh' }; },
  async destroyProject() {},
  async deploy() { return { id: 'd1', env: 'prod', url: 'https://x', status: 'success', createdAt: '2026-05-04T00:00:00Z' }; },
  async rollback() { return { id: 'd2', env: 'prod', url: 'https://x', status: 'success', createdAt: '2026-05-04T00:00:00Z' }; },
  async setEnv() {},
  async getEnv() { return {}; },
  async attachDomain() { return { domain: 'x', status: 'active' }; },
  async detachDomain() {},
  async *logs() { /* empty */ },
  async exportState() { return { version: 1, hostProject: { id: '1', name: 'x', slug: 'x', createdAt: '2026-05-04T00:00:00Z', hostId: 'fh' }, env: { preview: {}, prod: {}, dev: {} }, domains: [] }; },
  async importState(b) { return b.hostProject; }
};
