import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '../src/index.js';

describe('@openagentry/core sanity', () => {
  it('exports PROTOCOL_VERSION as a constant 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
