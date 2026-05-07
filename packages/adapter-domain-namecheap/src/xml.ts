/**
 * XML parsing helpers for the Namecheap API.
 *
 * Namecheap returns XML responses for all API calls. We parse with
 * fast-xml-parser (ignoreAttributes=false, attributeNamePrefix='@_') so that
 * element content and XML attributes are both accessible.
 *
 * A single XMLParser instance is created here and reused across all calls
 * (thread-safe for reads; fast-xml-parser is stateless once configured).
 *
 * @module
 */

import { XMLParser } from 'fast-xml-parser';
import { namecheapError } from './errors.js';

// ---------------------------------------------------------------------------
// Parser singleton
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  parseAttributeValue: false, // we coerce to bool/int explicitly when needed
  isArray: (_name, jpath) => {
    // Force these elements to always be arrays even when there is only one
    // child — prevents the parser collapsing a single <host> or <Error> into
    // a plain object.
    return (
      jpath === 'ApiResponse.CommandResponse.DomainGetHostsResult.host' ||
      jpath === 'ApiResponse.CommandResponse.DomainDNSGetHostsResult.host' ||
      jpath === 'ApiResponse.CommandResponse.DomainCheckResult' ||
      jpath === 'ApiResponse.Errors.Error'
    );
  },
});

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export interface NamecheapErrorNode {
  '#text': string;
  '@_Number': string;
}

export interface ApiResponseEnvelope {
  ApiResponse: {
    '@_Status': string;
    Errors?: {
      Error?: NamecheapErrorNode | NamecheapErrorNode[];
    };
    CommandResponse?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw Namecheap XML response string into a typed envelope.
 * Throws `E_NAMECHEAP_UPSTREAM` on malformed XML (the API contract is
 * violated — this should never happen in normal operation).
 */
export function parseNamecheapXml(xml: string): ApiResponseEnvelope {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (cause) {
    throw namecheapError({
      code: 'E_NAMECHEAP_UPSTREAM',
      message: 'Namecheap returned non-XML or malformed XML response',
      phase: 'read',
      suggestedFix:
        'The Namecheap API returned a response that could not be parsed as XML. This is unexpected — check Namecheap API status.',
      context: { parseError: cause instanceof Error ? cause.message : String(cause) },
      cause,
    });
  }

  // Sanity-check the envelope shape.
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !('ApiResponse' in (parsed as object))
  ) {
    throw namecheapError({
      code: 'E_NAMECHEAP_UPSTREAM',
      message: 'Namecheap XML response missing expected ApiResponse root element',
      phase: 'read',
      suggestedFix:
        'The Namecheap API returned an unexpected response shape. Check Namecheap API status.',
      context: { rawXml: xml.slice(0, 500) },
    });
  }

  return parsed as ApiResponseEnvelope;
}

/**
 * Read a `@_<key>` attribute from an opaque node produced by fast-xml-parser.
 * Returns `undefined` when the node is not an object or the attribute is absent.
 */
export function xmlAttr<T extends string>(
  node: unknown,
  key: T,
): string | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const attrKey = `@_${key}` as const;
  const value = (node as Record<string, unknown>)[attrKey];
  if (typeof value !== 'string') return undefined;
  return value;
}

/**
 * Coerce a Namecheap attribute string to a boolean.
 * `'true'` (case-insensitive) → `true`; anything else → `false`.
 */
export function xmlBool(value: string | undefined): boolean {
  if (value === undefined) return false;
  return value.toLowerCase() === 'true';
}

/**
 * Coerce a Namecheap attribute string to an integer.
 * Returns `undefined` when the string is absent or not a valid integer.
 */
export function xmlInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Return a string value unchanged, or `undefined` when absent.
 * Convenience wrapper to make intent explicit when reading string attributes.
 */
export function xmlString(value: string | undefined): string | undefined {
  return value;
}

/**
 * Coerce a Namecheap attribute string to a float.
 * Returns `undefined` when the string is absent or not a valid number.
 */
export function xmlFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseFloat(value);
  return Number.isNaN(n) ? undefined : n;
}
