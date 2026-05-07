import { describe, it, expect } from 'vitest';
import { REPO_PHASES } from '../../src/suites/repo.js';

describe('REPO_PHASES', () => {
  it('contains exactly the four expected phases', () => {
    expect(REPO_PHASES.has('init')).toBe(true);
    expect(REPO_PHASES.has('read')).toBe(true);
    expect(REPO_PHASES.has('createProject')).toBe(true);
    expect(REPO_PHASES.has('delete')).toBe(true);
    expect(REPO_PHASES.size).toBe(4);
  });
});
