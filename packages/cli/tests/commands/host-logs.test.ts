// packages/cli/tests/commands/host-logs.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import {
  registerAdapter,
  resetRegistryForTesting,
  type IsoTimestamp,
  type LogLine,
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

describe('agentry host:logs', () => {
  it('streams log lines from the adapter to stdout', async () => {
    const seedLogs: LogLine[] = [
      { timestamp: '2026-05-16T10:00:00Z' as IsoTimestamp, level: 'info', message: 'request started' },
      { timestamp: '2026-05-16T10:00:01Z' as IsoTimestamp, level: 'info', message: 'request completed' },
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
