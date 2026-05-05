'use strict';

const { AgentryError } = require('@openagentry/core');

const projects = new Map();
const envs = new Map(); // key: `${hostId}:${env}` -> Record<string,string>
const deployments = new Map(); // key: hostId -> [Deployment...]

function nowIso() {
  return new Date().toISOString();
}

const adapter = {
  category: 'host',
  id: 'good-host',
  async createProject(opts) {
    const hostId = `proj_${opts.slug}`;
    const project = {
      id: hostId,
      hostId,
      name: opts.name,
      slug: opts.slug,
      createdAt: nowIso(),
      regions: opts.regions ?? [],
    };
    projects.set(hostId, project);
    return project;
  },
  async destroyProject(p, _confirm) {
    projects.delete(p.hostId);
  },
  async deploy(p, env) {
    const id = `dep_${p.hostId}_${Date.now()}`;
    const dep = {
      id,
      env,
      url: `https://${p.slug}-${env}.example.com`,
      status: 'success',
      createdAt: nowIso(),
    };
    const list = deployments.get(p.hostId) ?? [];
    list.push(dep);
    deployments.set(p.hostId, list);
    return dep;
  },
  async rollback(p, deploymentId) {
    const list = deployments.get(p.hostId) ?? [];
    const found = list.find((d) => d.id === deploymentId);
    if (!found) {
      throw new AgentryError({
        code: 'E_DEPLOYMENT_NOT_FOUND',
        message: `Deployment ${deploymentId} not found for project ${p.hostId}`,
        phase: 'rollback',
        adapter: 'good-host',
        suggestedFix: 'List deployments via `agentry list --json` and pick a valid id.',
        context: { deploymentId, hostId: p.hostId },
      });
    }
    return found;
  },
  async setEnv(p, vars, env) {
    const key = `${p.hostId}:${env}`;
    envs.set(key, { ...vars });
  },
  async getEnv(p, env) {
    const key = `${p.hostId}:${env}`;
    return { ...(envs.get(key) ?? {}) };
  },
  async attachDomain(p, domain) {
    return { domain, status: 'active' };
  },
  async detachDomain(_p, _domain) {},
  logs(_p) {
    return (async function* () {})();
  },
  async exportState(p) {
    const allEnvs = { preview: {}, prod: {}, dev: {} };
    for (const e of Object.keys(allEnvs)) {
      const key = `${p.hostId}:${e}`;
      allEnvs[e] = { ...(envs.get(key) ?? {}) };
    }
    return {
      version: 1,
      hostProject: { ...p },
      env: allEnvs,
      domains: [],
    };
  },
  async importState(bundle) {
    projects.set(bundle.hostProject.hostId, bundle.hostProject);
    for (const [env, vars] of Object.entries(bundle.env)) {
      envs.set(`${bundle.hostProject.hostId}:${env}`, { ...vars });
    }
    return bundle.hostProject;
  },
};

module.exports = adapter;
module.exports.default = adapter;
