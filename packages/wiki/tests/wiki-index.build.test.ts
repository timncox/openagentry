import { describe, expect, it } from 'vitest';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';
import { WikiIndex } from '../src/wiki-index.js';

describe('WikiIndex.build', () => {
  it('indexes every page returned by adapter.list', async () => {
    const fake = new FakeWikiAdapter([
      {
        path: 'workspace/a.md',
        scope: 'workspace',
        title: 'A',
        content: '---\ntags: [one]\n---\n# A\n\nSee [[B]].',
      },
      {
        path: 'workspace/b.md',
        scope: 'workspace',
        title: 'B',
        content: '---\ntags: [one, two]\n---\n# B',
      },
    ]);
    const index = new WikiIndex(fake);
    await index.build();
    expect(index.size).toBe(2);
  });

  it('parses frontmatter and links per page', async () => {
    const fake = new FakeWikiAdapter([
      {
        path: 'workspace/a.md',
        scope: 'workspace',
        title: 'A',
        content: '---\ntags: [one]\n---\n# A\n\nSee [[B]] and [c](./c.md).',
      },
    ]);
    const index = new WikiIndex(fake);
    await index.build();
    const page = index.get('workspace/a.md');
    expect(page).toBeDefined();
    expect(page?.frontmatter).toMatchObject({ tags: ['one'] });
    expect(page?.wikilinks).toEqual(['B']);
    expect(page?.relativePaths).toEqual(['./c.md']);
    expect(page?.body).toContain('# A');
  });

  it('is empty before build() is called', () => {
    const index = new WikiIndex(new FakeWikiAdapter());
    expect(index.size).toBe(0);
    expect(index.get('workspace/a.md')).toBeUndefined();
  });
});
