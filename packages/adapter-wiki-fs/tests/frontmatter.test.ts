import { describe, expect, it } from 'vitest';
import { parseFrontmatter, resolveTitle } from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses YAML frontmatter and content', () => {
    const raw = '---\ntitle: Hello\n---\n\nbody\n';
    const out = parseFrontmatter(raw);
    expect(out.data).toEqual({ title: 'Hello' });
    expect(out.content.trim()).toBe('body');
  });

  it('returns empty data when no frontmatter', () => {
    const out = parseFrontmatter('# Just a body\n');
    expect(out.data).toEqual({});
    expect(out.content).toContain('# Just a body');
  });

  it('does not throw on malformed frontmatter — returns raw as content', () => {
    const raw = '---\nbroken: [\n---\nbody\n';
    const out = parseFrontmatter(raw);
    expect(out.data).toEqual({});
    expect(out.content).toBe(raw);
  });
});

describe('resolveTitle', () => {
  it('prefers frontmatter.title', () => {
    expect(resolveTitle({ title: 'FT' }, '# H1\nbody', 'a.md')).toBe('FT');
  });

  it('falls back to frontmatter.name', () => {
    expect(resolveTitle({ name: 'FN' }, '# H1\nbody', 'a.md')).toBe('FN');
  });

  it('falls back to first H1 of content', () => {
    expect(resolveTitle({}, '# H1\nbody', 'a.md')).toBe('H1');
  });

  it('falls back to filename', () => {
    expect(resolveTitle({}, 'no heading\nbody', 'foo/bar.md')).toBe('bar.md');
  });

  it('non-string frontmatter.title is ignored, falls through', () => {
    expect(resolveTitle({ title: 42 }, '# H1', 'a.md')).toBe('H1');
  });

  it('ignores empty string frontmatter.title, falls through', () => {
    expect(resolveTitle({ title: '' }, '# H1', 'a.md')).toBe('H1');
  });

  it('does not capture body text when H1 line has only whitespace after #', () => {
    expect(resolveTitle({}, '# \nBody paragraph', 'doc.md')).toBe('doc.md');
  });
});
