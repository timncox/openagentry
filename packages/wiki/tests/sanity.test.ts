import { describe, expect, it } from 'vitest';
import { PLACEHOLDER } from '../src/index.js';

describe('package sanity', () => {
  it('exports the placeholder identifier', () => {
    expect(PLACEHOLDER).toBe('@openagentry/wiki');
  });
});
