import { describe, expect, it } from 'vitest';
import { extractLinks } from '../src/links.js';

describe('extractLinks', () => {
  it('finds Obsidian-style [[wikilinks]]', () => {
    const out = extractLinks('See [[Other Page]] and [[ One More ]] for context.');
    expect(out.wikilinks).toEqual(['Other Page', 'One More']);
    expect(out.paths).toEqual([]);
  });

  it('finds CommonMark-style relative-path links', () => {
    const out = extractLinks(
      'Refer to [the spec](./spec.md) and [decisions](../decisions/0001-host.md).',
    );
    expect(out.paths).toEqual(['./spec.md', '../decisions/0001-host.md']);
    expect(out.wikilinks).toEqual([]);
  });

  it('ignores http/https/mailto and image links', () => {
    const out = extractLinks(
      'See [Anthropic](https://anthropic.com), [mail](mailto:x@y.z), and ![alt](./img.png).',
    );
    expect(out.paths).toEqual([]);
    expect(out.wikilinks).toEqual([]);
  });

  it('deduplicates within a single document', () => {
    const out = extractLinks('[[A]] and [[A]] and [link](./b.md) and [link](./b.md).');
    expect(out.wikilinks).toEqual(['A']);
    expect(out.paths).toEqual(['./b.md']);
  });

  it('returns empty arrays for empty input', () => {
    const out = extractLinks('');
    expect(out.wikilinks).toEqual([]);
    expect(out.paths).toEqual([]);
  });
});
