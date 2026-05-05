import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../../src/internal/sha256.js';

describe('sha256Hex', () => {
  it('matches the known SHA-256 of "abc"', async () => {
    const hex = await sha256Hex(new TextEncoder().encode('abc'));
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the known SHA-256 of empty input', async () => {
    const hex = await sha256Hex(new Uint8Array(0));
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('returns a 64-character lowercase hex string', async () => {
    const hex = await sha256Hex(new TextEncoder().encode('the quick brown fox'));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});
