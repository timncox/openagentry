import { describe, expect, it } from 'vitest';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';
import { WikiIndex } from '../src/wiki-index.js';

describe('WikiIndex.refresh', () => {
  it('picks up newly-added pages', async () => {
    const fake = new FakeWikiAdapter([
      { path: 'workspace/a.md', scope: 'workspace', title: 'A', content: '# A' },
    ]);
    const index = new WikiIndex(fake);
    await index.build();
    expect(index.size).toBe(1);

    fake.put({ path: 'workspace/b.md', scope: 'workspace', title: 'B', content: '# B' });
    await index.refresh();
    expect(index.size).toBe(2);
    expect(index.get('workspace/b.md')?.title).toBe('B');
  });

  it('drops pages removed from the underlying adapter', async () => {
    const fake = new FakeWikiAdapter([
      { path: 'workspace/a.md', scope: 'workspace', title: 'A', content: '# A' },
      { path: 'workspace/b.md', scope: 'workspace', title: 'B', content: '# B' },
    ]);
    const index = new WikiIndex(fake);
    await index.build();
    expect(index.size).toBe(2);

    fake.delete('workspace/a.md');
    await index.refresh();
    expect(index.size).toBe(1);
    expect(index.get('workspace/a.md')).toBeUndefined();
  });

  it('reflects edited body content (link graph updates)', async () => {
    const fake = new FakeWikiAdapter([
      {
        path: 'workspace/hub.md',
        scope: 'workspace',
        title: 'Hub',
        content: '# Hub\n\nLinks to [[A]].',
      },
      { path: 'workspace/a.md', scope: 'workspace', title: 'A', content: '# A' },
      { path: 'workspace/b.md', scope: 'workspace', title: 'B', content: '# B' },
    ]);
    const index = new WikiIndex(fake);
    await index.build();
    expect(index.backlinks('workspace/a.md').map((p) => p.path)).toEqual([
      'workspace/hub.md',
    ]);
    expect(index.backlinks('workspace/b.md')).toEqual([]);

    fake.put({
      path: 'workspace/hub.md',
      scope: 'workspace',
      title: 'Hub',
      content: '# Hub\n\nNow links to [[B]].',
    });
    await index.refresh();
    expect(index.backlinks('workspace/a.md')).toEqual([]);
    expect(index.backlinks('workspace/b.md').map((p) => p.path)).toEqual([
      'workspace/hub.md',
    ]);
  });
});
