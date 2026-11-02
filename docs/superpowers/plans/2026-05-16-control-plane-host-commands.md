# Control Plane: Host Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 host-management CLI commands (`host:deploy`, `host:set-env`, `host:get-env`, `host:attach-domain`, `host:logs`) to `@openagentry/cli`, plus a startup bootstrap that registers a `HostAdapter` from env vars. These commands auto-expose as MCP tools through the existing `@openagentry/mcp` reflection — producing an LLM-native hosting control plane on top of any registered host adapter (Vercel, Cloudflare).

**Architecture:** The openagentry monorepo already has `HostAdapter` (core), `adapter-host-vercel`, `adapter-host-cloudflare`, the global adapter registry (`useAdapter` / `registerAdapter`), and a meta-MCP server that reflects every CLI command into an MCP tool. We add commands that resolve `useAdapter<HostAdapter>('host')` and delegate. A new bootstrap module (`src/runtime/host-bootstrap.ts`) reads env vars and registers the appropriate adapter on first command-dispatch. No new packages; no changes to `@openagentry/mcp`.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, tsup. Pattern-match exactly on the existing `initCommand` and its tests for style.

---

## File Structure

**New files** (all under `packages/cli/`):
- `src/runtime/host-bootstrap.ts` — env-var → HostAdapter registration (one function, idempotent)
- `src/commands/host-deploy.ts` — `agentry host:deploy <project-slug> --env preview|prod`
- `src/commands/host-set-env.ts` — `agentry host:set-env <project-slug> KEY=value... --env all|preview|prod|dev`
- `src/commands/host-get-env.ts` — `agentry host:get-env <project-slug> --env preview|prod|dev`
- `src/commands/host-attach-domain.ts` — `agentry host:attach-domain <project-slug> <domain>`
- `src/commands/host-logs.ts` — `agentry host:logs <project-slug> [--tail] [--since ISO] [--deployment <id>]`
- `tests/runtime/host-bootstrap.test.ts`
- `tests/commands/host-deploy.test.ts`
- `tests/commands/host-set-env.test.ts`
- `tests/commands/host-get-env.test.ts`
- `tests/commands/host-attach-domain.test.ts`
- `tests/commands/host-logs.test.ts`
- `tests/fixtures/fake-host-adapter.ts` — in-memory `HostAdapter` for unit tests
- `tests/integration/mcp-reflection.test.ts` — verifies `@openagentry/mcp` exposes the 5 new tools

**Modified files:**
- `packages/cli/src/commands/index.ts` — register the 5 new commands; call `ensureHostAdapter()` before dispatch
- `packages/cli/src/dispatcher.ts` — call `ensureHostAdapter()` once at dispatch entry (idempotent)
- `packages/cli/package.json` — add peer or optional `@openagentry/adapter-host-vercel` and `@openagentry/adapter-host-cloudflare` (workspace, dynamic import — see Task 1 for rationale)

---

## Task 0: Worktree + branch

- [ ] **Step 1: Enter isolated worktree**

Use the `EnterWorktree` tool from this repo root (`/Users/timcox/tim-os/openagentry`) with a branch name like `control-plane-host-commands`.

- [ ] **Step 2: Verify clean baseline**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm install && pnpm -r --filter @openagentry/cli run test`
Expected: PASS (all existing CLI tests green). If failures, stop and report — don't proceed.

- [ ] **Step 3: Commit nothing yet** (no changes made)

---

## Task 1: Fake HostAdapter test fixture

A reusable in-memory HostAdapter for unit-testing the new commands without hitting Vercel/Cloudflare.

**Files:**
- Create: `packages/cli/tests/fixtures/fake-host-adapter.ts`

- [ ] **Step 1: Create the fixture file**

```typescript
// packages/cli/tests/fixtures/fake-host-adapter.ts
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

export interface FakeHostState {
  projects: Map<string, HostProject>;
  env: Map<string, Record<Env, Record<string, string>>>;
  domains: Map<string, DomainAttachment[]>;
  deployments: Deployment[];
  logs: LogLine[];
}

