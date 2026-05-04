import { describe, expectTypeOf, it } from 'vitest';
import type {
  Env,
  ConfirmToken,
  IsoTimestamp,
  AdapterId,
  Project,
  Deployment,
  LogLine,
  Region,
} from '../src/types.js';

describe('common types', () => {
  it('Env is the literal union "preview" | "prod" | "dev"', () => {
    expectTypeOf<Env>().toEqualTypeOf<'preview' | 'prod' | 'dev'>();
  });

  it('ConfirmToken is a branded string', () => {
    const token: ConfirmToken = 'abc' as ConfirmToken;
    expectTypeOf<ConfirmToken>().toMatchTypeOf<string>();
    expectTypeOf<string>().not.toEqualTypeOf<ConfirmToken>();
  });

  it('IsoTimestamp is a branded string', () => {
    expectTypeOf<IsoTimestamp>().toMatchTypeOf<string>();
  });

  it('AdapterId requires { category, id, version }', () => {
    expectTypeOf<AdapterId>().toEqualTypeOf<{
      category: string;
      id: string;
      version: string;
    }>();
  });

  it('Project requires { id, name, slug, createdAt }', () => {
    const p: Project = {
      id: '1',
      name: 'acme',
      slug: 'acme',
      createdAt: '2026-05-04T00:00:00Z' as IsoTimestamp,
    };
    expectTypeOf(p.id).toBeString();
    expectTypeOf(p.createdAt).toMatchTypeOf<IsoTimestamp>();
  });

  it('Deployment has id, env, url, status, createdAt', () => {
    const d: Deployment = {
      id: 'dep_1',
      env: 'prod',
      url: 'https://acme.com',
      status: 'success',
      createdAt: '2026-05-04T00:00:00Z' as IsoTimestamp,
    };
    expectTypeOf(d.env).toEqualTypeOf<Env>();
    expectTypeOf(d.status).toEqualTypeOf<'queued' | 'building' | 'success' | 'failed' | 'canceled'>();
  });

  it('LogLine is { timestamp, level, message }', () => {
    expectTypeOf<LogLine>().toEqualTypeOf<{
      timestamp: IsoTimestamp;
      level: 'debug' | 'info' | 'warn' | 'error';
      message: string;
      meta?: Record<string, unknown>;
    }>();
  });

  it('Region is a branded string', () => {
    expectTypeOf<Region>().toMatchTypeOf<string>();
  });
});
