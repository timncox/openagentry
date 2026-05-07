/**
 * @openagentry/adapter-wiki-fs — public entry.
 *
 * Default export: an adapter constructed from process.env.OA_WIKI_FS_WORKSPACE_PATH
 * (default os.tmpdir()/agentry-wiki-conformance) and optional
 * process.env.OA_WIKI_FS_PROJECT_PATH.
 *
 * @module
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWikiFsAdapter } from './adapter.js';

export {
  createWikiFsAdapter,
  type WikiFsAdapter,
} from './adapter.js';
export {
  parseWikiFsConfig,
  wikiFsConfigSchema,
  type WikiFsConfig,
} from './config.js';
export {
  ADAPTER_ID,
  WIKI_FS_ERROR_CODES,
  fsErrorToWikiError,
  wikiFsError,
  type WikiFsErrorCode,
  type WikiFsErrorInit,
} from './errors.js';
export { healthcheck, init, refresh } from './lifecycle.js';

function resolveDefaultWorkspacePath(): string {
  const envPath = process.env['OA_WIKI_FS_WORKSPACE_PATH'];
  if (envPath !== undefined && envPath.length > 0) return envPath;
  return join(tmpdir(), 'agentry-wiki-conformance');
}

const defaultProjectPath = process.env['OA_WIKI_FS_PROJECT_PATH'];

const defaultAdapter = createWikiFsAdapter(
  defaultProjectPath !== undefined && defaultProjectPath.length > 0
    ? {
        workspaceVaultPath: resolveDefaultWorkspacePath(),
        projectVaultPath: defaultProjectPath,
      }
    : { workspaceVaultPath: resolveDefaultWorkspacePath() },
);

export default defaultAdapter;
