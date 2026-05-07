import { describe, it, expect } from 'vitest';
import { publicUrl, presignGetUrl } from '../src/url.js';
import type { SignedFetch } from '../src/s3-client.js';

describe('publicUrl', () => {
  it('joins base + key with one slash', () => {
    expect(publicUrl('https://files.example.com', 'a/b.txt')).toBe('https://files.example.com/a/b.txt');
  });

  it('strips trailing slash from base', () => {
    expect(publicUrl('https://files.example.com/', 'a.txt')).toBe('https://files.example.com/a.txt');
  });

  it('strips leading slash from key', () => {
    expect(publicUrl('https://files.example.com', '/a.txt')).toBe('https://files.example.com/a.txt');
  });

  it('encodes key segments', () => {
    expect(publicUrl('https://files.example.com', 'a b/c.txt')).toBe('https://files.example.com/a%20b/c.txt');
  });
});

describe('presignGetUrl', () => {
  it('delegates to client.presignGet with the requested ttl', async () => {
    const calls: Array<[string, number]> = [];
    const client = {
      presignGet: async (key: string, ttl: number) => {
        calls.push([key, ttl]);
        return `https://example.test/${key}?X-Amz-Signature=fake`;
      },
    } as unknown as SignedFetch;
    const url = await presignGetUrl(client, 'foo.txt', 300);
    expect(calls).toEqual([['foo.txt', 300]]);
    expect(url).toBe('https://example.test/foo.txt?X-Amz-Signature=fake');
  });
});
