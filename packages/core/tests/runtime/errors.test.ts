import { describe, expect, it } from 'vitest';
import { AgentryError, isAgentryError } from '../../src/runtime/errors.js';

describe('AgentryError', () => {
  it('captures code, message, phase, suggestedFix, docs', () => {
    const err = new AgentryError({
      code: 'E_HOST_DEPLOY_QUOTA',
      message: 'Cloudflare account exceeded daily build minutes',
      phase: 'deploy',
      suggestedFix: 'agentry quota host-cloudflare --upgrade',
      docs: 'https://docs.openagentry.dev/errors/E_HOST_DEPLOY_QUOTA',
      adapter: 'host-cloudflare',
      context: { account: 'tim' },
    });
    expect(err.code).toBe('E_HOST_DEPLOY_QUOTA');
    expect(err.message).toBe('Cloudflare account exceeded daily build minutes');
    expect(err.phase).toBe('deploy');
    expect(err.suggestedFix).toBe('agentry quota host-cloudflare --upgrade');
    expect(err.docs).toBe('https://docs.openagentry.dev/errors/E_HOST_DEPLOY_QUOTA');
    expect(err.adapter).toBe('host-cloudflare');
    expect(err.context).toEqual({ account: 'tim' });
  });

  it('is an instance of Error', () => {
    const err = new AgentryError({ code: 'E_X', message: 'm', phase: 'init' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AgentryError);
  });

  it('serializes to a structured JSON shape', () => {
    const err = new AgentryError({
      code: 'E_HOST_DEPLOY_QUOTA',
      message: 'msg',
      phase: 'deploy',
      suggestedFix: 'fix-cmd',
      docs: 'url',
      adapter: 'host-cloudflare',
      context: { k: 'v' },
    });
    expect(err.toJSON()).toEqual({
      code: 'E_HOST_DEPLOY_QUOTA',
      message: 'msg',
      phase: 'deploy',
      suggestedFix: 'fix-cmd',
      docs: 'url',
      adapter: 'host-cloudflare',
      context: { k: 'v' },
    });
  });

  it('isAgentryError narrows type correctly', () => {
    const err: unknown = new AgentryError({ code: 'E_X', message: 'm', phase: 'init' });
    expect(isAgentryError(err)).toBe(true);
    expect(isAgentryError(new Error('plain'))).toBe(false);
    expect(isAgentryError('string')).toBe(false);
    expect(isAgentryError(null)).toBe(false);
  });
});
