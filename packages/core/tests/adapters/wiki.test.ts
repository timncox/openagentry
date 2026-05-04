import { describe, expectTypeOf, it } from 'vitest';
import type {
  WikiAdapter,
  WikiPage,
  WikiHit,
  WikiScope,
  WikiWriteResult,
} from '../../src/adapters/wiki.js';

describe('WikiAdapter type contract', () => {
  it('declares category="wiki"', () => {
    expectTypeOf<WikiAdapter['category']>().toEqualTypeOf<'wiki'>();
  });

  it('WikiScope is the literal "workspace" | "project" | "all"', () => {
    expectTypeOf<WikiScope>().toEqualTypeOf<'workspace' | 'project' | 'all'>();
  });

  it('search takes (query, scope?) → Promise<WikiHit[]>', () => {
    expectTypeOf<WikiAdapter['search']>().toEqualTypeOf<
      (query: string, scope?: WikiScope) => Promise<WikiHit[]>
    >();
  });

  it('read takes path → Promise<string>', () => {
    expectTypeOf<WikiAdapter['read']>().toEqualTypeOf<(path: string) => Promise<string>>();
  });

  it('list takes scope? → Promise<WikiPage[]>', () => {
    expectTypeOf<WikiAdapter['list']>().toEqualTypeOf<
      (scope?: WikiScope) => Promise<WikiPage[]>
    >();
  });

  it('write takes (path, content) → WikiWriteResult', () => {
    expectTypeOf<WikiAdapter['write']>().toEqualTypeOf<
      (path: string, content: string) => Promise<WikiWriteResult>
    >();
  });

  it('WikiHit has path, scope, snippet, score', () => {
    expectTypeOf<WikiHit>().toMatchTypeOf<{
      path: string;
      scope: 'workspace' | 'project';
      snippet: string;
      score: number;
    }>();
  });
});