export function createFakeHostAdapter(initial?: Partial<FakeHostState>): {
  adapter: HostAdapter;
  state: FakeHostState;
} {
  const state: FakeHostState = {
    projects: initial?.projects ?? new Map(),
    env: initial?.env ?? new Map(),
    domains: initial?.domains ?? new Map(),
    deployments: initial?.deployments ?? [],
    logs: initial?.logs ?? [],
  };

  const adapter: HostAdapter = Object.freeze({
    category: 'host' as const,
    id: 'host-fake',

    async createProject(opts: CreateProjectOpts): Promise<HostProject> {
      const project: HostProject = {
        id: `proj_${opts.slug}`,
        slug: opts.slug,
        name: opts.name,
        hostId: `host_${opts.slug}`,
      };
      state.projects.set(opts.slug, project);
      return project;
    },

    async destroyProject(_p: HostProject, _confirm: ConfirmToken): Promise<void> {
      state.projects.delete(_p.slug);
    },

    async deploy(p: HostProject, env: 'preview' | 'prod', opts?: DeployOpts): Promise<Deployment> {
      const dep: Deployment = {
        id: `dep_${state.deployments.length + 1}`,
        projectId: p.id,
        env,
        ref: opts?.ref ?? 'HEAD',
        url: `https://${p.slug}-${env}.example.com`,
        status: 'ready',
        createdAt: new Date().toISOString(),
      };
      state.deployments.push(dep);
      return dep;
    },

    async rollback(p: HostProject, deploymentId: string): Promise<Deployment> {
      const found = state.deployments.find((d) => d.id === deploymentId);
      if (!found) throw new Error(`Deployment ${deploymentId} not found`);
      return found;
    },

    async setEnv(p: HostProject, vars: Record<string, string>, env: Env): Promise<void> {
      const current = state.env.get(p.slug) ?? ({} as Record<Env, Record<string, string>>);
      current[env] = { ...(current[env] ?? {}), ...vars };
      state.env.set(p.slug, current);
    },

    async getEnv(p: HostProject, env: Env): Promise<Record<string, string>> {
      return state.env.get(p.slug)?.[env] ?? {};
    },

    async attachDomain(p: HostProject, domain: string): Promise<DomainAttachment> {
      const attachment: DomainAttachment = { domain, status: 'active' };
      const existing = state.domains.get(p.slug) ?? [];
      existing.push(attachment);
      state.domains.set(p.slug, existing);
      return attachment;
    },

    async detachDomain(p: HostProject, domain: string): Promise<void> {
      const existing = state.domains.get(p.slug) ?? [];
      state.domains.set(
        p.slug,
        existing.filter((d) => d.domain !== domain),
      );
    },

    async *logs(_p: HostProject, _opts?: LogOpts): AsyncIterable<LogLine> {
      for (const line of state.logs) yield line;
    },

    async exportState(p: HostProject): Promise<HostStateBundle> {
      return {
        version: 1,
        hostProject: p,
        env: (state.env.get(p.slug) ?? {}) as Record<Env, Record<string, string>>,
        domains: (state.domains.get(p.slug) ?? []).map((d) => d.domain),
      };
    },

    async importState(bundle: HostStateBundle): Promise<HostProject> {
      state.projects.set(bundle.hostProject.slug, bundle.hostProject);
      state.env.set(bundle.hostProject.slug, bundle.env);
      state.domains.set(
        bundle.hostProject.slug,
        bundle.domains.map((d) => ({ domain: d, status: 'active' })),
      );
      return bundle.hostProject;
    },
  });

  return { adapter, state };
}
```

- [ ] **Step 2: Type-check**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli run typecheck`
Expected: PASS (this fixture compiles cleanly against the core HostAdapter interface).

- [ ] **Step 3: Commit**

```bash
git add packages/cli/tests/fixtures/fake-host-adapter.ts
git commit -m "test(cli): add in-memory fake HostAdapter fixture for host commands"
```

---

## Task 2: Host bootstrap (env-var → registerAdapter)

A single-call bootstrap that registers a `HostAdapter` in the global registry based on env vars. Idempotent (safe to call multiple times). Called by `dispatcher.ts` before any command runs.

**Decision:** v1 supports only `host-vercel` and `host-cloudflare`. Preference order: explicit `OA_HOST` env var (`"vercel"` / `"cloudflare"`), else first one whose required env is set. Adapters are **dynamically imported** so the CLI doesn't hard-require either adapter package — workspaces with neither installed still work for non-host commands.

**Files:**
- Create: `packages/cli/src/runtime/host-bootstrap.ts`
- Test: `packages/cli/tests/runtime/host-bootstrap.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/runtime/host-bootstrap.test.ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { resetRegistryForTesting, useAdapter } from '@openagentry/core';

// We import dynamically inside each test so module-level state is fresh.
beforeEach(() => {
  resetRegistryForTesting();
  vi.resetModules();
});
afterEach(() => {
  resetRegistryForTesting();
});

describe('ensureHostAdapter', () => {
  it('is a no-op when no host env vars are set', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({});
    expect(() => useAdapter('host')).toThrow(/E_NO_ADAPTER_FOR_CATEGORY/);
  });

  it('registers vercel adapter when OA_VERCEL_TOKEN is set', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({ OA_VERCEL_TOKEN: 'tok_test' });
    const adapter = useAdapter<{ id: string }>('host');
    expect(adapter.id).toBe('host-vercel');
  });

  it('honors OA_HOST=cloudflare when both providers configured', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({
      OA_HOST: 'cloudflare',
      OA_VERCEL_TOKEN: 'tok_test',
      OA_CLOUDFLARE_API_TOKEN: 'cf_tok',
      OA_CLOUDFLARE_ACCOUNT_ID: 'acct_test',
    });
    const adapter = useAdapter<{ id: string }>('host');
    expect(adapter.id).toBe('host-cloudflare');
  });

  it('is idempotent — second call does not re-register', async () => {
    const { ensureHostAdapter } = await import('../../src/runtime/host-bootstrap.js');
    await ensureHostAdapter({ OA_VERCEL_TOKEN: 'tok_test' });
    await ensureHostAdapter({ OA_VERCEL_TOKEN: 'tok_test_changed' });
    const adapter = useAdapter<{ id: string }>('host');
    expect(adapter.id).toBe('host-vercel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/runtime/host-bootstrap.test.ts`
