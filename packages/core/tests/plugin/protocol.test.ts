import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  CORE_SUPPORTS,
  isProtocolCompatible,
  parseProtocolRange,
} from '../../src/plugin/protocol.js';

describe('protocol versioning', () => {
  it('PROTOCOL_VERSION is 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('CORE_SUPPORTS includes the current PROTOCOL_VERSION', () => {
    expect(CORE_SUPPORTS).toContain(PROTOCOL_VERSION);
  });

  it('parseProtocolRange handles "1", "^1", ">=1"', () => {
    expect(parseProtocolRange('1')).toEqual([1]);
    expect(parseProtocolRange('^1')).toEqual([1]);
    expect(parseProtocolRange('>=1')).toEqual([1]);
  });

  it('parseProtocolRange throws on malformed input', () => {
    expect(() => parseProtocolRange('not-a-version')).toThrow(/protocol/i);
  });

  it('isProtocolCompatible returns true when plugin requires supported version', () => {
    expect(isProtocolCompatible('1')).toBe(true);
    expect(isProtocolCompatible('^1')).toBe(true);
    expect(isProtocolCompatible('>=1')).toBe(true);
  });

  it('isProtocolCompatible returns false for unsupported version', () => {
    expect(isProtocolCompatible('99')).toBe(false);
    expect(isProtocolCompatible('^99')).toBe(false);
  });
});
