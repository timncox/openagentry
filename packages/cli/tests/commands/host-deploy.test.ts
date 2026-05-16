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
    expect(state.deployments[0]!.env).toBe('prod');
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
    expect(state.deployments[0]!.env).toBe('preview');
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
