/**
 * @openagentry/adapter-host-cloudflare — public exports + lazy default export
 * resolved from CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
 *
 * Default export: a frozen HostAdapter whose async methods build (once) from
 * env on first call. `category` and `id` are static and never trigger env init.
 *
 * Async methods wrap buildFromEnv() in try/catch → Promise.reject so callers
 * always receive a rejected Promise rather than a synchronous throw when env
 * vars are missing (Plan K bug #2 pattern). `logs` is AsyncIterable — a
 * missing-env error is surfaced as an iterator that throws on first .next()
 * so `for await` consumers see the error in the natural async flow.
 *
 * `@openagentry/adapter-test-suite` resolves this default at conformance time.
 *
 * @module
 */

import { AgentryError } from '@openagentry/core';
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
import { createCloudflareHostAdapter } from './adapter.js';
import { readEnvConfig } from './env.js';
import { CF_ERROR_CODES, ADAPTER_ID } from './errors.js';

// ─── Public named exports ─────────────────────────────────────────────────────

export {
  createCloudflareHostAdapter,
  type CloudflareHostAdapter,
} from './adapter.js';
export {
  cloudflareConfigSchema,
  parseCloudflareConfig,
  type CloudflareConfig,
} from './config.js';
export { ADAPTER_ID, CF_ERROR_CODES } from './errors.js';

// ─── Lazy default ─────────────────────────────────────────────────────────────

let cached: HostAdapter | undefined;

/**
 * Build a CloudflareHostAdapter from env vars and memoize the result.
 *
 * Throws a synchronous AgentryError when required env vars are missing. The
 * lazy wrapper below converts this sync throw to Promise.reject for async
 * methods. `logs` returns a rejecting iterator instead.
 */
function buildFromEnv(): HostAdapter {
  if (cached !== undefined) return cached;
  const result = readEnvConfig(process.env);
  if (!result.ok) {
    throw new AgentryError({
      code: CF_ERROR_CODES.AUTH,
      phase: 'init',
      message: `Missing required env vars for ${ADAPTER_ID}: ${result.missing.join(', ')}`,
      context: { missing: result.missing },
      suggestedFix:
        `Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before using the default adapter. ` +
        `Alternatively call createCloudflareHostAdapter({ apiToken, accountId }) directly.`,
    });
  }
  cached = createCloudflareHostAdapter(result.config);
  return cached;
}

/**
 * Lazy default HostAdapter. Reads env vars on first async method call.
 * `category` and `id` are static — they never trigger env initialization.
 */
const lazyAdapter: HostAdapter = Object.freeze({
  category: 'host' as const,
  id: ADAPTER_ID,

  createProject(opts: CreateProjectOpts): Promise<HostProject> {
    try { return (cached ??= buildFromEnv()).createProject(opts); }
    catch (err) { return Promise.reject(err); }
  },

  destroyProject(p: HostProject, c: ConfirmToken): Promise<void> {
    try { return (cached ??= buildFromEnv()).destroyProject(p, c); }
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

  // logs is AsyncIterable — convert sync throw to a rejecting iterator.
  logs(p: HostProject, opts?: LogOpts): AsyncIterable<LogLine> {
    let iter: AsyncIterable<LogLine>;
    try {
      iter = (cached ??= buildFromEnv()).logs(p, opts);
    } catch (err) {
      return (async function* () {
        throw err;
      })();
    }
    return iter;
  },
});

export default lazyAdapter;
