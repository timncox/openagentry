import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readWorkspaceConfig,
  writeWorkspaceConfig,
  defaultWorkspaceConfig,
  locateWorkspaceRoot,
} from '../../src/config/workspace.js';
import { isAgentryError } from '@openagentry/core';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'agentry-ws-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('workspace config', () => {
  it('defaultWorkspaceConfig returns plugins=[]', () => {
    expect(defaultWorkspaceConfig()).toEqual({ plugins: [] });
  });

  it('returns defaults when no workspace.json exists', async () => {
    const cfg = await readWorkspaceConfig(dir);
    expect(cfg).toEqual(defaultWorkspaceConfig());
  });

  it('round-trips a written config', async () => {
    await writeWorkspaceConfig(dir, {
      plugins: ['@openagentry/adapter-host-cloudflare'],
      defaultEnv: 'prod',
    });
    const re = await readWorkspaceConfig(dir);
    expect(re.plugins).toEqual(['@openagentry/adapter-host-cloudflare']);
    expect(re.defaultEnv).toBe('prod');
  });

  it('throws AgentryError on malformed workspace.json', async () => {
    await mkdir(join(dir, '.agentry'), { recursive: true });
    await writeFile(join(dir, '.agentry', 'workspace.json'), '{not json');
    let caught: unknown;
    try {
      await readWorkspaceConfig(dir);
    } catch (err) {
      caught = err;
    }
    expect(isAgentryError(caught)).toBe(true);
    if (isAgentryError(caught)) {
      expect(caught.code).toBe('E_WORKSPACE_CONFIG_INVALID');
    }
  });
});

describe('locateWorkspaceRoot', () => {
  it('returns the directory containing .agentry/workspace.json', async () => {
    await mkdir(join(dir, '.agentry'), { recursive: true });
    await writeFile(join(dir, '.agentry', 'workspace.json'), '{"plugins":[]}');
    const sub = join(dir, 'a', 'b');
    await mkdir(sub, { recursive: true });
    expect(await locateWorkspaceRoot(sub)).toBe(dir);
  });

  it('returns undefined when no .agentry/workspace.json exists upward', async () => {
    const sub = join(dir, 'no-ws');
    await mkdir(sub, { recursive: true });
    expect(await locateWorkspaceRoot(sub)).toBeUndefined();
  });
});
