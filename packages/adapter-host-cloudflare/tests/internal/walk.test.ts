import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkDir } from '../../src/internal/walk.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'walk-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('walkDir', () => {
  it('yields files with relative paths and bytes', async () => {
    await writeFile(join(dir, 'a.html'), '<a/>');
    await mkdir(join(dir, 'sub'));
    await writeFile(join(dir, 'sub', 'b.html'), '<b/>');

    const seen: Array<{ relPath: string; size: number }> = [];
    for await (const entry of walkDir(dir)) {
      seen.push({ relPath: entry.relPath, size: entry.bytes.length });
    }
    seen.sort((x, y) => x.relPath.localeCompare(y.relPath));
    expect(seen).toEqual([
      { relPath: 'a.html', size: 4 },
      { relPath: 'sub/b.html', size: 4 },
    ]);
  });

  it('yields no entries for an empty directory', async () => {
    const seen: string[] = [];
    for await (const entry of walkDir(dir)) seen.push(entry.relPath);
    expect(seen).toEqual([]);
  });

  it('throws AgentryError when the path is not a directory', async () => {
    const file = join(dir, 'not-a-dir');
    await writeFile(file, 'x');
    const iter = walkDir(file);
    await expect(iter.next()).rejects.toMatchObject({ code: 'E_CF_HTTP', phase: 'deploy' });
  });
});
