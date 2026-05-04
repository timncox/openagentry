/**
 * WikiAdapter — read/write/search the workspace and per-project wikis.
 *
 * Adapters mirror to external systems (Obsidian, Notion, GitBook).
 * Default storage is markdown files in `wiki/` folders.
 *
 * @module
 */

import type { IsoTimestamp } from '../types.js';

export type WikiScope = 'workspace' | 'project' | 'all';

export interface WikiPage {
  /** Path relative to the wiki root, e.g. "decisions/0001-cloudflare-vs-vercel.md". */
  path: string;
  scope: 'workspace' | 'project';
  title: string;
  updatedAt: IsoTimestamp;
}

export interface WikiHit {
  path: string;
  scope: 'workspace' | 'project';
  snippet: string;
  score: number;
}

export interface WikiWriteResult {
  path: string;
  /** Whether the write created a new page or updated an existing one. */
  status: 'created' | 'updated' | 'unchanged';
  /** Diff in unified format if status is "updated". */
  diff?: string;
}

export interface WikiAdapter {
  readonly category: 'wiki';
  readonly id: string;

  search(query: string, scope?: WikiScope): Promise<WikiHit[]>;
  read(path: string): Promise<string>;
  list(scope?: WikiScope): Promise<WikiPage[]>;
  write(path: string, content: string): Promise<WikiWriteResult>;
  append(path: string, content: string): Promise<WikiWriteResult>;
}
