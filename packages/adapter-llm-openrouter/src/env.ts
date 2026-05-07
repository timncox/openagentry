/**
 * Read OpenRouter LLM adapter config from environment variables.
 *
 * @module
 */

import { parseOpenrouterLlmConfig, type OpenrouterLlmConfig } from './config.js';

const REQUIRED = ['OA_OPENROUTER_API_KEY'] as const;

export type EnvReadResult =
  | { kind: 'ok'; config: OpenrouterLlmConfig }
  | { kind: 'missing'; missing: string[] }
  | { kind: 'invalid'; error: unknown };

export function readEnvConfig(env: Record<string, string | undefined>): EnvReadResult {
  const missing = REQUIRED.filter((k) => env[k] === undefined || env[k] === '');
  if (missing.length > 0) {
    return { kind: 'missing', missing };
  }
  try {
    const input: Record<string, unknown> = {
      apiKey: env.OA_OPENROUTER_API_KEY!,
    };
    if (env.OA_OPENROUTER_DEFAULT_MODEL !== undefined && env.OA_OPENROUTER_DEFAULT_MODEL !== '') {
      input.defaultModel = env.OA_OPENROUTER_DEFAULT_MODEL;
    }
    if (env.OA_OPENROUTER_BASE_URL !== undefined && env.OA_OPENROUTER_BASE_URL !== '') {
      input.baseUrl = env.OA_OPENROUTER_BASE_URL;
    }
    if (env.OA_OPENROUTER_APP_URL !== undefined && env.OA_OPENROUTER_APP_URL !== '') {
      input.appUrl = env.OA_OPENROUTER_APP_URL;
    }
    if (env.OA_OPENROUTER_APP_TITLE !== undefined && env.OA_OPENROUTER_APP_TITLE !== '') {
      input.appTitle = env.OA_OPENROUTER_APP_TITLE;
    }
    const config = parseOpenrouterLlmConfig(input);
    return { kind: 'ok', config };
  } catch (err) {
    return { kind: 'invalid', error: err };
  }
}
