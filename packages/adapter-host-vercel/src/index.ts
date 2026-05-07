/**
 * @openagentry/adapter-host-vercel — public exports + lazy default export
 * resolved from OA_VERCEL_* env vars.
 *
 * Default export: a frozen HostAdapter whose methods build (once) from
 * OA_VERCEL_TOKEN (required) + OA_VERCEL_TEAM_ID / OA_VERCEL_ENDPOINT (optional).
 *
 * All 10 async methods wrap buildFromEnv() in try/catch → Promise.reject so that
 * callers always receive a rejected Promise rather than a synchronous throw when env
 * vars are missing (Plan K bug #2 pattern).
 *
 * `logs` is AsyncIterable — it cannot return Promise.reject. Instead a missing-env
 * error is surfaced as an iterator that throws on first .next() call, so
 * `for await (const line of adapter.logs(...))` sees an error naturally.
 *
 * @module
 */

import type {
  ConfirmToken,
  CreateProjectOpts,
  Deployment,
  DeployOpts,
  DomainAttachment,
  Env,
  HostAdapter,
  HostProject,
  HostStateBundle,
  LogLine,
  LogOpts,
} from '@openagentry/core';
import { createVercelHostAdapter } from './adapter.js';
import { readEnvConfig } from './env.js';
import { vercelError, VERCEL_ERROR_CODES, ADAPTER_ID } from './errors.js';

// ─── Public named exports ─────────────────────────────────────────────────────

export { createVercelHostAdapter } from './adapter.js';
export {
  parseVercelHostConfig,
  vercelHostConfigSchema,
  type VercelHostConfig,
  type VercelHostConfigInput,
  type VercelHostConfigParsed,
} from './config.js';
export {
  ADAPTER_ID,
  VERCEL_ERROR_CODES,
  type VercelErrorCode,
} from './errors.js';

// ─── Lazy default ─────────────────────────────────────────────────────────────

let cached: HostAdapter | undefined;

/**
 * Build a VercelHostAdapter from OA_VERCEL_* env vars and memoize the result.
 *
 * Throws a synchronous AgentryError when required env vars are missing or fail
 * validation. The lazy wrapper below converts this sync throw to Promise.reject
 * for async methods (Plan K bug #2). `logs` uses a rejecting iterator instead.
 */
function buildFromEnv(): HostAdapter {
  if (cached !== undefined) return cached;

  const result = readEnvConfig(process.env);
  if (!result.ok) {
    throw vercelError({
      code: VERCEL_ERROR_CODES.AUTH,
      phase: 'init',
      message: `Missing required env vars for adapter-host-vercel: ${result.missing.join(', ')}`,
      context: { missing: result.missing },
      suggestedFix:
        `Set OA_VERCEL_TOKEN in your environment before using the default adapter. ` +
        `Alternatively call createVercelHostAdapter(config) directly to provide config explicitly.`,
    });
  }

  cached = createVercelHostAdapter(result.config);
  return cached;
}

/**
 * Lazy default HostAdapter. Reads OA_VERCEL_TOKEN (+ optional OA_VERCEL_TEAM_ID,
 * OA_VERCEL_ENDPOINT) on first async method call and caches the result.
 *
 * `category` and `id` are static — they never trigger env initialization.
 */
const lazyAdapter: HostAdapter = Object.freeze({
  category: 'host' as const,
  id: ADAPTER_ID,

  // ── Async methods: Plan K bug #2 pattern ────────────────────────────────────
  // Each wraps buildFromEnv() in try/catch so callers always receive a Promise.

  createProject(opts: CreateProjectOpts): Promise<HostProject> {
    try { return (cached ??= buildFromEnv()).createProject(opts); }
    catch (err) { return Promise.reject(err); }
  },

  destroyProject(p: HostProject, confirm: ConfirmToken): Promise<void> {
    try { return (cached ??= buildFromEnv()).destroyProject(p, confirm); }
    catch (err) { return Promise.reject(err); }
  },

  deploy(p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts): Promise<Deployment> {
    try { return (cached ??= buildFromEnv()).deploy(p, env, opts); }
    catch (err) { return Promise.reject(err); }
  },

  rollback(p: HostProject, deploymentId: string): Promise<Deployment> {
    try { return (cached ??= buildFromEnv()).rollback(p, deploymentId); }
    catch (err) { return Promise.reject(err); }
  },

  setEnv(p: HostProject, vars: Record<string, string>, env: Env): Promise<void> {
    try { return (cached ??= buildFromEnv()).setEnv(p, vars, env); }
    catch (err) { return Promise.reject(err); }
  },

  getEnv(p: HostProject, env: Env): Promise<Record<string, string>> {
    try { return (cached ??= buildFromEnv()).getEnv(p, env); }
    catch (err) { return Promise.reject(err); }
  },

  attachDomain(p: HostProject, domain: string): Promise<DomainAttachment> {
    try { return (cached ??= buildFromEnv()).attachDomain(p, domain); }
    catch (err) { return Promise.reject(err); }
  },

  detachDomain(p: HostProject, domain: string): Promise<void> {
    try { return (cached ??= buildFromEnv()).detachDomain(p, domain); }
    catch (err) { return Promise.reject(err); }
  },

  exportState(p: HostProject): Promise<HostStateBundle> {
    try { return (cached ??= buildFromEnv()).exportState(p); }
    catch (err) { return Promise.reject(err); }
  },

  importState(bundle: HostStateBundle): Promise<HostProject> {
    try { return (cached ??= buildFromEnv()).importState(bundle); }
    catch (err) { return Promise.reject(err); }
  },

  // ── logs: AsyncIterable — cannot use Promise.reject ─────────────────────────
  // Convert a sync throw from buildFromEnv() into a rejecting async iterator so
  // `for await (const line of adapter.logs(...))` receives a proper error.
  logs(p: HostProject, opts?: LogOpts): AsyncIterable<LogLine> {
    let iter: AsyncIterable<LogLine>;
    try {
      iter = (cached ??= buildFromEnv()).logs(p, opts);
    } catch (err) {
      // Return an async generator that immediately throws.
      // This converts the sync env-init error into an iterator rejection so
      // consumers using `for await` see the error in the natural async flow.
      return (async function* () { throw err; })();
    }
    return iter;
  },
});

export default lazyAdapter;
