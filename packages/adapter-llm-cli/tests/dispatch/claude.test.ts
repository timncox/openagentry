import { describe, expect, it } from 'vitest';
import { claudeDispatch } from '../../src/dispatch/claude.js';

describe('claudeDispatch', () => {
  it('lists three Claude models', () => {
    const models = claudeDispatch.models();
    expect(models.length).toBeGreaterThanOrEqual(3);
    const first = models[0];
    expect(first).toBeDefined();
    expect(first!.id).toMatch(/^claude-/);
    expect(first!.contextWindow).toBeGreaterThan(0);
  });

  it('builds argv with default model + stream-json + prompt', () => {
    const argv = claudeDispatch.buildArgv('hello', {});
    expect(argv).toContain('--output-format');
    expect(argv).toContain('stream-json');
    expect(argv).toContain('--model');
    const modelIdx = argv.indexOf('--model');
    expect(argv[modelIdx + 1]).toBe('claude-sonnet-4-6');
    expect(argv).toContain('-p');
    expect(argv[argv.indexOf('-p') + 1]).toBe('hello');
  });

  it('forwards model opt', () => {
    const argv = claudeDispatch.buildArgv('hi', { model: 'claude-opus-4-7' });
    const modelIdx = argv.indexOf('--model');
    expect(argv[modelIdx + 1]).toBe('claude-opus-4-7');
  });

  it('forwards system opt as --append-system-prompt', () => {
    const argv = claudeDispatch.buildArgv('hi', { system: 'be terse' });
    expect(argv).toContain('--append-system-prompt');
    const sysIdx = argv.indexOf('--append-system-prompt');
    expect(argv[sysIdx + 1]).toBe('be terse');
  });

  it('omits system flag when system opt is empty', () => {
    const argv = claudeDispatch.buildArgv('hi', { system: '' });
    expect(argv).not.toContain('--append-system-prompt');
  });

  it('parseStreamChunk returns text chunk for content_block_delta', () => {
    const line = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'hello' },
    });
    expect(claudeDispatch.parseStreamChunk(line)).toEqual({
      type: 'text',
      text: 'hello',
    });
  });

  it('parseStreamChunk returns done chunk with usage for result', () => {
    const line = JSON.stringify({
      type: 'result',
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(claudeDispatch.parseStreamChunk(line)).toEqual({
      type: 'done',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it('parseStreamChunk returns null for unknown lines', () => {
    expect(claudeDispatch.parseStreamChunk('garbage')).toBeNull();
    expect(claudeDispatch.parseStreamChunk('')).toBeNull();
    expect(
      claudeDispatch.parseStreamChunk(JSON.stringify({ type: 'noise' })),
    ).toBeNull();
  });

  it('parseFinalUsage walks back to find result block', () => {
    const stdout = [
      JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } }),
      JSON.stringify({ type: 'result', usage: { input_tokens: 7, output_tokens: 3 } }),
    ].join('\n');
    expect(claudeDispatch.parseFinalUsage(stdout, '')).toEqual({
      inputTokens: 7,
      outputTokens: 3,
    });
  });

  it('parseFinalUsage returns undefined when no result block', () => {
    expect(claudeDispatch.parseFinalUsage('garbage\n', '')).toBeUndefined();
  });

  it('authErrorPattern matches known auth-error stderr patterns', () => {
    expect(claudeDispatch.authErrorPattern.test('Please run claude login')).toBe(true);
    expect(claudeDispatch.authErrorPattern.test('Error: not authenticated')).toBe(true);
    expect(claudeDispatch.authErrorPattern.test('Invalid API key')).toBe(true);
    expect(claudeDispatch.authErrorPattern.test('some other error')).toBe(false);
  });
});
