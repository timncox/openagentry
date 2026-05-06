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

  it('returns a fail for the wrong-category bad-wiki fixture', async () => {
    const fixture = resolve(here, '../fixtures/bad-wiki');
    const result = await runSuite({ target: fixture });
    // The runner dispatches by manifest category — bad-wiki's manifest says
    // 'host', so the host suite runs and fails on bootstrap. The wiki suite
    // never sees this fixture. Just confirm at least one check failed.
    expect(result.failed).toBeGreaterThan(0);
  });

  it('reports failures against bad-wiki-functional for the major checks', async () => {
    const fixture = resolve(here, '../fixtures/bad-wiki-functional');
    const result = await runSuite({ target: fixture });
    const wikiFails = result.checks.filter(
      (c) => c.id.startsWith('wiki/') && c.status === 'fail',
    );
    // All 6 wiki checks fail deterministically against bad-wiki-functional:
    //   list-returns-array   — list() returns a string, not an array
    //   write-then-read      — write is a no-op; read returns '' (token absent)
    //   append-extends       — append is a no-op; read returns '' (neither 'one' nor 'two')
    //   search-finds-content — search always returns []
    //   scope-isolation      — list('project') returns a string (non-array guard fires)
    //   structured-errors    — read always returns '' instead of throwing
    expect(wikiFails.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        'wiki/list-returns-array',
        'wiki/write-then-read',
        'wiki/append-extends',
        'wiki/search-finds-content',
        'wiki/scope-isolation',
        'wiki/structured-errors',
      ]),
    );
  });
});
