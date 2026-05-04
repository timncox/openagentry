import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js'; // ensures registry side-effects load

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

describe('agentry version', () => {
  it('prints the CLI version and protocol version (text mode)', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['version'], { stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    const s = out.chunks.join('');
    expect(s).toMatch(/agentry\s+\d+\.\d+\.\d+/);
    expect(s).toMatch(/protocol\s+\d+/);
  });

  it('emits structured JSON when --json is set', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['version', '--json'], {
      stdout: out.stream,
      stderr: err.stream,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join(''));
    expect(parsed).toMatchObject({
      cliVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
      protocolVersion: expect.any(Number),
      node: expect.stringMatching(/^v?\d+\./),
      platform: expect.any(String),
    });
  });
});
