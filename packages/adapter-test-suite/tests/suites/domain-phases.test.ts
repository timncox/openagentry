import { describe, it, expect } from 'vitest';
import { DOMAIN_PHASES } from '../../src/suites/domain.js';

describe('DOMAIN_PHASES', () => {
  it('contains exactly the four expected phases', () => {
    expect(DOMAIN_PHASES.has('init')).toBe(true);
    expect(DOMAIN_PHASES.has('read')).toBe(true);
    expect(DOMAIN_PHASES.has('write')).toBe(true);
    expect(DOMAIN_PHASES.has('transfer')).toBe(true);
    expect(DOMAIN_PHASES.size).toBe(4);
  });
});
