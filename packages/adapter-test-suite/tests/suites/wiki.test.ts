import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const goodFixture = resolve(here, '../fixtures/good-wiki-functional');

describe('wiki functional suite', () => {
  it('passes all 6 checks against good-wiki-functional fixture', async () => {
    const result = await runSuite({ target: goodFixture });
    const failed = result.checks.filter((c) => c.status === 'fail');
    if (failed.length > 0) console.error(JSON.stringify(failed, null, 2));
    expect(result.failed).toBe(0);
    const wikiCheckIds = result.checks
      .filter((c) => c.id.startsWith('wiki/'))
      .map((c) => c.id);
    expect(wikiCheckIds).toContain('wiki/list-returns-array');
    expect(wikiCheckIds).toContain('wiki/write-then-read');
    expect(wikiCheckIds).toContain('wiki/append-extends');
    expect(wikiCheckIds).toContain('wiki/search-finds-content');
    expect(wikiCheckIds).toContain('wiki/scope-isolation');
    expect(wikiCheckIds).toContain('wiki/structured-errors');
  });
});
