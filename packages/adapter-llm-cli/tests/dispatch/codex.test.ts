import { describe, expect, it } from 'vitest';
import { codexDispatch } from '../../src/dispatch/codex.js';

describe('codexDispatch', () => {
  it('lists at least one OpenAI model', () => {
    const models = codexDispatch.models();
    expect(models.length).toBeGreaterThanOrEqual(1);
    const first = models[0];
    expect(first).toBeDefined();
    expect(first!.id).toMatch(/^gpt/);
  });

  it('builds argv with exec subcommand + default model + prompt', () => {
    const argv = codexDispatch.buildArgv('hello', {});
    expect(argv[0]).toBe('exec');
    expect(argv).toContain('--model');
    expect(argv[argv.indexOf('--model') + 1]).toBe('gpt-5');
    expect(argv[argv.length - 1]).toBe('hello');
  });

  it('forwards model opt', () => {
    const argv = codexDispatch.buildArgv('hi', { model: 'gpt-4.1' });
    expect(argv[argv.indexOf('--model') + 1]).toBe('gpt-4.1');
  });

  it('prepends system prompt with delimiter', () => {
    const argv = codexDispatch.buildArgv('user content', { system: 'sys content' });
    const last = argv[argv.length - 1];
    expect(last).toContain('sys content');
    expect(last).toContain('user content');
    expect(last).toContain('=== SYSTEM ===');
  });

  it('parseStreamChunk wraps each line as text', () => {
    expect(codexDispatch.parseStreamChunk('hello')).toEqual({
      type: 'text',
      text: 'hello',
    });
  });

  it('parseStreamChunk returns null for empty line', () => {
    expect(codexDispatch.parseStreamChunk('')).toBeNull();
  });

  it('parseFinalUsage returns undefined (codex has no usage protocol)', () => {
    expect(codexDispatch.parseFinalUsage('any output\n', '')).toBeUndefined();
  });

  it('authErrorPattern matches expected stderr patterns', () => {
    expect(codexDispatch.authErrorPattern.test('please run codex login')).toBe(true);
    expect(codexDispatch.authErrorPattern.test('Unauthorized')).toBe(true);
    expect(codexDispatch.authErrorPattern.test('missing OPENAI_API_KEY')).toBe(true);
    expect(codexDispatch.authErrorPattern.test('something else')).toBe(false);
  });
});
