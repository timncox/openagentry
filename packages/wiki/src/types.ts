import type { WikiPage, WikiScope } from '@openagentry/core';

export interface IndexedPage extends WikiPage {
  /** Parsed frontmatter (empty object when absent or malformed). */
  frontmatter: Record<string, unknown>;
  /** Markdown body with frontmatter stripped. Used by search() and as snippet source. */
  body: string;
  /** Resolved targets of `[[wikilinks]]` in the body (deduplicated). */
  wikilinks: string[];
  /** Relative `./path.md` link targets in the body (deduplicated, no external URLs). */
  relativePaths: string[];
}

export interface SearchOpts {
  /** Maximum number of hits to return. Default: 25. */
  limit?: number;
  /** Optional scope filter. Default: 'all'. */
  scope?: WikiScope;
}

export interface SearchHit {
  path: string;
  scope: 'workspace' | 'project';
  title: string;
  /** Body snippet around the first match (≤160 chars). */
  snippet: string;
  /** Title-boosted score: 3× title match + 2× frontmatter match + 1× body match. */
  score: number;
}
