import { describe, expect, it } from 'vitest';
import * as lib from '../src/lib.js';

describe('@openagentry/cli library export', () => {
  it('exports dispatch + DispatchOptions', () => {
    expect(typeof lib.dispatch).toBe('function');
  });

  it('exports the commands registry, registerCommand, getCommand', () => {
    expect(lib.commands).toBeDefined();
    expect(typeof lib.registerCommand).toBe('function');
    expect(typeof lib.getCommand).toBe('function');
  });

  it('exports defineCommand', () => {
    expect(typeof lib.defineCommand).toBe('function');
  });

  it('exports parseArgs', () => {
    expect(typeof lib.parseArgs).toBe('function');
    expect(lib.parseArgs([])).toMatchObject({ command: 'help' });
  });

  it('exports Output', () => {
    expect(typeof lib.Output).toBe('function');
  });

  it('the registry is populated by the command/index side-effects', () => {
    expect(Object.keys(lib.commands).sort()).toEqual([
      'capabilities',
      'doctor',
      'help',
      'list',
      'version',
    ]);
  });
});
