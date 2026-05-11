import { describe, expect, it, beforeEach } from 'vitest';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';
import { WikiIndex } from '../src/wiki-index.js';

let index: WikiIndex;

beforeEach(async () => {
  const fake = new FakeWikiAdapter([
    {
      path: 'workspace/a.md',
      scope: 'workspace',
      title: 'Cloudflare',
      content: '---\ntags: [host, primary]\n---\n# Cloudflare',
    },
    {
      path: 'workspace/b.md',
      scope: 'workspace',
      title: 'Vercel',
      content: '---\ntags: [host]\n---\n# Vercel',
    },
    {
      path: 'project/c.md',
      scope: 'project',
      title: 'Cloudflare',
      content: '---\ntags: [primary]\n---\n# Cloudflare (project)',
    },
  ]);
  index = new WikiIndex(fake);
  await index.build();
});

describe('WikiIndex.byTitle', () => {
  it('returns all pages whose title matches exactly', () => {
    const pages = index.byTitle('Cloudflare');
    expect(pages.map((p) => p.path).sort()).toEqual([
      'project/c.md',
      'workspace/a.md',
    ]);
  });

  it('is case-insensitive', () => {
    expect(index.byTitle('cloudflare')).toHaveLength(2);
  });

  it('honours scope filter', () => {
    const pages = index.byTitle('Cloudflare', 'project');
    expect(pages).toHaveLength(1);
    expect(pages[0]?.path).toBe('project/c.md');
  });

  it('returns [] when no page matches', () => {
    expect(index.byTitle('Nope')).toEqual([]);
  });
});

describe('WikiIndex.byTag', () => {
  it('returns all pages whose frontmatter.tags includes the tag', () => {
    const pages = index.byTag('host');
    expect(pages.map((p) => p.path).sort()).toEqual([
      'workspace/a.md',
      'workspace/b.md',
    ]);
  });

  it('honours scope filter', () => {
    const pages = index.byTag('primary', 'project');
    expect(pages).toHaveLength(1);
    expect(pages[0]?.path).toBe('project/c.md');
  });

  it('treats single-string tags the same as a one-element array', async () => {
    const fake = new FakeWikiAdapter([
      {
        path: 'workspace/single.md',
        scope: 'workspace',
        title: 'Single',
        content: '---\ntags: lonely\n---\n# Single',
      },
    ]);
    const idx = new WikiIndex(fake);
    await idx.build();
    expect(idx.byTag('lonely')).toHaveLength(1);
  });

  it('returns [] when no page matches', () => {
    expect(index.byTag('nope')).toEqual([]);
  });
});
