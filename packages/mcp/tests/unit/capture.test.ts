import { describe, expect, it } from 'vitest';
import { runDispatch } from '../../src/capture.js';

describe('runDispatch', () => {
  it('captures stdout for a known --json command (version)', async () => {
    const r = await runDispatch(['version', '--json']);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toBe('');
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({
      cliVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
      protocolVersion: expect.any(Number),
    });
  });

  it('captures stderr + exit 1 for an unknown command', async () => {
    const r = await runDispatch(['definitely-not-a-command', '--json']);
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe('');
    const parsed = JSON.parse(r.stderr);
    expect(parsed.code).toBe('E_UNKNOWN_COMMAND');
  });

  it('plumbs cwd option through to dispatch', async () => {
    const r = await runDispatch(['version', '--json'], { cwd: '/' });
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout).cliVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('does NOT pollute the host process stdout/stderr', async () => {
    const realWrite = process.stdout.write.bind(process.stdout);
    const calls: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout.write as any) = ((chunk: unknown) => {
      calls.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      await runDispatch(['version', '--json']);
    } finally {
      process.stdout.write = realWrite;
    }
    expect(calls.join('')).toBe('');
  });
});
