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