Expected: FAIL — module `../../src/runtime/host-bootstrap.js` does not exist.

- [ ] **Step 3: Implement `host-bootstrap.ts`**

```typescript
// packages/cli/src/runtime/host-bootstrap.ts
/**
 * Host adapter bootstrap. Registers a `HostAdapter` in the global registry
 * based on env vars. Called once per CLI process before command dispatch.
 *
 * Preference order:
 *   1. OA_HOST="vercel" | "cloudflare" — explicit selection
 *   2. First provider whose required env is set (vercel before cloudflare)
 *   3. No registration (caller gets E_NO_ADAPTER_FOR_CATEGORY on useAdapter)
 *
 * Adapters are dynamically imported so a workspace without an adapter package
 * installed still runs non-host commands.
 *
 * @module
 */

import { registerAdapter } from '@openagentry/core';

type EnvMap = Readonly<Record<string, string | undefined>>;

let registered = false;

export function _resetForTesting(): void {
  registered = false;
}

function hasVercelEnv(env: EnvMap): boolean {
  return typeof env.OA_VERCEL_TOKEN === 'string' && env.OA_VERCEL_TOKEN.length > 0;
}

function hasCloudflareEnv(env: EnvMap): boolean {
  return (
    typeof env.OA_CLOUDFLARE_API_TOKEN === 'string' &&
    env.OA_CLOUDFLARE_API_TOKEN.length > 0 &&
    typeof env.OA_CLOUDFLARE_ACCOUNT_ID === 'string' &&
    env.OA_CLOUDFLARE_ACCOUNT_ID.length > 0
  );
}

function pickProvider(env: EnvMap): 'vercel' | 'cloudflare' | undefined {
  const explicit = env.OA_HOST;
  if (explicit === 'vercel' || explicit === 'cloudflare') return explicit;
  if (hasVercelEnv(env)) return 'vercel';
  if (hasCloudflareEnv(env)) return 'cloudflare';
  return undefined;
}

export async function ensureHostAdapter(env: EnvMap): Promise<void> {
  if (registered) return;
  const provider = pickProvider(env);
  if (provider === undefined) {
    // No env vars set — leave registry empty. Host commands will surface a
    // clear E_NO_ADAPTER_FOR_CATEGORY error when invoked.
    return;
  }

  if (provider === 'vercel') {
    const mod = await import('@openagentry/adapter-host-vercel');
    registerAdapter('host', mod.default);
    registered = true;
    return;
  }

  // provider === 'cloudflare'
  const mod = await import('@openagentry/adapter-host-cloudflare');
  registerAdapter('host', mod.default);
  registered = true;
}
```

- [ ] **Step 4: Add workspace deps so dynamic import resolves**

Edit `packages/cli/package.json` — add to `dependencies`:

```json
{
  "dependencies": {
    "@openagentry/adapter-host-vercel": "workspace:*",
    "@openagentry/adapter-host-cloudflare": "workspace:*"
  }
}
```

