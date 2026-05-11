import { describe, expect, it } from 'vitest';
import { PLACEHOLDER } from '../src/index.js';
import { FakeWikiAdapter } from './fake-wiki-adapter.js';

describe('package sanity', () => {
  it('exports the placeholder identifier', () => {
    expect(PLACEHOLDER).toBe('@openagentry/wiki');
  });

  it('FakeWikiAdapter round-trips seeded pages', async () => {
    const fake = new FakeWikiAdapter([
      { path: 'workspace/a.md', scope: 'workspace', title: 'A', content: '# A' },
      { path: 'project/b.md',   scope: 'project',   title: 'B', content: '# B' },
    ]);
    const all = await fake.list('all');
    expect(all).toHaveLength(2);
    const ws = await fake.list('workspace');
    expect(ws).toHaveLength(1);
    expect(ws[0]?.title).toBe('A');
    expect(await fake.read('workspace/a.md')).toBe('# A');
  });
});
