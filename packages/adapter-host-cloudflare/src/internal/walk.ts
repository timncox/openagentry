/**
 * Recursive directory walker. Yields files only.
 *
 * @module
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { AgentryError } from '@openagentry/core';
import { CF_ERROR_CODES } from '../errors.js';

const ADAPTER_ID = 'host-cloudflare';

export interface WalkEntry {
  relPath: string;
  absPath: string;
  bytes: Uint8Array;
}

export async function* walkDir(root: string): AsyncGenerator<WalkEntry> {
  let info;
  try {
    info = await stat(root);
  } catch (cause) {
    throw new AgentryError({
      code: CF_ERROR_CODES.HTTP,
      message: `Cannot read source directory ${root}: ${(cause as Error).message}`,
      phase: 'deploy',
      adapter: ADAPTER_ID,
      cause,
    });
  }
  if (!info.isDirectory()) {
    throw new AgentryError({
      code: CF_ERROR_CODES.HTTP,
      message: `Source path ${root} is not a directory.`,
      phase: 'deploy',
      adapter: ADAPTER_ID,
    });
  }
  yield* walkInner(root, root);
}

async function* walkInner(root: string, current: string): AsyncGenerator<WalkEntry> {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const abs = join(current, entry.name);
    if (entry.isDirectory()) {
      yield* walkInner(root, abs);
    } else if (entry.isFile()) {
      const buf = await readFile(abs);
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      const relPath = relative(root, abs).split('\\').join('/');
      yield { relPath, absPath: abs, bytes };
    }
  }
}