(Append; don't replace existing deps. Run `pnpm install` after.)

Run: `cd /Users/timcox/tim-os/openagentry && pnpm install`
Expected: lockfile updates; no errors.

- [ ] **Step 5: Update the test to reset bootstrap state between tests**

Edit `packages/cli/tests/runtime/host-bootstrap.test.ts` — change the `beforeEach`:

```typescript
beforeEach(async () => {
  resetRegistryForTesting();
  vi.resetModules();
  // Reset bootstrap's `registered` flag.
  const mod = await import('../../src/runtime/host-bootstrap.js');
  mod._resetForTesting();
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/runtime/host-bootstrap.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/runtime/host-bootstrap.ts packages/cli/tests/runtime/host-bootstrap.test.ts packages/cli/package.json
git add ../../pnpm-lock.yaml 2>/dev/null || git add /Users/timcox/tim-os/openagentry/pnpm-lock.yaml
git commit -m "feat(cli): add ensureHostAdapter bootstrap that wires HostAdapter from env"
```

---

## Task 3: `host:deploy` command

**Files:**
- Create: `packages/cli/src/commands/host-deploy.ts`
- Test: `packages/cli/tests/commands/host-deploy.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/commands/host-deploy.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { registerAdapter, resetRegistryForTesting } from '@openagentry/core';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';
import { createFakeHostAdapter } from '../fixtures/fake-host-adapter.js';

function captureStream(): { stream: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  return { stream, chunks };
}

beforeEach(() => {
  resetRegistryForTesting();
});
afterEach(() => {
  resetRegistryForTesting();
});

describe('agentry host:deploy', () => {
  it('deploys a registered project to the requested env and prints the URL', async () => {
    const { adapter, state } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);

    const out = captureStream();
    const code = await dispatch(
      ['host:deploy', 'my-site', '--env', 'prod'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );

    expect(code).toBe(0);
    expect(out.chunks.join('')).toContain('https://my-site-prod.example.com');
    expect(state.deployments).toHaveLength(1);
    expect(state.deployments[0].env).toBe('prod');
  });

  it('defaults --env to preview', async () => {
    const { adapter, state } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);

    const out = captureStream();
    const code = await dispatch(
      ['host:deploy', 'my-site'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
    expect(state.deployments[0].env).toBe('preview');
  });

  it('errors when no host adapter is registered', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(
      ['host:deploy', 'my-site'],
      { stdout: out.stream, stderr: err.stream, cwd: process.cwd() },
    );
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_NO_ADAPTER_FOR_CATEGORY');
  });

  it('errors with E_MISSING_ARG when slug is omitted', async () => {
    const { adapter } = createFakeHostAdapter();
    registerAdapter('host', adapter);
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(
      ['host:deploy'],
      { stdout: out.stream, stderr: err.stream, cwd: process.cwd() },
    );
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_MISSING_ARG');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-deploy.test.ts`
Expected: FAIL — unknown command `host:deploy`.

- [ ] **Step 3: Implement `host-deploy.ts`**

```typescript
// packages/cli/src/commands/host-deploy.ts
/**
 * `agentry host:deploy <project-slug> [--env preview|prod]` — deploy via
 * the registered HostAdapter.
 *
 * @module
 */

import { AgentryError, useAdapter, type HostAdapter } from '@openagentry/core';
import { defineCommand } from '../command.js';

function parseEnv(raw: unknown): 'preview' | 'prod' {
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'preview' || raw === undefined) return 'preview';
  throw new AgentryError({
    code: 'E_INVALID_ARG',
    message: `Invalid --env "${String(raw)}". Use "preview" or "prod".`,
    phase: 'init',
    suggestedFix: `agentry host:deploy <slug> --env preview`,
  });
}

export const hostDeployCommand = defineCommand({
  name: 'host:deploy',
  summary: 'Deploy a project via the registered host adapter.',
  async run(args, output) {
    const slug = args.positional[0];
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:deploy <project-slug> --env preview|prod`,
      });
    }
    const env = parseEnv(args.flags['env']);
    const adapter = useAdapter<HostAdapter>('host');

    // Minimal Project: callers may have already created it; we look it up by
    // re-creating with the same slug is incorrect — instead we pass a minimal
    // HostProject reconstructed from the slug. Adapters that need richer state
    // can resolve from slug internally.
    const project = { id: `proj_${slug}`, slug, name: slug, hostId: `host_${slug}` };

    const deployment = await adapter.deploy(project, env);

    output.text(`Deployed ${slug} to ${env}: ${deployment.url ?? deployment.id}`);
    output.json({
      slug,
      env,
      deploymentId: deployment.id,
      url: deployment.url,
      status: deployment.status,
    });
    return 0;
  },
});
```

- [ ] **Step 4: Register the command**

Edit `packages/cli/src/commands/index.ts` — add import + registration:

```typescript
import { hostDeployCommand } from './host-deploy.js';
// ... other imports ...
registerCommand(hostDeployCommand);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-deploy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/host-deploy.ts packages/cli/src/commands/index.ts packages/cli/tests/commands/host-deploy.test.ts
git commit -m "feat(cli): add host:deploy command wrapping HostAdapter.deploy"
```

---

## Task 4: `host:set-env` command

**Files:**
- Create: `packages/cli/src/commands/host-set-env.ts`
- Test: `packages/cli/tests/commands/host-set-env.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/commands/host-set-env.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { registerAdapter, resetRegistryForTesting } from '@openagentry/core';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';
import { createFakeHostAdapter } from '../fixtures/fake-host-adapter.js';

function captureStream(): { stream: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  return { stream, chunks };
}

beforeEach(() => { resetRegistryForTesting(); });
afterEach(() => { resetRegistryForTesting(); });

