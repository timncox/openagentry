/**
 * Content-Type sniffing from key extensions and Cache-Control defaults.
 *
 * @module
 */

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  json: 'application/json',
  html: 'text/html',
  md: 'text/markdown',
  pdf: 'application/pdf',
  txt: 'text/plain',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  css: 'text/css',
  js: 'text/javascript',
  csv: 'text/csv',
  zip: 'application/zip',
};

export function sniffFromKey(key: string): string | undefined {
  const lastDot = key.lastIndexOf('.');
  // No extension at all, or dotfile (starts with `.` and no other dots in the basename).
  if (lastDot <= 0) return undefined;
  const lastSep = Math.max(key.lastIndexOf('/'), key.lastIndexOf('\\'));
  // If the only dot is in a leading dotfile (e.g., `.gitignore`), no extension to sniff.
  if (lastDot < lastSep + 2) return undefined;
  const ext = key.slice(lastDot + 1).toLowerCase();
  return MIME_BY_EXT[ext];
}

export function defaultCacheControl(isPublic: boolean): string {
  return isPublic
    ? 'public, max-age=31536000, immutable'
    : 'private, no-cache';
}
