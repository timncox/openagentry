import { describe, expectTypeOf, it } from 'vitest';
import type {
  DomainAdapter,
  Domain,
  DomainTransfer,
  DnsRecord,
  DomainAvailability,
} from '../../src/adapters/domain.js';
import type {
  RepoAdapter,
  Repository,
  RepoCreateOpts,
} from '../../src/adapters/repo.js';

describe('DomainAdapter', () => {
  it('declares category="domain"', () => {
    expectTypeOf<DomainAdapter['category']>().toEqualTypeOf<'domain'>();
  });
  it('checkAvailability returns DomainAvailability with price', () => {
    expectTypeOf<DomainAdapter['checkAvailability']>().toEqualTypeOf<
      (domain: string) => Promise<DomainAvailability>
    >();
    expectTypeOf<DomainAvailability>().toMatchTypeOf<{
      domain: string;
      available: boolean;
      priceUsd?: number;
    }>();
  });
  it('purchase returns Domain', () => {
    expectTypeOf<DomainAdapter['purchase']>().returns.toEqualTypeOf<Promise<Domain>>();
  });
  it('listRecords + setRecord operate on DnsRecord', () => {
    expectTypeOf<DomainAdapter['listRecords']>().toEqualTypeOf<
      (domain: string) => Promise<DnsRecord[]>
    >();
  });
  it('initiateTransfer returns DomainTransfer', () => {
    expectTypeOf<DomainAdapter['initiateTransfer']>().returns.toEqualTypeOf<Promise<DomainTransfer>>();
  });
});

describe('RepoAdapter', () => {
  it('declares category="repo"', () => {
    expectTypeOf<RepoAdapter['category']>().toEqualTypeOf<'repo'>();
  });
  it('create takes RepoCreateOpts → Promise<Repository>', () => {
    expectTypeOf<RepoAdapter['create']>().toEqualTypeOf<
      (opts: RepoCreateOpts) => Promise<Repository>
    >();
  });
  it('Repository has owner, name, url, defaultBranch', () => {
    expectTypeOf<Repository>().toMatchTypeOf<{
      owner: string;
      name: string;
      url: string;
      defaultBranch: string;
    }>();
  });
});
