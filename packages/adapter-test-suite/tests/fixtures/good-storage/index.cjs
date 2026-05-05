'use strict';

const { AgentryError } = require('@openagentry/core');

const store = new Map();

function nowIso() {
  return new Date().toISOString();
}

const adapter = {
  category: 'storage',
  id: 'good-storage',
  async put(key, body, opts) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new AgentryError({
        code: 'E_STORAGE_BAD_KEY',
        message: 'put() requires a non-empty key.',
        phase: 'init',
        adapter: 'good-storage',
        suggestedFix: 'Pass a non-empty string as the first argument.',
      });
    }
    const size =
      typeof body === 'string'
        ? Buffer.byteLength(body)
        : body instanceof ArrayBuffer
          ? body.byteLength
          : body.byteLength;
    const obj = {
      key,
      url: `mem://${key}`,
      size,
      contentType: opts && opts.contentType,
      uploadedAt: nowIso(),
    };
    store.set(key, { obj, body });
    return obj;
  },
  async get(key) {
    const entry = store.get(key);
    return entry ? entry.obj : null;
  },
  async delete(key) {
    store.delete(key);
  },
  list(prefix) {
    const entries = Array.from(store.entries())
      .filter(([k]) => prefix === undefined || k.startsWith(prefix))
      .map(([, v]) => v.obj);
    return (async function* () {
      for (const o of entries) yield o;
    })();
  },
};

// Exposed twice — see good-host fixture for rationale.
module.exports = adapter;
module.exports.default = adapter;
