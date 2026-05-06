import { describe, expect, it } from 'vitest';
import { AgentryError } from '@openagentry/core';
import {
  ADAPTER_ID,
  WIKI_FS_ERROR_CODES,
  wikiFsError,
  fsErrorToWikiError,
} from '../src/errors.js';

describe('errors', () => {
  it('exports ADAPTER_ID = "wiki-fs"', () => {
    expect(ADAPTER_ID).toBe('wiki-fs');
  });

  it('exposes 6 stable error codes', () => {
    expect(Object.keys(WIKI_FS_ERROR_CODES).sort()).toEqual([
      'NOT_FOUND',
      'NO_PROJECT_VAULT',
      'OUT_OF_VAULT',
      'PARSE',
      'PERMISSION',
      'SCHEMA',
    ]);
    expect(WIKI_FS_ERROR_CODES.NOT_FOUND).toBe('E_WIKI_FS_NOT_FOUND');
  });

  it('wikiFsError builds an AgentryError with adapter set', () => {
    const e = wikiFsError({
      code: 'E_WIKI_FS_NOT_FOUND',
      message: 'gone',
      phase: 'read',
    });
    expect(e).toBeInstanceOf(AgentryError);
    expect(e.code).toBe('E_WIKI_FS_NOT_FOUND');
    expect(e.adapter).toBe('wiki-fs');
    expect(e.phase).toBe('read');
  });

  it('fsErrorToWikiError maps ENOENT to NOT_FOUND', () => {
    const fsErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const e = fsErrorToWikiError(fsErr, 'read', '/missing');
    expect(e.code).toBe('E_WIKI_FS_NOT_FOUND');
    expect(e.cause).toBe(fsErr);
  });

  it('fsErrorToWikiError maps EACCES to PERMISSION', () => {
    const fsErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    const e = fsErrorToWikiError(fsErr, 'write', '/locked');
    expect(e.code).toBe('E_WIKI_FS_PERMISSION');
  });

  it('fsErrorToWikiError falls back to PARSE for unknown codes', () => {
    const fsErr = Object.assign(new Error('weird'), { code: 'EWEIRD' });
    const e = fsErrorToWikiError(fsErr, 'list', '/tmp');
    expect(e.code).toBe('E_WIKI_FS_PARSE');
  });

  it('fsErrorToWikiError passes through an existing AgentryError unchanged', () => {
    const original = wikiFsError({
      code: WIKI_FS_ERROR_CODES.OUT_OF_VAULT,
      message: 'traversal blocked',
      phase: 'read',
    });
    const result = fsErrorToWikiError(original, 'write', '/any');
    expect(result).toBe(original);
    expect(result.code).toBe(WIKI_FS_ERROR_CODES.OUT_OF_VAULT);
  });
});
