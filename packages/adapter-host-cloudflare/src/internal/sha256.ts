/**
 * Async SHA-256 hex encoder. Uses Node's webcrypto (available globally as
 * `crypto.subtle` in Node 20+).
 *
 * @module
 */

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    const b = view[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}
