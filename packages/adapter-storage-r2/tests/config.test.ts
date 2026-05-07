import { describe, it, expect } from 'vitest';
import { parseR2StorageConfig } from '../src/config.js';

const validInput = {
  accountId: '0123456789abcdef0123456789abcdef',
  accessKeyId: 'AKIA_FAKE',
  secretAccessKey: 'fake-secret',
  bucket: 'my-bucket',
};

describe('parseR2StorageConfig', () => {
  it('accepts a minimal valid input', () => {
    const cfg = parseR2StorageConfig(validInput);
    expect(cfg.accountId).toBe(validInput.accountId);
    expect(cfg.bucket).toBe(validInput.bucket);
    expect(cfg.region).toBe('auto');
    expect(cfg.endpoint).toBe('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
    expect(cfg.presignTtlSeconds).toBe(3600);
  });

  it('rejects non-hex accountId', () => {
    expect(() => parseR2StorageConfig({ ...validInput, accountId: 'not-hex' })).toThrow(/accountId/);
  });

  it('rejects 31-char accountId', () => {
    expect(() => parseR2StorageConfig({ ...validInput, accountId: '0'.repeat(31) })).toThrow();
  });

  it('rejects uppercase bucket', () => {
    expect(() => parseR2StorageConfig({ ...validInput, bucket: 'My-Bucket' })).toThrow();
  });

  it('rejects underscore bucket', () => {
    expect(() => parseR2StorageConfig({ ...validInput, bucket: 'my_bucket' })).toThrow();
  });

  it('accepts a custom endpoint override (for MinIO)', () => {
    const cfg = parseR2StorageConfig({ ...validInput, endpoint: 'http://localhost:9000' });
    expect(cfg.endpoint).toBe('http://localhost:9000');
  });

  it('accepts presignTtlSeconds at boundaries', () => {
    expect(parseR2StorageConfig({ ...validInput, presignTtlSeconds: 60 }).presignTtlSeconds).toBe(60);
    expect(parseR2StorageConfig({ ...validInput, presignTtlSeconds: 604800 }).presignTtlSeconds).toBe(604800);
  });

  it('rejects presignTtlSeconds below 60', () => {
    expect(() => parseR2StorageConfig({ ...validInput, presignTtlSeconds: 59 })).toThrow();
  });

  it('rejects presignTtlSeconds above 604800', () => {
    expect(() => parseR2StorageConfig({ ...validInput, presignTtlSeconds: 604801 })).toThrow();
  });

  it('accepts publicBaseUrl as a valid URL', () => {
    const cfg = parseR2StorageConfig({ ...validInput, publicBaseUrl: 'https://files.example.com' });
    expect(cfg.publicBaseUrl).toBe('https://files.example.com');
  });

  it('rejects invalid publicBaseUrl', () => {
    expect(() => parseR2StorageConfig({ ...validInput, publicBaseUrl: 'not-a-url' })).toThrow();
  });

  it('rejects unknown keys (.strict)', () => {
    expect(() => parseR2StorageConfig({ ...validInput, foo: 'bar' } as any)).toThrow();
  });

  it('rejects whitespace-only accessKeyId', () => {
    expect(() => parseR2StorageConfig({ ...validInput, accessKeyId: '   ' })).toThrow();
  });

  it('rejects empty-string accessKeyId', () => {
    expect(() => parseR2StorageConfig({ ...validInput, accessKeyId: '' })).toThrow();
  });

  it('rejects empty secretAccessKey', () => {
    expect(() => parseR2StorageConfig({ ...validInput, secretAccessKey: '' })).toThrow();
  });

  it('rejects whitespace-only secretAccessKey', () => {
    expect(() => parseR2StorageConfig({ ...validInput, secretAccessKey: '   ' })).toThrow();
  });

  it('rejects bucket with consecutive hyphens', () => {
    expect(() => parseR2StorageConfig({ ...validInput, bucket: 'my--bucket' })).toThrow();
  });

  it('accepts bucket with single internal hyphen', () => {
    const cfg = parseR2StorageConfig({ ...validInput, bucket: 'my-bucket' });
    expect(cfg.bucket).toBe('my-bucket');
  });
});
