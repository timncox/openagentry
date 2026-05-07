import { describe, it, expect, vi } from 'vitest';
import { createR2StorageAdapter } from '../src/adapter.js';

const validInput = {
  accountId: '0'.repeat(32),
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  bucket: 'my-bucket',
  endpoint: 'https://example.test',
};

describe('createR2StorageAdapter', () => {
  it('returns a frozen StorageAdapter shape', () => {
    const adapter = createR2StorageAdapter(validInput);
    expect(adapter.category).toBe('storage');
    expect(adapter.id).toBe('storage-r2');
    expect(typeof adapter.put).toBe('function');
    expect(typeof adapter.get).toBe('function');
    expect(typeof adapter.delete).toBe('function');
    expect(typeof adapter.list).toBe('function');
    expect(Object.isFrozen(adapter)).toBe(true);
  });

  it('exposes getCapabilities returning supportsPublic when publicBaseUrl set', () => {
    const adapter = createR2StorageAdapter({ ...validInput, publicBaseUrl: 'https://files.example.com' });
    expect(adapter.getCapabilities?.().supportsPublic).toBe(true);
  });

  it('exposes getCapabilities returning supportsPublic=false when publicBaseUrl absent', () => {
    const adapter = createR2StorageAdapter(validInput);
    expect(adapter.getCapabilities?.().supportsPublic).toBe(false);
  });

  it('throws via parseR2StorageConfig on invalid config', () => {
    expect(() => createR2StorageAdapter({ ...validInput, accountId: 'bogus' })).toThrow();
  });

  it('wires put through to network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    const adapter = createR2StorageAdapter(validInput);
    const result = await adapter.put('a.txt', 'hello');
    expect(result.size).toBe(5);
    vi.unstubAllGlobals();
  });
});
