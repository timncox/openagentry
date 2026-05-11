import { describe, expect, it, beforeEach } from 'vitest';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';
import { WikiIndex } from '../src/wiki-index.js';

let index: WikiIndex;

beforeEach(async () => {
  const fake = new FakeWikiAdapter([
    {
      path: 'workspace/hub.md',
      scope: 'workspace',
      title: 'Hub',
      content: '# Hub\n\nLinks to [[Spoke A]] and [b](./spoke-b.md).',
    },
    {
      path: 'workspace/spoke-a.md',
      scope: 'workspace',
      title: 'Spoke A',
      content: '# Spoke A\n\nLinks back to [[Hub]].',
    },
    {
      path: 'workspace/spoke-b.md',
      scope: 'workspace',
      title: 'Spoke B',
      content: '# Spoke B\n\nNo links.',
    },
    {
      path: 'workspace/orphan.md',
      scope: 'workspace',
      title: 'Orphan',
      content: '# Orphan',
    },
  ]);
  index = new WikiIndex(fake);
  await index.build();
});

describe('WikiIndex.forwardLinks', () => {
  it('resolves [[wikilinks]] by title and relative paths against the page directory', () => {
    const out = index.forwardLinks('workspace/hub.md');
    expect(out.map((p) => p.path).sort()).toEqual([
      'workspace/spoke-a.md',
      'workspace/spoke-b.md',
    ]);
  });

  it('returns [] for a page with no links', () => {
    expect(index.forwardLinks('workspace/spoke-b.md')).toEqual([]);
  });

  it('returns [] for an unknown source path', () => {
    expect(index.forwardLinks('workspace/nope.md')).toEqual([]);
  });
});

describe('WikiIndex.backlinks', () => {
  it('returns every page whose forward links include this path', () => {
    const out = index.backlinks('workspace/spoke-a.md');
    expect(out.map((p) => p.path)).toEqual(['workspace/hub.md']);
  });

  it('returns [] when no page links here', () => {
    expect(index.backlinks('workspace/orphan.md')).toEqual([]);
  });
});
