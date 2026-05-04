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

describe('agentry help', () => {
  it('lists registered commands with summaries', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['help'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    const s = out.chunks.join('');
    expect(s).toMatch(/version\s+/i);
    expect(s).toMatch(/help\s+/i);
  });

  it('describes a specific command when given a positional', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['help', 'version'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    expect(out.chunks.join('')).toMatch(/version/i);
  });

  it('reports unknown subcommand via AgentryError', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['help', 'definitely-not-a-command'], {
      stdout: out.stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_UNKNOWN_COMMAND');
  });

  it('--help on any command routes to help <command>', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['version', '--help'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    expect(out.chunks.join('')).toMatch(/version/i);
  });

  it('--json emits structured help JSON', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['help', '--json'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join(''));
    expect(Array.isArray(parsed.commands)).toBe(true);
    expect(parsed.commands.length).toBeGreaterThan(0);
    expect(parsed.commands[0]).toHaveProperty('name');
    expect(parsed.commands[0]).toHaveProperty('summary');
  });
});
