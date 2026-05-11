import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'agentry-init-'));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('agentry init', () => {
  it('creates .agentry/workspace.json with empty plugins by default', async () => {
    const out = captureStream();
    const code = await dispatch(['init'], { stdout: out.stream, stderr: out.stream, cwd });
    expect(code).toBe(0);
    const cfgPath = join(cwd, '.agentry', 'workspace.json');
    const cfg = JSON.parse(await readFile(cfgPath, 'utf8')) as { plugins: string[]; defaultEnv?: string };
    expect(cfg.plugins).toEqual([]);
    expect(cfg.defaultEnv).toBe('dev');
  });

  it('writes positional plugin names into the config', async () => {
    const out = captureStream();
    const code = await dispatch(
      ['init', '@openagentry/adapter-llm-cli', '@openagentry/adapter-wiki-fs'],
      { stdout: out.stream, stderr: out.stream, cwd },
    );
    expect(code).toBe(0);
    const cfg = JSON.parse(
      await readFile(join(cwd, '.agentry', 'workspace.json'), 'utf8'),
    ) as { plugins: string[] };
    expect(cfg.plugins).toEqual([
      '@openagentry/adapter-llm-cli',
      '@openagentry/adapter-wiki-fs',
    ]);
  });

  it('refuses to overwrite an existing workspace.json', async () => {
    await mkdir(join(cwd, '.agentry'), { recursive: true });
    await writeFile(
      join(cwd, '.agentry', 'workspace.json'),
      JSON.stringify({ plugins: ['preexisting'], defaultEnv: 'dev' }),
    );
    const out = captureStream();
    const err = captureStream();
    const code = await dispatch(['init'], { stdout: out.stream, stderr: err.stream, cwd });
    expect(code).toBe(1);
    expect(err.chunks.join('')).toContain('E_WORKSPACE_EXISTS');
    // Untouched
    const cfg = JSON.parse(
      await readFile(join(cwd, '.agentry', 'workspace.json'), 'utf8'),
    ) as { plugins: string[] };
    expect(cfg.plugins).toEqual(['preexisting']);
  });

  it('overwrites with --force', async () => {
    await mkdir(join(cwd, '.agentry'), { recursive: true });
    await writeFile(
      join(cwd, '.agentry', 'workspace.json'),
      JSON.stringify({ plugins: ['preexisting'], defaultEnv: 'dev' }),
    );
    const out = captureStream();
    const code = await dispatch(['init', '--force'], {
      stdout: out.stream,
      stderr: out.stream,
      cwd,
    });
    expect(code).toBe(0);
    const cfg = JSON.parse(
      await readFile(join(cwd, '.agentry', 'workspace.json'), 'utf8'),
    ) as { plugins: string[] };
    expect(cfg.plugins).toEqual([]);
  });

  it('emits structured JSON when --json is set', async () => {
    const out = captureStream();
    const code = await dispatch(['init', '--json'], {
      stdout: out.stream,
      stderr: out.stream,
      cwd,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(out.chunks.join('')) as {
      workspaceRoot: string;
      created: boolean;
      plugins: string[];
    };
    expect(parsed.created).toBe(true);
    expect(parsed.workspaceRoot).toBe(cwd);
    expect(parsed.plugins).toEqual([]);
    // Sanity: file actually exists
    await stat(join(cwd, '.agentry', 'workspace.json'));
  });
});
