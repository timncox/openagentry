'use strict';

const adapter = {
  category: 'host', // intentionally wrong — db/createInstance bootstrap should catch this first
  id: 'bad-db',
  async createInstance() {
    throw new Error('plain error not AgentryError');
  },
  async destroyInstance() {
    // resolves successfully — would fail db/structured-errors if reached
  },
  async connectionString() {
    return 'http://nope/'; // wrong protocol — would fail db/connectionString if reached
  },
  async exportState(inst) {
    return { version: 1, instance: inst, snapshotRef: '' };
  },
  async importState(bundle) {
    return bundle.instance;
  },
};
module.exports = adapter;
