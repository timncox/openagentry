import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stream } from '../../src/ops/stream.js';
import { claudeDispatch } from '../../src/dispatch/claude.js';
import { defaultSpawn } from '../../src/exec.js';

const here = dirname(fileURLToPath(import.meta.url));
const stubClaude = resolve(here, '../fixtures/stub-claude.js');

const ctx = {
  dispatch: claudeDispatch,
  config: { cli: 'claude' as const, binPath: stubClaude },
  spawn: defaultSpawn,
};

describe('stream', () => {
  it('emits text chunks then exactly one done chunk', async () => {
    const chunks: { type: string }[] = [];
    for await (const c of stream(ctx, 'Count to three.')) {
      chunks.push(c);
    }
    const textCount = chunks.filter((c) => c.type === 'text').length;
    const doneCount = chunks.filter((c) => c.type === 'done').length;
    expect(textCount).toBeGreaterThanOrEqual(3);
    expect(doneCount).toBe(1);
  });

  it('emits error chunk on non-zero exit', async () => {
    const chunks: { type: string }[] = [];
    for await (const c of stream(ctx, 'error:nonzero')) {
      chunks.push(c);
    }
    expect(chunks.some((c) => c.type === 'error')).toBe(true);
    expect(chunks.filter((c) => c.type === 'done').length).toBe(0);
  });

  it('honors consumer break — emits no error chunk on early termination', async () => {
    const chunks: { type: string }[] = [];
    for await (const c of stream(ctx, 'Count to three.')) {
      chunks.push(c);
      if (chunks.length >= 1) break;
    }
    expect(chunks.length).toBe(1);
    const first = chunks[0];
    expect(first).toBeDefined();
    expect(first!.type).toBe('text');
  });
});
