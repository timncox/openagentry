/**
 * createWikiFsAdapter — assembles a WikiAdapter from a config object.
 *
 * @module
 */

import { resolve } from 'node:path';
import type {
  WikiAdapter,
  WikiHit,
  WikiPage,
  WikiScope,
  WikiWriteResult,
} from '@openagentry/core';
import { parseWikiFsConfig, type WikiFsConfig } from './config.js';
import { listOp } from './ops/list.js';
import { readOp } from './ops/read.js';
import { writeOp } from './ops/write.js';
import { appendOp } from './ops/append.js';
import { searchOp } from './ops/search.js';
import type { WikiFsContext } from './types.js';

export interface WikiFsAdapter extends WikiAdapter {
  readonly category: 'wiki';
  readonly id: 'wiki-fs';
}

export function createWikiFsAdapter(input: unknown): WikiFsAdapter {
  const config: WikiFsConfig = parseWikiFsConfig(input);
  const ctx: WikiFsContext = {
    config,
    workspaceRoot: resolve(config.workspaceVaultPath),
    ...(config.projectVaultPath !== undefined
      ? { projectRoot: resolve(config.projectVaultPath) }
      : {}),
  };

  const adapter: WikiFsAdapter = {
    category: 'wiki',
    id: 'wiki-fs',
    async list(scope?: WikiScope): Promise<WikiPage[]> {
      return listOp(ctx, scope);
    },
    async read(path: string): Promise<string> {
      return readOp(ctx, path);
    },
    async write(path: string, content: string): Promise<WikiWriteResult> {
      return writeOp(ctx, path, content);
    },
    async append(path: string, content: string): Promise<WikiWriteResult> {
      return appendOp(ctx, path, content);
    },
    async search(query: string, scope?: WikiScope): Promise<WikiHit[]> {
      return searchOp(ctx, query, scope);
    },
  };
  return Object.freeze(adapter);
}
