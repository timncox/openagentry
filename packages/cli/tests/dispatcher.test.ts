import { describe, expect, it, beforeEach } from 'vitest';
import { Writable } from 'node:stream';
import { dispatch } from '../src/dispatcher.js';
import { defineCommand } from '../src/command.js';
import { commands, registerCommand } from '../src/commands/index.js';

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
  for (const k of Object.keys(commands)) {
    delete commands[k];
  }
});

describe('dispatch', () => {
  it('runs a registered command and returns its exit code', async () => {
    registerCommand(
      defineCommand({
        name: 'ok',
        summary: 'always succeeds',
        async run(_args, output) {
          output.text('hi');
          return 0;
        },
      }),
    );
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['ok'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    expect(out.chunks.join('')).toBe('hi\n');
    expect(err.chunks.join('')).toBe('');
  });

  it('passes --json through to Output', async () => {
    registerCommand(
      defineCommand({
        name: 'jsonish',
        summary: 'tests json mode',
        async run(_args, output) {
          output.text('suppressed');
          output.json({ ok: true });
          return 0;
        },
      }),
    );
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['jsonish', '--json'], {
      stdout: out.stream,
      stderr: err.stream,
    });
    expect(code).toBe(0);
    expect(out.chunks.join('')).toBe('{"ok":true}\n');
  });

  it('returns exit 1 on AgentryError thrown by command', async () => {
    registerCommand(
      defineCommand({
        name: 'fail',
        summary: 'always throws',
        async run() {
          const { AgentryError } = await import('@openagentry/core');
          throw new AgentryError({
            code: 'E_FAIL',
            message: 'expected fail',
            phase: 'unknown',
          });
        },
      }),
    );
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['fail'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_FAIL');
  });

  it('returns exit 2 on non-AgentryError thrown by command', async () => {
    registerCommand(
      defineCommand({
        name: 'crash',
        summary: 'plain throw',
        async run() {
          throw new Error('boom');
        },
      }),
    );
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['crash'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(2);
    expect(err.chunks.join('')).toContain('E_UNKNOWN');
  });

  it('returns exit 1 on unknown command (formats from registry error)', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['nosuch'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_UNKNOWN_COMMAND');
  });
});

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
      const adapter = useAdapter<{ id: string; category: string }>('host');
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
