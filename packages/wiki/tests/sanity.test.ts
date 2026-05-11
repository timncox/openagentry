import { describe, expect, it } from 'vitest';
import { WikiIndex } from '../src/index.js';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';

describe('package sanity', () => {
  it('exports WikiIndex from the barrel', () => {
    expect(typeof WikiIndex).toBe('function');
  });

  it('FakeWikiAdapter round-trips seeded pages', async () => {
    const fake = new FakeWikiAdapter([
      { path: 'workspace/a.md', scope: 'workspace', title: 'A', content: '# A' },
      { path: 'project/b.md',   scope: 'project',   title: 'B', content: '# B' },
    ]);
    const all = await fake.list('all');
    expect(all).toHaveLength(2);
    expect(await fake.read('workspace/a.md')).toBe('# A');
  });
});
