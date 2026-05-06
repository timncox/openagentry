/**
 * Internal types for adapter-wiki-fs.
 *
 * @module
 */

import type { WikiFsConfig } from './config.js';

export interface WikiFsContext {
  config: WikiFsConfig;
  workspaceRoot: string;
  projectRoot?: string;
}

export interface ResolvedTarget {
  scope: 'workspace' | 'project';
  vaultRoot: string;
  relativePath: string;
  prefixedPath: string;
  absolutePath: string;
}
