import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';

const FIXTURE = resolve(__dirname, '../fixtures/fake-host-adapter');

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

let workspaceRoot: string;
beforeEach(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), 'agentry-list-'));
});
afterEach(async () => {
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('agentry list', () => {
  it('reports an empty list when no workspace is configured', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['list', '--json'], {
      stdout: out.stream,
      stderr: err.stream,
      cwd: workspaceRoot,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join(''));
    expect(parsed.plugins).toEqual([]);
  });

  it('reports configured plugins with load status', async () => {
    // Stage workspace.json + node_modules/fake-host-adapter
    await mkdir(join(workspaceRoot, '.agentry'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.agentry', 'workspace.json'),
      JSON.stringify({ plugins: ['fake-host-adapter', 'missing-plugin'] }),
    );
    const target = join(workspaceRoot, 'node_modules', 'fake-host-adapter');
    await mkdir(target, { recursive: true });
    await cp(FIXTURE, target, { recursive: true });

    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['list', '--json'], {
      stdout: out.stream,
      stderr: err.stream,
      cwd: workspaceRoot,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join(''));
    expect(parsed.plugins).toHaveLength(2);
    const ok = parsed.plugins.find((p: { name: string }) => p.name === 'fake-host-adapter');
    const bad = parsed.plugins.find((p: { name: string }) => p.name === 'missing-plugin');
    expect(ok.loaded).toBe(true);
    expect(ok.type).toBe('adapter');
    expect(bad.loaded).toBe(false);
    expect(bad.error.code).toBe('E_PLUGIN_NOT_FOUND');
  });
});
