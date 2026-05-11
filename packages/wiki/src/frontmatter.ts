import matter from 'gray-matter';

export interface Frontmatter {
  /** Parsed YAML data — empty object when absent or malformed. */
  data: Record<string, unknown>;
  /** Markdown body with the frontmatter block stripped. */
  body: string;
}

/**
 * Parse the YAML frontmatter from a markdown string. Never throws — malformed
 * frontmatter returns `{ data: {}, body: <raw content> }`.
 */
export function extractFrontmatter(content: string): Frontmatter {
  try {
    const parsed = matter(content);
    return {
      data: parsed.data as Record<string, unknown>,
      body: parsed.content,
    };
  } catch {
    return { data: {}, body: content };
  }
}
