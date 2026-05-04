import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { Output } from '../src/output.js';
import { AgentryError } from '@openagentry/core';

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

describe('Output', () => {
  it('text mode writes a trailing newline', () => {
    const out = captureStream();
    const err = captureStream();
    const o = new Output({ mode: 'text', stdout: out.stream, stderr: err.stream });
    o.text('hello');
    expect(out.chunks.join('')).toBe('hello\n');
  });

  it('json mode writes JSON.stringify + newline', () => {
    const out = captureStream();
    const err = captureStream();
    const o = new Output({ mode: 'json', stdout: out.stream, stderr: err.stream });
    o.json({ ok: true, n: 1 });
    expect(out.chunks.join('')).toBe('{"ok":true,"n":1}\n');
  });

  it('json mode swallows text() calls (so progress logs do not pollute JSON)', () => {
    const out = captureStream();
    const err = captureStream();
    const o = new Output({ mode: 'json', stdout: out.stream, stderr: err.stream });
    o.text('progress message');
    o.json({ ok: true });
    expect(out.chunks.join('')).toBe('{"ok":true}\n');
  });

  it('error() in text mode prints code, message, suggestedFix, docs', () => {
    const out = captureStream();
    const err = captureStream();
    const o = new Output({ mode: 'text', stdout: out.stream, stderr: err.stream });
    o.error(
      new AgentryError({
        code: 'E_X',
        message: 'something went wrong',
        phase: 'init',
        suggestedFix: 'agentry doctor',
        docs: 'https://example.test/E_X',
      }),
    );
    const s = err.chunks.join('');
    expect(s).toContain('E_X');
    expect(s).toContain('something went wrong');
    expect(s).toContain('agentry doctor');
    expect(s).toContain('https://example.test/E_X');
  });

  it('error() in json mode emits AgentryError JSON', () => {
    const out = captureStream();
    const err = captureStream();
    const o = new Output({ mode: 'json', stdout: out.stream, stderr: err.stream });
    const e = new AgentryError({
      code: 'E_X',
      message: 'm',
      phase: 'init',
      context: { k: 'v' },
    });
    o.error(e);
    const parsed = JSON.parse(err.chunks.join(''));
    expect(parsed).toEqual({
      code: 'E_X',
      message: 'm',
      phase: 'init',
      context: { k: 'v' },
    });
  });

  it('error() with a non-AgentryError wraps it', () => {
    const out = captureStream();
    const err = captureStream();
    const o = new Output({ mode: 'json', stdout: out.stream, stderr: err.stream });
    o.error(new Error('plain'));
    const parsed = JSON.parse(err.chunks.join(''));
    expect(parsed.code).toBe('E_UNKNOWN');
    expect(parsed.message).toBe('plain');
    expect(parsed.phase).toBe('unknown');
  });
});
