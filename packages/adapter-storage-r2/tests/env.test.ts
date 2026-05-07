import { describe, it, expect } from 'vitest';
import { readEnvConfig } from '../src/env.js';

const fullEnv = {
  OA_R2_ACCOUNT_ID: '0'.repeat(32),
  OA_R2_ACCESS_KEY_ID: 'AKIA',
  OA_R2_SECRET_ACCESS_KEY: 'secret',
  OA_R2_BUCKET: 'my-bucket',
  OA_R2_PUBLIC_BASE_URL: 'https://files.example.com',
  OA_R2_PRESIGN_TTL: '600',
  OA_R2_ENDPOINT: 'http://localhost:9000',
};

describe('readEnvConfig', () => {
  it('returns config when all required vars set', () => {
    const result = readEnvConfig(fullEnv);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.config.bucket).toBe('my-bucket');
      expect(result.config.presignTtlSeconds).toBe(600);
      expect(result.config.endpoint).toBe('http://localhost:9000');
    }
  });

  it('returns config without optional vars', () => {
    const env = {
      OA_R2_ACCOUNT_ID: fullEnv.OA_R2_ACCOUNT_ID,
      OA_R2_ACCESS_KEY_ID: fullEnv.OA_R2_ACCESS_KEY_ID,
      OA_R2_SECRET_ACCESS_KEY: fullEnv.OA_R2_SECRET_ACCESS_KEY,
      OA_R2_BUCKET: fullEnv.OA_R2_BUCKET,
    };
    const result = readEnvConfig(env);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.config.publicBaseUrl).toBeUndefined();
      expect(result.config.presignTtlSeconds).toBe(3600);
    }
  });

  it('returns error listing missing vars', () => {
    const result = readEnvConfig({ OA_R2_BUCKET: 'b' });
    expect(result.kind).toBe('missing');
    if (result.kind === 'missing') {
      expect(result.missing).toEqual([
        'OA_R2_ACCOUNT_ID',
        'OA_R2_ACCESS_KEY_ID',
        'OA_R2_SECRET_ACCESS_KEY',
      ]);
    }
  });

  it('returns error when validation fails (bad accountId)', () => {
    const result = readEnvConfig({ ...fullEnv, OA_R2_ACCOUNT_ID: 'not-hex' });
    expect(result.kind).toBe('invalid');
  });
});