describe('agentry host:set-env', () => {
  it('sets KEY=value pairs on the project for the requested env', async () => {
    const { adapter, state } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);

    const out = captureStream();
    const code = await dispatch(
      ['host:set-env', 'my-site', 'DATABASE_URL=postgres://x', 'NODE_ENV=production', '--env', 'prod'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
    expect(state.env.get('my-site')?.prod).toEqual({
      DATABASE_URL: 'postgres://x',
      NODE_ENV: 'production',
    });
  });

  it('rejects malformed KEY=value pairs', async () => {
    const { adapter } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);

    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(
      ['host:set-env', 'my-site', 'BAD_NO_EQUALS', '--env', 'prod'],
      { stdout: out.stream, stderr: err.stream, cwd: process.cwd() },
    );
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_INVALID_ARG');
  });

  it('defaults --env to dev', async () => {
    const { adapter, state } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);
    const out = captureStream();
    const code = await dispatch(
      ['host:set-env', 'my-site', 'FOO=bar'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
    expect(state.env.get('my-site')?.dev).toEqual({ FOO: 'bar' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-set-env.test.ts`
Expected: FAIL — unknown command `host:set-env`.

- [ ] **Step 3: Implement `host-set-env.ts`**

```typescript
// packages/cli/src/commands/host-set-env.ts
/**
 * `agentry host:set-env <slug> KEY=value... [--env preview|prod|dev]` —
 * write env vars to the registered HostAdapter.
 *
 * @module
 */

import { AgentryError, useAdapter, type Env, type HostAdapter } from '@openagentry/core';
import { defineCommand } from '../command.js';

function parseEnv(raw: unknown): Env {
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'preview') return 'preview';
  if (raw === 'dev' || raw === undefined) return 'dev';
  throw new AgentryError({
    code: 'E_INVALID_ARG',
    message: `Invalid --env "${String(raw)}". Use "dev", "preview", or "prod".`,
    phase: 'init',
    suggestedFix: `agentry host:set-env <slug> KEY=value --env prod`,
  });
}

function parsePairs(pairs: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    const eq = p.indexOf('=');
    if (eq <= 0) {
      throw new AgentryError({
        code: 'E_INVALID_ARG',
        message: `Malformed env pair "${p}". Expected KEY=value.`,
        phase: 'init',
        suggestedFix: `agentry host:set-env <slug> DATABASE_URL=postgres://...`,
      });
    }
    out[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return out;
}

export const hostSetEnvCommand = defineCommand({
  name: 'host:set-env',
  summary: 'Set environment variables on a project via the registered host adapter.',
  async run(args, output) {
    const [slug, ...pairs] = args.positional;
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:set-env <slug> KEY=value [--env prod]`,
      });
    }
    if (pairs.length === 0) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'No KEY=value pairs supplied.',
        phase: 'init',
        suggestedFix: `agentry host:set-env <slug> KEY=value`,
      });
    }
    const env = parseEnv(args.flags['env']);
    const vars = parsePairs(pairs);
    const adapter = useAdapter<HostAdapter>('host');
    const project = { id: `proj_${slug}`, slug, name: slug, hostId: `host_${slug}` };
    await adapter.setEnv(project, vars, env);

    output.text(`Set ${Object.keys(vars).length} var(s) on ${slug} (${env}).`);
    output.json({ slug, env, keys: Object.keys(vars) });
    return 0;
  },
});
```

- [ ] **Step 4: Register the command**

Edit `packages/cli/src/commands/index.ts`:

```typescript
import { hostSetEnvCommand } from './host-set-env.js';
// ...
registerCommand(hostSetEnvCommand);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-set-env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/host-set-env.ts packages/cli/src/commands/index.ts packages/cli/tests/commands/host-set-env.test.ts
git commit -m "feat(cli): add host:set-env command wrapping HostAdapter.setEnv"
```

---

## Task 5: `host:get-env` command

**Files:**
- Create: `packages/cli/src/commands/host-get-env.ts`
- Test: `packages/cli/tests/commands/host-get-env.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/commands/host-get-env.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { registerAdapter, resetRegistryForTesting } from '@openagentry/core';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';
import { createFakeHostAdapter } from '../fixtures/fake-host-adapter.js';

function captureStream(): { stream: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) { chunks.push(String(chunk)); cb(); },
  });
  return { stream, chunks };
}

beforeEach(() => { resetRegistryForTesting(); });
afterEach(() => { resetRegistryForTesting(); });

describe('agentry host:get-env', () => {
  it('returns existing env vars for the requested scope', async () => {
    const { adapter } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    const project = { id: 'proj_my-site', slug: 'my-site', name: 'my-site', hostId: 'host_my-site' };
    await adapter.setEnv(project, { FOO: 'bar', BAZ: 'qux' }, 'prod');
    registerAdapter('host', adapter);

    const out = captureStream();
    const code = await dispatch(
      ['host:get-env', 'my-site', '--env', 'prod'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
    const joined = out.chunks.join('');
    expect(joined).toContain('FOO=bar');
    expect(joined).toContain('BAZ=qux');
  });

  it('returns nothing (exit 0, no keys) when no vars set', async () => {
    const { adapter } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);
    const out = captureStream();
    const code = await dispatch(
      ['host:get-env', 'my-site', '--env', 'prod'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-get-env.test.ts`
Expected: FAIL — unknown command.

- [ ] **Step 3: Implement `host-get-env.ts`**

```typescript
// packages/cli/src/commands/host-get-env.ts
/**
 * `agentry host:get-env <slug> [--env preview|prod|dev]` — read env vars
 * from the registered HostAdapter.
 *
 * @module
 */

import { AgentryError, useAdapter, type Env, type HostAdapter } from '@openagentry/core';
import { defineCommand } from '../command.js';

function parseEnv(raw: unknown): Env {
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'preview') return 'preview';
  if (raw === 'dev' || raw === undefined) return 'dev';
  throw new AgentryError({
    code: 'E_INVALID_ARG',
    message: `Invalid --env "${String(raw)}".`,
    phase: 'init',
    suggestedFix: `agentry host:get-env <slug> --env prod`,
  });
}

export const hostGetEnvCommand = defineCommand({
  name: 'host:get-env',
  summary: 'Read environment variables from a project via the registered host adapter.',
  async run(args, output) {
    const slug = args.positional[0];
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:get-env <slug> --env prod`,
      });
    }
    const env = parseEnv(args.flags['env']);
    const adapter = useAdapter<HostAdapter>('host');
    const project = { id: `proj_${slug}`, slug, name: slug, hostId: `host_${slug}` };
    const vars = await adapter.getEnv(project, env);

    for (const [k, v] of Object.entries(vars)) {
      output.text(`${k}=${v}`);
    }
    output.json({ slug, env, vars });
    return 0;
  },
});
```

- [ ] **Step 4: Register the command**

Edit `packages/cli/src/commands/index.ts`:

```typescript
import { hostGetEnvCommand } from './host-get-env.js';
// ...
registerCommand(hostGetEnvCommand);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-get-env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/host-get-env.ts packages/cli/src/commands/index.ts packages/cli/tests/commands/host-get-env.test.ts
git commit -m "feat(cli): add host:get-env command wrapping HostAdapter.getEnv"
```

---

## Task 6: `host:attach-domain` command

**Files:**
- Create: `packages/cli/src/commands/host-attach-domain.ts`
- Test: `packages/cli/tests/commands/host-attach-domain.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/commands/host-attach-domain.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { registerAdapter, resetRegistryForTesting } from '@openagentry/core';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';
import { createFakeHostAdapter } from '../fixtures/fake-host-adapter.js';

function captureStream(): { stream: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) { chunks.push(String(chunk)); cb(); },
  });
  return { stream, chunks };
}

beforeEach(() => { resetRegistryForTesting(); });
afterEach(() => { resetRegistryForTesting(); });

describe('agentry host:attach-domain', () => {
  it('attaches a domain and prints its status', async () => {
    const { adapter, state } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);

    const out = captureStream();
    const code = await dispatch(
      ['host:attach-domain', 'my-site', 'example.com'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
    expect(out.chunks.join('')).toContain('example.com');
    expect(out.chunks.join('')).toContain('active');
    expect(state.domains.get('my-site')).toEqual([
      { domain: 'example.com', status: 'active' },
    ]);
  });

  it('errors when domain is omitted', async () => {
    const { adapter } = createFakeHostAdapter();
    registerAdapter('host', adapter);
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(
      ['host:attach-domain', 'my-site'],
      { stdout: out.stream, stderr: err.stream, cwd: process.cwd() },
    );
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_MISSING_ARG');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-attach-domain.test.ts`
Expected: FAIL — unknown command.

- [ ] **Step 3: Implement `host-attach-domain.ts`**

```typescript
// packages/cli/src/commands/host-attach-domain.ts
/**
 * `agentry host:attach-domain <slug> <domain>` — attach a custom domain.
 *
 * @module
 */

import { AgentryError, useAdapter, type HostAdapter } from '@openagentry/core';
import { defineCommand } from '../command.js';

export const hostAttachDomainCommand = defineCommand({
  name: 'host:attach-domain',
  summary: 'Attach a custom domain to a project via the registered host adapter.',
  async run(args, output) {
    const [slug, domain] = args.positional;
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:attach-domain <slug> <domain>`,
      });
    }
    if (domain === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <domain> argument.',
        phase: 'init',
        suggestedFix: `agentry host:attach-domain ${slug} example.com`,
      });
    }
    const adapter = useAdapter<HostAdapter>('host');
    const project = { id: `proj_${slug}`, slug, name: slug, hostId: `host_${slug}` };
    const result = await adapter.attachDomain(project, domain);

    output.text(`Domain ${result.domain} on ${slug}: ${result.status}`);
    if (result.pendingRecords && result.pendingRecords.length > 0) {
      output.text('Pending DNS records:');
      for (const r of result.pendingRecords) {
        output.text(`  ${r.type} ${r.name} → ${r.value}${r.priority !== undefined ? ` (prio ${r.priority})` : ''}`);
      }
    }
    output.json({ slug, ...result });
    return 0;
  },
});
```

- [ ] **Step 4: Register the command**

Edit `packages/cli/src/commands/index.ts`:

```typescript
import { hostAttachDomainCommand } from './host-attach-domain.js';
// ...
registerCommand(hostAttachDomainCommand);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-attach-domain.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/host-attach-domain.ts packages/cli/src/commands/index.ts packages/cli/tests/commands/host-attach-domain.test.ts
git commit -m "feat(cli): add host:attach-domain command wrapping HostAdapter.attachDomain"
```

---

## Task 7: `host:logs` command

**Files:**
- Create: `packages/cli/src/commands/host-logs.ts`
- Test: `packages/cli/tests/commands/host-logs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/commands/host-logs.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { registerAdapter, resetRegistryForTesting, type LogLine } from '@openagentry/core';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';
import { createFakeHostAdapter } from '../fixtures/fake-host-adapter.js';

