/**
 * Attachment content encoders. Resend expects attachment content as a
 * base64-encoded string. We accept ArrayBuffer | string per the core
 * `EmailMessage` interface and base64-encode both.
 *
 * - ArrayBuffer → encoded byte-for-byte
 * - string → encoded as UTF-8 bytes (treated as raw text content; if a caller
 *   already has a base64 string, they decode to ArrayBuffer first)
 *
 * @module
 */

export function arrayBufferToBase64(ab: ArrayBuffer): string {
  return Buffer.from(ab).toString('base64');
}

export function stringToBase64(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64');
}

/** Convenience for shaping request bodies. */
export function attachmentContentToBase64(content: ArrayBuffer | string): string {
  if (typeof content === 'string') {
    return stringToBase64(content);
  }
  return arrayBufferToBase64(content);
}
