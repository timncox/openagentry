import { describe, it, expect } from 'vitest';
import { parseNamecheapXml, xmlAttr, xmlBool, xmlInt } from '../src/xml.js';

// ---------------------------------------------------------------------------
// Fixture XML strings
// ---------------------------------------------------------------------------

const OK_ENVELOPE = `
<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors />
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult Domain="example.com" Available="true" IsPremiumName="false" />
  </CommandResponse>
</ApiResponse>
`.trim();

const ERROR_ENVELOPE = `
<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors>
    <Error Number="1010101">Bad API key</Error>
  </Errors>
  <CommandResponse />
</ApiResponse>
`.trim();

const MULTI_ERROR_ENVELOPE = `
<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="ERROR" xmlns="http://api.namecheap.com/xml.response">
  <Errors>
    <Error Number="1011147">IP not whitelisted</Error>
    <Error Number="1011148">Another IP error</Error>
  </Errors>
  <CommandResponse />
</ApiResponse>
`.trim();

// ---------------------------------------------------------------------------
// parseNamecheapXml
// ---------------------------------------------------------------------------

describe('parseNamecheapXml — OK envelope', () => {
  it('parses Status="OK" correctly', () => {
    const env = parseNamecheapXml(OK_ENVELOPE);
    expect(env.ApiResponse['@_Status']).toBe('OK');
  });

  it('exposes CommandResponse', () => {
    const env = parseNamecheapXml(OK_ENVELOPE);
    expect(env.ApiResponse.CommandResponse).toBeDefined();
  });
});

describe('parseNamecheapXml — ERROR envelope', () => {
  it('parses Status="ERROR" correctly', () => {
    const env = parseNamecheapXml(ERROR_ENVELOPE);
    expect(env.ApiResponse['@_Status']).toBe('ERROR');
  });

  it('exposes Errors block with Error entry', () => {
    const env = parseNamecheapXml(ERROR_ENVELOPE);
    expect(env.ApiResponse.Errors).toBeDefined();
    const errors = env.ApiResponse.Errors?.Error;
    expect(errors).toBeDefined();
    // Error is always an array (isArray config)
    expect(Array.isArray(errors)).toBe(true);
    if (!Array.isArray(errors)) return;
    expect(errors[0]['@_Number']).toBe('1010101');
    expect(errors[0]['#text']).toBe('Bad API key');
  });

  it('handles multiple Error entries', () => {
    const env = parseNamecheapXml(MULTI_ERROR_ENVELOPE);
    const errors = env.ApiResponse.Errors?.Error;
    expect(Array.isArray(errors)).toBe(true);
    if (!Array.isArray(errors)) return;
    expect(errors.length).toBe(2);
    expect(errors[0]['@_Number']).toBe('1011147');
    expect(errors[1]['@_Number']).toBe('1011148');
  });
});

describe('parseNamecheapXml — malformed input', () => {
  it('throws E_NAMECHEAP_UPSTREAM on completely invalid XML', () => {
    expect(() => parseNamecheapXml('not xml at all <<<')).toThrow(
      expect.objectContaining({ code: 'E_NAMECHEAP_UPSTREAM' }),
    );
  });

  it('throws E_NAMECHEAP_UPSTREAM when root element is not ApiResponse', () => {
    expect(() => parseNamecheapXml('<SomeOtherRoot><Child/></SomeOtherRoot>')).toThrow(
      expect.objectContaining({ code: 'E_NAMECHEAP_UPSTREAM' }),
    );
  });

  it('throws E_NAMECHEAP_UPSTREAM on empty string', () => {
    expect(() => parseNamecheapXml('')).toThrow(
      expect.objectContaining({ code: 'E_NAMECHEAP_UPSTREAM' }),
    );
  });
});

// ---------------------------------------------------------------------------
// xmlAttr
// ---------------------------------------------------------------------------

describe('xmlAttr', () => {
  it('reads a @_-prefixed attribute from a parsed node', () => {
    const node = { '@_Status': 'OK', '@_Type': 'namecheap.domains.check' };
    expect(xmlAttr(node, 'Status')).toBe('OK');
    expect(xmlAttr(node, 'Type')).toBe('namecheap.domains.check');
  });

  it('returns undefined for a missing attribute', () => {
    const node = { '@_Status': 'OK' };
    expect(xmlAttr(node, 'Missing')).toBeUndefined();
  });

  it('returns undefined when node is null', () => {
    expect(xmlAttr(null, 'Status')).toBeUndefined();
  });

  it('returns undefined when node is a primitive', () => {
    expect(xmlAttr('string', 'Status')).toBeUndefined();
    expect(xmlAttr(42, 'Status')).toBeUndefined();
  });

  it('returns undefined when attribute value is not a string', () => {
    const node = { '@_Count': 5 };
    expect(xmlAttr(node, 'Count')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// xmlBool
// ---------------------------------------------------------------------------

describe('xmlBool', () => {
  it('"true" → true', () => {
    expect(xmlBool('true')).toBe(true);
  });

  it('"True" → true (case-insensitive)', () => {
    expect(xmlBool('True')).toBe(true);
  });

  it('"TRUE" → true', () => {
    expect(xmlBool('TRUE')).toBe(true);
  });

  it('"false" → false', () => {
    expect(xmlBool('false')).toBe(false);
  });

  it('"False" → false', () => {
    expect(xmlBool('False')).toBe(false);
  });

  it('"1" → false (only "true" is truthy)', () => {
    expect(xmlBool('1')).toBe(false);
  });

  it('undefined → false', () => {
    expect(xmlBool(undefined)).toBe(false);
  });

  it('empty string → false', () => {
    expect(xmlBool('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// xmlInt
// ---------------------------------------------------------------------------

describe('xmlInt', () => {
  it('parses a valid integer string', () => {
    expect(xmlInt('1800')).toBe(1800);
  });

  it('parses "0"', () => {
    expect(xmlInt('0')).toBe(0);
  });

  it('parses a negative integer', () => {
    expect(xmlInt('-5')).toBe(-5);
  });

  it('returns undefined for undefined input', () => {
    expect(xmlInt(undefined)).toBeUndefined();
  });

  it('returns undefined for a non-numeric string', () => {
    expect(xmlInt('abc')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(xmlInt('')).toBeUndefined();
  });

  it('truncates to integer (parseInt behavior) for float strings', () => {
    expect(xmlInt('10.9')).toBe(10);
  });
});
