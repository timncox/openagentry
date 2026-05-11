export interface ExtractedLinks {
  /** Targets of `[[wikilink]]` blocks, trimmed, deduplicated. */
  wikilinks: string[];
  /** Targets of `[label](relative.md)` links — relative paths only, no http(s)/mailto/images. */
  paths: string[];
}

const WIKILINK_RE = /\[\[\s*([^\]|]+?)\s*(?:\|[^\]]*)?\]\]/g;
const MD_LINK_RE = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g;

/** Returns true if the URL points outside the local vault (skip in indexing). */
function isExternal(url: string): boolean {
  return /^(?:https?:|mailto:|tel:|ftp:|#)/i.test(url);
}

/**
 * Extract local-only links from a markdown body. Wikilinks (`[[Other Page]]`)
 * and CommonMark links to relative paths are returned; external URLs and image
 * embeds are ignored. Returns deduplicated arrays.
 */
export function extractLinks(body: string): ExtractedLinks {
  const wikilinks = new Set<string>();
  const paths = new Set<string>();

  for (const m of body.matchAll(WIKILINK_RE)) {
    const target = m[1]?.trim();
    if (target !== undefined && target.length > 0) wikilinks.add(target);
  }
  for (const m of body.matchAll(MD_LINK_RE)) {
    const url = m[1];
    if (url === undefined || url.length === 0) continue;
    if (isExternal(url)) continue;
    paths.add(url);
  }

  return { wikilinks: [...wikilinks], paths: [...paths] };
}
