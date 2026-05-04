import { describe, expect, it } from 'vitest';
import { SERVER_NAME } from '../src/index.js';

describe('@openagentry/mcp sanity', () => {
  it('exports the expected server name', () => {
    expect(SERVER_NAME).toBe('agentry-mcp');
  });
});
