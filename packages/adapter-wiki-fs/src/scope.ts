/**
 * Scope routing: maps an unscoped/prefixed path to the correct vault root.
 *
 * @module
 */

import type { AgentryErrorPhase } from '@openagentry/core';
import { WIKI_FS_ERROR_CODES, wikiFsError } from './errors.js';
import { resolveSafePath } from './fs.js';
import type { ResolvedTarget, WikiFsContext } from './types.js';

const WS_PREFIX = 'workspace/';
const PROJ_PREFIX = 'project/';

export function resolveScope(
  ctx: WikiFsContext,
  inputPath: string,
  phase: AgentryErrorPhase,
): ResolvedTarget {
  let scope: 'workspace' | 'project';
  let relative: string;
  let prefixed: string;

  if (inputPath.startsWith(PROJ_PREFIX)) {
    scope = 'project';
    relative = inputPath.slice(PROJ_PREFIX.length);
    prefixed = inputPath;
    if (ctx.projectRoot === undefined) {
      throw wikiFsError({
        code: WIKI_FS_ERROR_CODES.NO_PROJECT_VAULT,
        message: `Project vault not configured but path "${inputPath}" requested project scope.`,
        phase,
        suggestedFix:
          'Pass `projectVaultPath` in adapter config, or use the `workspace/` prefix.',
      });
    }
  } else if (inputPath.startsWith(WS_PREFIX)) {
    scope = 'workspace';
    relative = inputPath.slice(WS_PREFIX.length);
    prefixed = inputPath;
  } else {
    scope = 'workspace';
    relative = inputPath;
    prefixed = `workspace/${inputPath}`;
  }

  if (relative === '') {
    throw wikiFsError({
      code: WIKI_FS_ERROR_CODES.NOT_FOUND,
      message: `Path "${inputPath}" has no file component after the scope prefix.`,
      phase,
      suggestedFix: 'Provide a filename after the prefix, e.g. "workspace/my-note.md".',
    });
  }

  const vaultRoot = scope === 'workspace' ? ctx.workspaceRoot : (ctx.projectRoot as string);
  const absolutePath = resolveSafePath(vaultRoot, relative, phase);
  return { scope, vaultRoot, relativePath: relative, prefixedPath: prefixed, absolutePath };
}

export function prefixedPath(
  scope: 'workspace' | 'project',
  relativePath: string,
): string {
  return `${scope}/${relativePath}`;
}
