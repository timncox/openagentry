/**
 * Filesystem helpers for adapter-wiki-fs: safe path resolution,
 * recursive walk, atomic writes, error mapping.
 *
 * @module
 */

import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { AgentryErrorPhase } from '@openagentry/core';
import { fsErrorToWikiError, wikiFsError, WIKI_FS_ERROR_CODES } from './errors.js';

export function resolveSafePath(
  vaultRoot: string,
  relativePath: string,
  phase: AgentryErrorPhase,
): string {
  const normalizedRoot = resolve(vaultRoot);
  const candidate = resolve(normalizedRoot, normalize(relativePath));
  if (
    candidate !== normalizedRoot &&
    !candidate.startsWith(normalizedRoot + sep)
  ) {
    throw wikiFsError({
      code: WIKI_FS_ERROR_CODES.OUT_OF_VAULT,
      message: `Path "${relativePath}" escapes vault root "${normalizedRoot}".`,
      phase,
      suggestedFix:
        'Use a path relative to the vault root with no ".." segments and no absolute path.',
      context: { vaultRoot: normalizedRoot, relativePath, resolved: candidate },
    });
  }
  return candidate;
}

export async function walkDir(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ENOENT') return;
      throw fsErrorToWikiError(err, 'list', dir);
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      // Symlinks are not followed: dirent.isFile() returns false for symlinks
      // even when they point to .md files. POSIX-only behavior; v0 scope.
      if (e.isDirectory()) {
        await recurse(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }
  await recurse(root);
  return out;
}

export async function writeFileAtomic(
  target: string,
  content: string,
): Promise<void> {
  const dir = dirname(target);
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    throw fsErrorToWikiError(err, 'write', dir);
  }
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, target);
  } catch (err) {
    // Best-effort cleanup; if unlink fails the orphan tmp is harmless.
    try {
      await unlink(tmp);
    } catch {
      // ignore — tmp may not exist or may be locked
    }
    throw fsErrorToWikiError(err, 'write', target);
  }
}

export async function readFileSafe(
  target: string,
  phase: AgentryErrorPhase,
): Promise<string> {
  try {
    return await readFile(target, 'utf8');
  } catch (err) {
    throw fsErrorToWikiError(err, phase, target);
  }
}

export async function statSafe(
  target: string,
  phase: AgentryErrorPhase,
): Promise<{ mtimeMs: number }> {
  try {
    const s = await stat(target);
    return { mtimeMs: s.mtimeMs };
  } catch (err) {
    throw fsErrorToWikiError(err, phase, target);
  }
}
