import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { dispatch } from '../../src/dispatcher.js';
import '../../src/commands/index.js';
import { resetRegistryForTesting } from '../../../core/src/runtime/resolver.js';

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
  workspaceRoot = await mkdtemp(join(tmpdir(), 'agentry-cap-'));
  resetRegistryForTesting();
});
afterEach(async () => {
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('agentry capabilities', () => {
  it('reports no capabilities when workspace has no plugins', async () => {
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['capabilities', '--json'], {
      stdout: out.stream,
      stderr: err.stream,
      cwd: workspaceRoot,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join(''));
    expect(parsed.categories).toEqual({});
  });

  it('reports registered host adapter after loading the fake plugin', async () => {
    await mkdir(join(workspaceRoot, '.agentry'), { recursive: true });
    await writeFile(
      join(workspaceRoot, '.agentry', 'workspace.json'),
      JSON.stringify({ plugins: ['fake-host-adapter'] }),
    );
    const target = join(workspaceRoot, 'node_modules', 'fake-host-adapter');
    await mkdir(target, { recursive: true });
    await cp(FIXTURE, target, { recursive: true });

    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['capabilities', '--json'], {
      stdout: out.stream,
      stderr: err.stream,
      cwd: workspaceRoot,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join(''));
    expect(parsed.categories.host).toBeDefined();
    expect(parsed.categories.host.adapterId).toBe('fake-host');
    expect(parsed.categories.host.fillsSlots).toContain('host');
    expect(parsed.categories.host.capabilities).toMatchObject({ deploy: true });
  });
});
