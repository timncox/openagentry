import { describe, expect, it } from 'vitest';
import { extractFrontmatter } from '../src/frontmatter.js';

describe('extractFrontmatter', () => {
  it('returns empty data and the full content when no frontmatter present', () => {
    const out = extractFrontmatter('# Just a heading\n\nNo frontmatter here.');
    expect(out.data).toEqual({});
    expect(out.body).toBe('# Just a heading\n\nNo frontmatter here.');
  });

  it('parses YAML frontmatter and returns the body without it', () => {
    const md = `---
title: Hello
tags: [intro, demo]
draft: true
---
# Hello

The body.`;
    const out = extractFrontmatter(md);
    expect(out.data).toMatchObject({
      title: 'Hello',
      tags: ['intro', 'demo'],
      draft: true,
    });
    expect(out.body).toBe('# Hello\n\nThe body.');
  });

  it('returns empty data when frontmatter is malformed (no throw)', () => {
    const md = `---
title: [unclosed
---
body`;
    const out = extractFrontmatter(md);
    expect(out.data).toEqual({});
    // gray-matter returns the raw content as the body when parse fails
    expect(out.body.length).toBeGreaterThan(0);
  });
});
