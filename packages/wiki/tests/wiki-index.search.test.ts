import { describe, expect, it, beforeEach } from 'vitest';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';
import { WikiIndex } from '../src/wiki-index.js';

let index: WikiIndex;

beforeEach(async () => {
  const fake = new FakeWikiAdapter([
    {
      path: 'workspace/cloudflare.md',
      scope: 'workspace',
      title: 'Cloudflare',
      content:
        '---\ntags: [host]\nsummary: cf summary\n---\n# Cloudflare\n\nWe use Cloudflare for hosting.',
    },
    {
      path: 'workspace/vercel.md',
      scope: 'workspace',
      title: 'Vercel',
      content:
        '---\ntags: [host]\n---\n# Vercel\n\nVercel is the alternative host. Mentions cloudflare once.',
    },
    {
      path: 'project/setup.md',
      scope: 'project',
      title: 'Setup',
      content: '# Setup\n\nNothing about hosting providers.',
    },
  ]);
  index = new WikiIndex(fake);
  await index.build();
});

describe('WikiIndex.search', () => {
  it('returns title-match hits with the highest score', () => {
    const hits = index.search('Cloudflare');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.path).toBe('workspace/cloudflare.md');
    expect((hits[0]?.score ?? 0) > (hits[1]?.score ?? 0)).toBe(true);
  });

  it('matches frontmatter values', () => {
    const hits = index.search('cf summary');
    expect(hits.map((h) => h.path)).toContain('workspace/cloudflare.md');
  });

  it('matches body text', () => {
    const hits = index.search('alternative');
    expect(hits.map((h) => h.path)).toContain('workspace/vercel.md');
  });

  it('honours scope filter', () => {
    const hits = index.search('hosting', { scope: 'project' });
    expect(hits.every((h) => h.scope === 'project')).toBe(true);
  });

  it('returns at most opts.limit hits', () => {
    const hits = index.search('Cloudflare', { limit: 1 });
    expect(hits).toHaveLength(1);
  });

  it('search is case-insensitive', () => {
    const hits = index.search('CLOUDFLARE');
    expect(hits[0]?.path).toBe('workspace/cloudflare.md');
  });

  it('produces a snippet around the first body match', () => {
    const hits = index.search('alternative');
    const snippet = hits.find((h) => h.path === 'workspace/vercel.md')?.snippet ?? '';
    expect(snippet.toLowerCase()).toContain('alternative');
    expect(snippet.length).toBeLessThanOrEqual(160);
  });

  it('returns [] when there are no matches', () => {
    expect(index.search('nonexistent_xyzzy')).toEqual([]);
  });
});
