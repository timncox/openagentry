import { describe, it, expect } from 'vitest';
import { listProviders } from '../../src/ops/providers.js';
import type { NextAuthOptions } from 'next-auth';

const fakeProvider = (id: string, name: string): unknown => ({
  id,
  name,
  type: 'credentials',
});

describe('listProviders', () => {
  it('maps each provider to {id, label, enabled: true}', async () => {
    const opts = {
      providers: [
        fakeProvider('credentials', 'Email'),
        fakeProvider('github', 'GitHub'),
      ],
    } as unknown as NextAuthOptions;
    const result = await listProviders(opts);
    expect(result).toEqual([
      { id: 'credentials', label: 'Email', enabled: true },
      { id: 'github', label: 'GitHub', enabled: true },
    ]);
  });

  it('falls back to "id" as label when name is missing', async () => {
    const opts = {
      providers: [{ id: 'oauth-mystery', type: 'oauth' }],
    } as unknown as NextAuthOptions;
    const result = await listProviders(opts);
    expect(result).toEqual([
      { id: 'oauth-mystery', label: 'oauth-mystery', enabled: true },
    ]);
  });

  it('throws E_NEXTAUTH_SCHEMA when a provider is missing an id', async () => {
    const opts = {
      providers: [{ name: 'OrphanProvider' }],
    } as unknown as NextAuthOptions;
    await expect(listProviders(opts)).rejects.toThrow(/E_NEXTAUTH_SCHEMA|id/);
  });
});
