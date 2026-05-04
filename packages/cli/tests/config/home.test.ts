import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readHomeConfig,
  writeHomeConfig,
  defaultHomeConfig,
} from '../../src/config/home.js';
import { isAgentryError } from '@openagentry/core';

let homeDir: string;
beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), 'agentry-home-'));
});
afterEach(async () => {
  await rm(homeDir, { recursive: true, force: true });
});

describe('home config', () => {
  it('returns defaults when no config file exists', async () => {
    const cfg = await readHomeConfig(homeDir);
    expect(cfg).toEqual(defaultHomeConfig());
  });

  it('round-trips a written config', async () => {
    const cfg = { workspacePath: '/tmp/some-workspace', telemetryOptIn: true };
    await writeHomeConfig(homeDir, cfg);
    const re = await readHomeConfig(homeDir);
    expect(re.workspacePath).toBe(cfg.workspacePath);
    expect(re.telemetryOptIn).toBe(true);
  });

  it('throws AgentryError on malformed JSON', async () => {
    await mkdir(join(homeDir, '.agentry'), { recursive: true });
    await writeFile(join(homeDir, '.agentry', 'config.json'), 'not json');
    let caught: unknown;
    try {
      await readHomeConfig(homeDir);
    } catch (err) {
      caught = err;
    }
    expect(isAgentryError(caught)).toBe(true);
    if (isAgentryError(caught)) {
      expect(caught.code).toBe('E_HOME_CONFIG_INVALID');
    }
  });

  it('throws AgentryError on schema-invalid content', async () => {
    await mkdir(join(homeDir, '.agentry'), { recursive: true });
    await writeFile(
      join(homeDir, '.agentry', 'config.json'),
      JSON.stringify({ workspacePath: 123 }),
    );
    let caught: unknown;
    try {
      await readHomeConfig(homeDir);
    } catch (err) {
      caught = err;
    }
    expect(isAgentryError(caught)).toBe(true);
  });
});
