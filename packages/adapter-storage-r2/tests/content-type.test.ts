import { describe, it, expect } from 'vitest';
import { sniffFromKey, defaultCacheControl } from '../src/content-type.js';

describe('sniffFromKey', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['Photo.JPG', 'image/jpeg'],
    ['icon.png', 'image/png'],
    ['data.json', 'application/json'],
    ['page.html', 'text/html'],
    ['notes.md', 'text/markdown'],
    ['doc.pdf', 'application/pdf'],
    ['readme.txt', 'text/plain'],
    ['logo.svg', 'image/svg+xml'],
    ['hero.webp', 'image/webp'],
    ['vid.mp4', 'video/mp4'],
    ['song.mp3', 'audio/mpeg'],
    ['styles.css', 'text/css'],
    ['app.js', 'text/javascript'],
    ['data.csv', 'text/csv'],
    ['archive.zip', 'application/zip'],
  ])('sniffs %s -> %s', (key, expected) => {
    expect(sniffFromKey(key)).toBe(expected);
  });

  it('returns undefined for unknown extension', () => {
    expect(sniffFromKey('file.xyz')).toBeUndefined();
  });

  it('returns undefined for no extension', () => {
    expect(sniffFromKey('Makefile')).toBeUndefined();
  });

  it('returns undefined for dotfile', () => {
    expect(sniffFromKey('.gitignore')).toBeUndefined();
  });

  it('considers only the final extension', () => {
    expect(sniffFromKey('archive.tar.gz')).toBe(undefined); // .gz isn't in our map
    expect(sniffFromKey('image.JPEG.png')).toBe('image/png');
  });
});

describe('defaultCacheControl', () => {
  it('returns immutable for public', () => {
    expect(defaultCacheControl(true)).toBe('public, max-age=31536000, immutable');
  });

  it('returns no-cache for private', () => {
    expect(defaultCacheControl(false)).toBe('private, no-cache');
  });
});
