/**
 * Load an adapter target from a directory path.
 *
 * Convention: `target/package.json` has an `openagentry` manifest block.
 * The entry is resolved from `package.json.main` (defaulting to
 * `./index.cjs`) and dynamic-imported. The adapter is expected to be the
 * `default` export.
 *
 * @module
 */

import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentryError, validateManifest } from '@openagentry/core';
import type { LoadedTarget } from './types.js';

export async function loadTarget(target: string): Promise<LoadedTarget> {
  const packageDir = isAbsolute(target) ? target : resolve(target);

  try {
    const s = await stat(packageDir);
    if (!s.isDirectory()) {
      throw new AgentryError({
        code: 'E_TARGET_NOT_DIR',
        message: `Target path ${packageDir} is not a directory.`,
        phase: 'init',
        context: { target: packageDir },
      });
    }
  } catch (err) {
    if (err instanceof AgentryError) throw err;
    const errno = (err as NodeJS.ErrnoException | undefined)?.code;
    if (errno === 'ENOENT') {
      throw new AgentryError({
        code: 'E_TARGET_NOT_FOUND',
        message: `Target directory ${packageDir} does not exist.`,
        phase: 'init',
        context: { target: packageDir },
        cause: err,
      });
    }
    throw new AgentryError({
      code: 'E_TARGET_STAT_FAILED',
      message: `Failed to stat target ${packageDir}: ${(err as Error)?.message ?? String(err)}.`,
      phase: 'init',
      context: { target: packageDir, errno },
      cause: err,
    });
  }

  const pkgPath = join(packageDir, 'package.json');
  let pkgRaw: string;
  try {
    pkgRaw = await readFile(pkgPath, 'utf8');
  } catch (err) {
    throw new AgentryError({
      code: 'E_TARGET_NO_PACKAGE_JSON',
      message: `${pkgPath} not found.`,
      phase: 'init',
      context: { pkgPath },
      cause: err,
    });
  }

  let pkg: { main?: string; openagentry?: unknown };
  try {
    pkg = JSON.parse(pkgRaw) as { main?: string; openagentry?: unknown };
  } catch (err) {
    throw new AgentryError({
      code: 'E_TARGET_BAD_PACKAGE_JSON',
      message: `${pkgPath} is not valid JSON.`,
      phase: 'validate',
      context: { pkgPath },
      cause: err,
    });
  }

  if (pkg.openagentry === undefined) {
    throw new AgentryError({
      code: 'E_TARGET_NO_MANIFEST',
      message: `${pkgPath} has no "openagentry" manifest block.`,
      phase: 'validate',
      suggestedFix: 'Add an "openagentry" block to package.json (see @openagentry/core docs).',
      context: { pkgPath },
    });
  }

  const manifest = validateManifest(pkg.openagentry);

  const entry = pkg.main ?? './index.cjs';
  const entryAbs = join(packageDir, entry);
  let module: unknown;
  try {
    module = await import(pathToFileURL(entryAbs).href);
  } catch (err) {
    throw new AgentryError({
      code: 'E_TARGET_IMPORT_FAILED',
      message: `Failed to import ${entryAbs}.`,
      phase: 'init',
      context: { entryAbs },
      cause: err,
    });
  }

  return { packageDir, manifest, module };
}
