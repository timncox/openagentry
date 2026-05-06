import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveSafePath,
  walkDir,
  writeFileAtomic,
  readFileSafe,
  statSafe,
} from '../src/fs.js';

let tempDir: string;
beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'wiki-fs-fs-test-'));
});
afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('resolveSafePath', () => {
  it('joins relative path under root', () => {
    const out = resolveSafePath(tempDir, 'a/b.md', 'read');
    expect(out.startsWith(tempDir)).toBe(true);
    expect(out.endsWith('a/b.md') || out.endsWith('a\\b.md')).toBe(true);
  });

  it('rejects ".." escape with E_WIKI_FS_OUT_OF_VAULT', () => {
    expect(() => resolveSafePath(tempDir, '../escape.md', 'read')).toThrow(
      /E_WIKI_FS_OUT_OF_VAULT/,
    );
  });

  it('rejects absolute path that escapes root', () => {
    expect(() => resolveSafePath(tempDir, '/etc/passwd', 'read')).toThrow(
      /E_WIKI_FS_OUT_OF_VAULT/,
    );
  });

  it('allows the root itself', () => {
    expect(() => resolveSafePath(tempDir, '.', 'read')).not.toThrow();
  });
});

describe('walkDir', () => {
  it('returns recursive list of .md files', async () => {
    await writeFile(join(tempDir, 'a.md'), 'a');
    const sub = join(tempDir, 'sub');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(sub);
    await writeFile(join(sub, 'b.md'), 'b');
    await writeFile(join(tempDir, 'ignore.txt'), 'x');
    const files = await walkDir(tempDir);
    expect(files.sort()).toEqual([join(sub, 'b.md'), join(tempDir, 'a.md')].sort());
  });

  it('returns empty array for empty dir', async () => {
    const out = await walkDir(tempDir);
    expect(out).toEqual([]);
  });

  it('returns empty array for missing dir (no throw)', async () => {
    const out = await walkDir(join(tempDir, 'does-not-exist'));
    expect(out).toEqual([]);
  });
});

describe('writeFileAtomic', () => {
  it('writes content', async () => {
    const target = join(tempDir, 'a.md');
    await writeFileAtomic(target, 'hello');
    const content = await readFile(target, 'utf8');
    expect(content).toBe('hello');
  });

  it('creates parent dirs', async () => {
    const target = join(tempDir, 'sub/deep/a.md');
    await writeFileAtomic(target, 'x');
    const content = await readFile(target, 'utf8');
    expect(content).toBe('x');
  });

  it('does not leave a tmp file on success', async () => {
    const target = join(tempDir, 'a.md');
    await writeFileAtomic(target, 'hi');
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(tempDir);
    expect(entries.filter((e) => e.includes('.tmp'))).toEqual([]);
  });
});

describe('readFileSafe', () => {
  it('returns content for existing file', async () => {
    const target = join(tempDir, 'a.md');
    await writeFile(target, 'data');
    expect(await readFileSafe(target, 'read')).toBe('data');
  });

  it('throws AgentryError E_WIKI_FS_NOT_FOUND on missing', async () => {
    await expect(
      readFileSafe(join(tempDir, 'missing.md'), 'read'),
    ).rejects.toThrow(/E_WIKI_FS_NOT_FOUND/);
  });
});

describe('statSafe', () => {
  it('returns mtimeMs for existing file', async () => {
    const target = join(tempDir, 'a.md');
    await writeFile(target, 'data');
    const result = await statSafe(target, 'list');
    expect(typeof result.mtimeMs).toBe('number');
    expect(result.mtimeMs).toBeGreaterThan(0);
  });

  it('throws AgentryError E_WIKI_FS_NOT_FOUND for missing path', async () => {
    await expect(
      statSafe(join(tempDir, 'missing.md'), 'list'),
    ).rejects.toThrow(/E_WIKI_FS_NOT_FOUND/);
  });
});
