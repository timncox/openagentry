/**
 * Read AI Gateway LLM adapter config from environment variables.
 *
 * @module
 */

import { parseAigatewayLlmConfig, type AigatewayLlmConfig } from './config.js';

const REQUIRED = ['OA_AIGATEWAY_API_KEY'] as const;

export type EnvReadResult =
  | { kind: 'ok'; config: AigatewayLlmConfig }
  | { kind: 'missing'; missing: string[] }
  | { kind: 'invalid'; error: unknown };

export function readEnvConfig(env: Record<string, string | undefined>): EnvReadResult {
  const missing = REQUIRED.filter((k) => env[k] === undefined || env[k] === '');
  if (missing.length > 0) {
    return { kind: 'missing', missing };
  }
  try {
    const input: Record<string, unknown> = {
      apiKey: env.OA_AIGATEWAY_API_KEY!,
    };
    if (env.OA_AIGATEWAY_DEFAULT_MODEL !== undefined && env.OA_AIGATEWAY_DEFAULT_MODEL !== '') {
      input.defaultModel = env.OA_AIGATEWAY_DEFAULT_MODEL;
    }
    if (env.OA_AIGATEWAY_BASE_URL !== undefined && env.OA_AIGATEWAY_BASE_URL !== '') {
      input.baseUrl = env.OA_AIGATEWAY_BASE_URL;
    }
    const config = parseAigatewayLlmConfig(input);
    return { kind: 'ok', config };
  } catch (err) {
    return { kind: 'invalid', error: err };
  }
}