function captureStream(): { stream: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) { chunks.push(String(chunk)); cb(); },
  });
  return { stream, chunks };
}

beforeEach(() => { resetRegistryForTesting(); });
afterEach(() => { resetRegistryForTesting(); });

describe('agentry host:logs', () => {
  it('streams log lines from the adapter to stdout', async () => {
    const seedLogs: LogLine[] = [
      { ts: '2026-05-16T10:00:00Z', level: 'info', message: 'request started' },
      { ts: '2026-05-16T10:00:01Z', level: 'info', message: 'request completed' },
    ];
    const { adapter } = createFakeHostAdapter({ logs: seedLogs });
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    registerAdapter('host', adapter);

    const out = captureStream();
    const code = await dispatch(
      ['host:logs', 'my-site'],
      { stdout: out.stream, stderr: out.stream, cwd: process.cwd() },
    );
    expect(code).toBe(0);
    const joined = out.chunks.join('');
    expect(joined).toContain('request started');
    expect(joined).toContain('request completed');
  });

  it('errors when slug is omitted', async () => {
    const { adapter } = createFakeHostAdapter();
    registerAdapter('host', adapter);
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(
      ['host:logs'],
      { stdout: out.stream, stderr: err.stream, cwd: process.cwd() },
    );
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_MISSING_ARG');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-logs.test.ts`
Expected: FAIL — unknown command.

- [ ] **Step 3: Implement `host-logs.ts`**

```typescript
// packages/cli/src/commands/host-logs.ts
/**
 * `agentry host:logs <slug> [--tail] [--since ISO] [--deployment <id>]` —
 * stream logs from the registered HostAdapter to stdout.
 *
 * For one-shot (non-tail) usage, iteration ends when the adapter's iterator
 * completes. Tail mode is provider-dependent and runs until the consumer
 * interrupts (Ctrl-C).
 *
 * @module
 */

import { AgentryError, useAdapter, type HostAdapter, type LogOpts } from '@openagentry/core';
import { defineCommand } from '../command.js';

export const hostLogsCommand = defineCommand({
  name: 'host:logs',
  summary: 'Stream logs from a project via the registered host adapter.',
  async run(args, output) {
    const slug = args.positional[0];
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:logs <slug> [--tail]`,
      });
    }
    const opts: LogOpts = {};
    if (args.flags['tail'] === true || args.flags['tail'] === 'true') opts.tail = true;
    if (typeof args.flags['since'] === 'string') opts.since = args.flags['since'];
    if (typeof args.flags['deployment'] === 'string') opts.deploymentId = args.flags['deployment'];

    const adapter = useAdapter<HostAdapter>('host');
    const project = { id: `proj_${slug}`, slug, name: slug, hostId: `host_${slug}` };

    const lines: Array<{ ts: string; level: string; message: string }> = [];
    for await (const line of adapter.logs(project, opts)) {
      output.text(`[${line.ts}] ${line.level} ${line.message}`);
      lines.push({ ts: line.ts, level: line.level, message: line.message });
    }
    output.json({ slug, count: lines.length, lines });
    return 0;
  },
});
```

- [ ] **Step 4: Register the command**

Edit `packages/cli/src/commands/index.ts`:

```typescript
import { hostLogsCommand } from './host-logs.js';
// ...
registerCommand(hostLogsCommand);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/commands/host-logs.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/host-logs.ts packages/cli/src/commands/index.ts packages/cli/tests/commands/host-logs.test.ts
git commit -m "feat(cli): add host:logs command wrapping HostAdapter.logs"
```

---

## Task 8: Wire `ensureHostAdapter()` into dispatcher

Make sure that when a user runs `agentry host:deploy ...` directly (without first registering an adapter manually), the bootstrap fires from env vars. Until now we've only tested with explicit `registerAdapter()` in tests.

**Files:**
- Modify: `packages/cli/src/dispatcher.ts` — call `ensureHostAdapter(process.env)` before the command's `run()`.
- Test: `packages/cli/tests/dispatcher.test.ts` — add a single test confirming dispatch wires the bootstrap.

- [ ] **Step 1: Read the existing dispatcher**

Run: `cat packages/cli/src/dispatcher.ts`
Note the entry function (likely `dispatch(argv, io)`).

- [ ] **Step 2: Write the failing test**

Append to `packages/cli/tests/dispatcher.test.ts` (do NOT replace existing tests):

```typescript
import { resetRegistryForTesting, useAdapter } from '@openagentry/core';

