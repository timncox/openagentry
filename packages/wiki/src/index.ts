/**
 * @openagentry/wiki — search, frontmatter/tag lookup, and a backlinks graph
 * over any WikiAdapter.
 *
 * @module
 */

export { WikiIndex } from './wiki-index.js';
export type { IndexedPage, SearchOpts, SearchHit } from './types.js';
export { extractFrontmatter, type Frontmatter } from './frontmatter.js';
export { extractLinks, type ExtractedLinks } from './links.js';
