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

beforeEach(() => {
  resetRegistryForTesting();
});
afterEach(() => {
  resetRegistryForTesting();
});

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