describe('dispatch — ensureHostAdapter integration', () => {
  it('registers host-vercel from OA_VERCEL_TOKEN before running a host command', async () => {
    resetRegistryForTesting();
    // Reset bootstrap so it re-evaluates env on next call.
    const bootstrap = await import('../src/runtime/host-bootstrap.js');
    bootstrap._resetForTesting();

    const prev = process.env.OA_VERCEL_TOKEN;
    process.env.OA_VERCEL_TOKEN = 'tok_test';
    try {
      // Use a no-op command (help) — bootstrap should still fire.
      const { Writable } = await import('node:stream');
      const chunks: string[] = [];
      const stream = new Writable({
        write(chunk, _enc, cb) { chunks.push(String(chunk)); cb(); },
      });
      const { dispatch } = await import('../src/dispatcher.js');
      await dispatch(['help'], { stdout: stream, stderr: stream, cwd: process.cwd() });
      const adapter = useAdapter<{ id: string }>('host');
      expect(adapter.id).toBe('host-vercel');
    } finally {
      if (prev === undefined) delete process.env.OA_VERCEL_TOKEN;
      else process.env.OA_VERCEL_TOKEN = prev;
      resetRegistryForTesting();
      const bootstrap2 = await import('../src/runtime/host-bootstrap.js');
      bootstrap2._resetForTesting();
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/dispatcher.test.ts`
Expected: FAIL on the new test — `useAdapter('host')` throws `E_NO_ADAPTER_FOR_CATEGORY` because dispatcher doesn't call `ensureHostAdapter` yet.

- [ ] **Step 4: Wire bootstrap into dispatcher**

Edit `packages/cli/src/dispatcher.ts` — add an `await ensureHostAdapter(ctx.env)` call before invoking the command. Exact insertion point: immediately after the command is resolved via `getCommand(name)` and before its `run(...)` invocation. Add the import at the top.

```typescript
import { ensureHostAdapter } from './runtime/host-bootstrap.js';
```

Then, just before `return await cmd.run(...)`:

```typescript
await ensureHostAdapter(ctx.env);
```

(If `ctx.env` doesn't exist in the existing CommandContext shape, use `process.env` instead — that's fine because the bootstrap takes any env-shaped map.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/dispatcher.test.ts`
Expected: PASS (all dispatcher tests including the new one).

- [ ] **Step 6: Run full CLI test suite**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli run test`
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/dispatcher.ts packages/cli/tests/dispatcher.test.ts
git commit -m "feat(cli): wire ensureHostAdapter() into dispatcher startup"
```

---

## Task 9: Integration test — MCP server exposes the 5 new tools

Verify that `@openagentry/mcp`'s auto-reflection picks up the new commands without any changes to the mcp package.

**Files:**
- Create: `packages/cli/tests/integration/mcp-reflection.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/tests/integration/mcp-reflection.test.ts
import { describe, expect, it } from 'vitest';
import { commands } from '../../src/commands/index.js';

describe('MCP reflection — host commands surface as tools', () => {
  const expectedNames = [
    'host:deploy',
    'host:set-env',
    'host:get-env',
    'host:attach-domain',
    'host:logs',
  ];

  for (const name of expectedNames) {
    it(`registers "${name}" command`, () => {
      const cmd = commands[name];
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe(name);
      expect(typeof cmd.summary).toBe('string');
      expect(cmd.summary.length).toBeGreaterThan(0);
      expect(typeof cmd.run).toBe('function');
    });
  }
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli exec vitest run tests/integration/mcp-reflection.test.ts`
Expected: PASS — all 5 commands present.

- [ ] **Step 3: Verify mcp package builds and finds the tools**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/mcp run test && pnpm --filter @openagentry/mcp run build`
Expected: PASS. Existing mcp tests should still pass because the reflection logic is unchanged; the new commands appear automatically via `Object.values(commands)`.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/tests/integration/mcp-reflection.test.ts
git commit -m "test(cli): verify host commands surface for MCP reflection"
```

---

## Task 10: Repo-wide green check + changelog

- [ ] **Step 1: Run all CLI tests + typecheck + build**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm --filter @openagentry/cli run test && pnpm --filter @openagentry/cli run typecheck && pnpm --filter @openagentry/cli run build`
Expected: ALL PASS.

- [ ] **Step 2: Run the full monorepo test suite**

Run: `cd /Users/timcox/tim-os/openagentry && pnpm -r run test`
Expected: ALL PASS (no regressions in any other package).

- [ ] **Step 3: Append to `packages/cli/CHANGELOG.md`**

Add a new entry at the top:

```markdown
## Unreleased

### Added

- `host:deploy`, `host:set-env`, `host:get-env`, `host:attach-domain`, `host:logs` commands that wrap the registered `HostAdapter`. Auto-exposed as MCP tools via `@openagentry/mcp`.
- `ensureHostAdapter()` bootstrap that registers `host-vercel` or `host-cloudflare` from env vars (`OA_HOST`, `OA_VERCEL_TOKEN`, `OA_CLOUDFLARE_API_TOKEN`, `OA_CLOUDFLARE_ACCOUNT_ID`) on first dispatch.
```

- [ ] **Step 4: Commit and report**

```bash
git add packages/cli/CHANGELOG.md
git commit -m "docs(cli): note host command additions in CHANGELOG"
```

Report: branch ready for PR. Note the plan file at `docs/superpowers/plans/2026-05-16-control-plane-host-commands.md`.

---

## Self-Review Checklist (run after writing — do NOT skip)

1. **Spec coverage:** Five host commands (deploy, set-env, get-env, attach-domain, logs) — Tasks 3-7. Adapter bootstrap — Task 2. Dispatcher wiring — Task 8. MCP-reflection verification — Task 9. ✓
2. **No placeholders:** Each step has either complete code, an exact command, or an exact instruction. ✓
3. **Type consistency:** All commands take `args.positional[0]` for slug, use `useAdapter<HostAdapter>('host')`, and construct the same minimal `{ id, slug, name, hostId }` Project shape. Bootstrap is named `ensureHostAdapter` consistently throughout. ✓

## Known v1 limitations (intentionally deferred)

- **No project persistence.** Commands reconstruct a minimal `HostProject` from the slug. Real adapters (Vercel/Cloudflare) need richer state (real `hostId` from the provider). v2 will add `.agentry/host-projects.json` or query the adapter's `lookupProject(slug)`.
- **No `host:create-project` / `host:destroy-project`.** Lifecycle commands are deferred. v1 assumes projects already exist on the provider.
- **No `host:rollback`.** Deferred.
- **No weft integration.** That's a separate plan (after this lands).
- **No multi-tenant credential handling.** Single-adapter-per-process v1. BYO-customer-infra deferred until a paying customer asks.

These deferrals match the "hold until you have a real consumer" rule from the strategy discussion.
