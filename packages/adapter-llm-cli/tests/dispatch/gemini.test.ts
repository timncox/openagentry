import { describe, expect, it } from 'vitest';
import { geminiDispatch } from '../../src/dispatch/gemini.js';

describe('geminiDispatch', () => {
  it('lists at least one Gemini model', () => {
    const models = geminiDispatch.models();
    expect(models.length).toBeGreaterThanOrEqual(1);
    const first = models[0];
    expect(first).toBeDefined();
    expect(first!.id).toMatch(/^gemini/);
    expect(first!.contextWindow).toBeGreaterThan(0);
  });

  it('builds argv with model + prompt', () => {
    const argv = geminiDispatch.buildArgv('hello', {});
    expect(argv).toContain('--model');
    expect(argv[argv.indexOf('--model') + 1]).toBe('gemini-2.5-pro');
    expect(argv).toContain('-p');
    expect(argv[argv.indexOf('-p') + 1]).toBe('hello');
  });

  it('forwards system opt as --system-instruction', () => {
    const argv = geminiDispatch.buildArgv('hi', { system: 'be terse' });
    expect(argv).toContain('--system-instruction');
    expect(argv[argv.indexOf('--system-instruction') + 1]).toBe('be terse');
  });

  it('omits system flag when system is empty', () => {
    const argv = geminiDispatch.buildArgv('hi', { system: '' });
    expect(argv).not.toContain('--system-instruction');
  });

  it('parseStreamChunk wraps each line as text', () => {
    expect(geminiDispatch.parseStreamChunk('hi')).toEqual({ type: 'text', text: 'hi' });
  });

  it('parseFinalUsage returns undefined', () => {
    expect(geminiDispatch.parseFinalUsage('output\n', '')).toBeUndefined();
  });

  it('authErrorPattern matches expected stderr patterns', () => {
    expect(geminiDispatch.authErrorPattern.test('please run gemini auth')).toBe(true);
    expect(geminiDispatch.authErrorPattern.test('missing GOOGLE_API_KEY')).toBe(true);
    expect(geminiDispatch.authErrorPattern.test('something else')).toBe(false);
  });
});
