'use strict';

// In-memory WikiAdapter that satisfies the conformance suite without
// touching the filesystem. Stores files keyed by path in a Map. Routes
// 'workspace/...' and 'project/...' prefixes into separate scopes.

const ADAPTER_ID = 'good-wiki-functional';

function makeAgentryError(code, message, phase) {
  const err = new Error(message);
  err.name = 'AgentryError';
  err.code = code;
  err.phase = phase;
  err.adapter = ADAPTER_ID;
  return err;
}

const workspace = new Map(); // path -> { content, updatedAt }
const project = new Map();

function scopeOf(p) {
  if (p.startsWith('project/')) return 'project';
  return 'workspace';
}

function storeFor(scope) {
  return scope === 'project' ? project : workspace;
}

function titleOf(content, fallback) {
  const m = /^#\s+(.+?)\s*$/m.exec(content);
  if (m) return m[1];
  return fallback;
}

function snippet(content, query, length = 200) {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return content.slice(0, length);
  const half = Math.floor(length / 2);
  const start = Math.max(0, idx - half);
  return content.slice(start, start + length);
}

const adapter = {
  category: 'wiki',
  id: 'good-wiki-functional',
  async list(scope) {
    const s = scope ?? 'all';
    const out = [];
    if (s === 'workspace' || s === 'all') {
      for (const [p, v] of workspace.entries()) {
        out.push({ path: p, scope: 'workspace', title: titleOf(v.content, p), updatedAt: v.updatedAt });
      }
    }
    if (s === 'project' || s === 'all') {
      for (const [p, v] of project.entries()) {
        out.push({ path: p, scope: 'project', title: titleOf(v.content, p), updatedAt: v.updatedAt });
      }
    }
    return out;
  },
  async read(p) {
    const sc = scopeOf(p);
    const store = storeFor(sc);
    const v = store.get(p);
    if (v === undefined) {
      throw makeAgentryError('E_GOOD_WIKI_NOT_FOUND', `Page not found: ${p}`, 'read');
    }
    return v.content;
  },
  async write(p, content) {
    const sc = scopeOf(p);
    const store = storeFor(sc);
    const existed = store.has(p);
    const now = new Date().toISOString();
    if (existed && store.get(p).content === content) {
      return { path: p, status: 'unchanged' };
    }
    store.set(p, { content, updatedAt: now });
    return { path: p, status: existed ? 'updated' : 'created' };
  },
  async append(p, content) {
    const sc = scopeOf(p);
    const store = storeFor(sc);
    const existed = store.has(p);
    const now = new Date().toISOString();
    const prior = existed ? store.get(p).content : '';
    const nextContent = prior + (existed && !prior.endsWith('\n') ? '\n' : '') + content;
    store.set(p, { content: nextContent, updatedAt: now });
    return { path: p, status: existed ? 'updated' : 'created' };
  },
  async search(query, scope) {
    const s = scope ?? 'all';
    const out = [];
    const collect = (store, sc) => {
      for (const [p, v] of store.entries()) {
        const matches = v.content.toLowerCase().split(query.toLowerCase()).length - 1;
        if (matches > 0) {
          out.push({ path: p, scope: sc, snippet: snippet(v.content, query), score: matches });
        }
      }
    };
    if (s === 'workspace' || s === 'all') collect(workspace, 'workspace');
    if (s === 'project' || s === 'all') collect(project, 'project');
    return out.sort((a, b) => b.score - a.score);
  },
};

module.exports = adapter;
module.exports.default = adapter;
