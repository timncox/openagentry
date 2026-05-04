import { describe, expect, it } from 'vitest';
import { CLI_NAME } from '../src/cli.js';

describe('@openagentry/cli sanity', () => {
  it('exports the expected CLI name', () => {
    expect(CLI_NAME).toBe('agentry');
  });
});
