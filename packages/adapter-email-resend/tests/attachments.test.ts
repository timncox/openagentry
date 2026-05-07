import { describe, it, expect } from 'vitest';
import {
  arrayBufferToBase64,
  stringToBase64,
  attachmentContentToBase64,
} from '../src/attachments.js';

describe('arrayBufferToBase64', () => {
  it('encodes a UTF-8 ArrayBuffer correctly', () => {
    const ab = new TextEncoder().encode('hello').buffer;
    expect(arrayBufferToBase64(ab)).toBe(Buffer.from('hello').toString('base64'));
  });

  it('round-trips back to the original bytes', () => {
    const original = 'The quick brown fox 🦊';
    const ab = new TextEncoder().encode(original).buffer;
    const b64 = arrayBufferToBase64(ab);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    expect(decoded).toBe(original);
  });

  it('handles a zero-length ArrayBuffer', () => {
    const ab = new ArrayBuffer(0);
    expect(arrayBufferToBase64(ab)).toBe('');
  });

  it('handles binary data (non-UTF-8 bytes)', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
    const b64 = arrayBufferToBase64(bytes.buffer);
    const decoded = Buffer.from(b64, 'base64');
    expect(Array.from(decoded)).toEqual([0x00, 0xff, 0x80, 0x7f]);
  });
});

describe('stringToBase64', () => {
  it('encodes a string as UTF-8 then base64', () => {
    expect(stringToBase64('hello')).toBe(Buffer.from('hello').toString('base64'));
  });

  it('round-trips a multi-byte UTF-8 string', () => {
    const original = 'résumé 🎉';
    const b64 = stringToBase64(original);
    expect(Buffer.from(b64, 'base64').toString('utf-8')).toBe(original);
  });

  it('handles empty string', () => {
    expect(stringToBase64('')).toBe('');
  });
});

describe('attachmentContentToBase64', () => {
  it('routes ArrayBuffer to arrayBufferToBase64', () => {
    const ab = new TextEncoder().encode('a').buffer;
    expect(attachmentContentToBase64(ab)).toBe(arrayBufferToBase64(ab));
  });

  it('routes string to stringToBase64', () => {
    expect(attachmentContentToBase64('a')).toBe(stringToBase64('a'));
  });
});
