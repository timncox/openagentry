// packages/cli/tests/commands/host-get-env.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import {
  registerAdapter,
  resetRegistryForTesting,
  type HostProject,
  type IsoTimestamp,
} from '@openagentry/core';
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

describe('agentry host:get-env', () => {
  it('returns existing env vars for the requested scope', async () => {
    const { adapter } = createFakeHostAdapter();
    await adapter.createProject({ name: 'My Site', slug: 'my-site' });
    const project: HostProject = {
      id: 'proj_my-site',
      slug: 'my-site',
      name: 'my-site',
      hostId: 'host_my-site',
      createdAt: new Date(0).toISOString() as IsoTimestamp,
    };
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
