import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';

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

describe('agentry doctor', () => {
  it('reports green when run from the test environment (Node 20+)', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['doctor'], { stdout: out.stream, stderr: err.stream });
    // Tests run on Node 20+ per workspace engines, so we expect green.
    expect(code).toBe(0);
    expect(out.chunks.join('')).toMatch(/node/i);
  });

  it('--json emits a structured checks array', async () => {
    const out = captureStream();
    const err = captureStream();
    await dispatch(['doctor', '--json'], { stdout: out.stream, stderr: err.stream });
    const parsed = JSON.parse(out.chunks.join(''));
    expect(Array.isArray(parsed.checks)).toBe(true);
    const names = parsed.checks.map((c: { name: string }) => c.name);
    expect(names).toContain('node-version');
    expect(names).toContain('home-config');
    expect(names).toContain('workspace');
    for (const c of parsed.checks) {
      expect(['pass', 'warn', 'fail']).toContain(c.status);
    }
  });
});
