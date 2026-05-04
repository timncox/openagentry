import { describe, expectTypeOf, it } from 'vitest';
import type { AuthAdapter, AuthProvider, AuthSession } from '../../src/adapters/auth.js';
import type { EmailAdapter, EmailMessage, EmailSendResult } from '../../src/adapters/email.js';
import type { StorageAdapter, StorageObject, PutOpts } from '../../src/adapters/storage.js';

describe('AuthAdapter', () => {
  it('declares category="auth"', () => {
    expectTypeOf<AuthAdapter['category']>().toEqualTypeOf<'auth'>();
  });
  it('listProviders returns Promise<AuthProvider[]>', () => {
    expectTypeOf<AuthAdapter['listProviders']>().returns.toEqualTypeOf<Promise<AuthProvider[]>>();
  });
  it('verifySession takes a token, returns AuthSession | null', () => {
    expectTypeOf<AuthAdapter['verifySession']>().toEqualTypeOf<
      (token: string) => Promise<AuthSession | null>
    >();
  });
});

describe('EmailAdapter', () => {
  it('declares category="email"', () => {
    expectTypeOf<EmailAdapter['category']>().toEqualTypeOf<'email'>();
  });
  it('send takes EmailMessage → EmailSendResult', () => {
    expectTypeOf<EmailAdapter['send']>().toEqualTypeOf<
      (m: EmailMessage) => Promise<EmailSendResult>
    >();
  });
});

describe('StorageAdapter', () => {
  it('declares category="storage"', () => {
    expectTypeOf<StorageAdapter['category']>().toEqualTypeOf<'storage'>();
  });
  it('put takes (key, body, opts?) → Promise<StorageObject>', () => {
    expectTypeOf<StorageAdapter['put']>().toEqualTypeOf<
      (key: string, body: ArrayBuffer | Uint8Array | string, opts?: PutOpts) => Promise<StorageObject>
    >();
  });
  it('get takes key → Promise<StorageObject | null>', () => {
    expectTypeOf<StorageAdapter['get']>().toEqualTypeOf<
      (key: string) => Promise<StorageObject | null>
    >();
  });
});
