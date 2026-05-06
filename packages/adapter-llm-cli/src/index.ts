/**
 * @openagentry/adapter-llm-cli — public entry.
 *
 * Default export: an adapter constructed from process.env.OA_LLM_CLI
 * (default 'claude') and process.env.OA_LLM_CLI_BIN (optional binPath
 * override). Real users override by calling `createLlmCliAdapter(input)`
 * directly.
 *
 * @module
 */

import { createLlmCliAdapter } from './adapter.js';

export {
  createLlmCliAdapter,
  type LlmCliAdapter,
} from './adapter.js';
export {
  llmCliConfigSchema,
  parseLlmCliConfig,
  type LlmCliConfig,
} from './config.js';
export {
  ADAPTER_ID,
  LLM_CLI_ERROR_CODES,
  llmCliError,
  llmCliErrorFromCause,
  type LlmCliErrorCode,
} from './errors.js';
export { defaultSpawn, resolveBinary, type SpawnFn } from './exec.js';
export { init, refresh, healthcheck } from './lifecycle.js';

function resolveDefaultCli(): 'claude' | 'codex' | 'gemini' {
  const env = process.env['OA_LLM_CLI'];
  if (env === 'codex' || env === 'gemini') return env;
  return 'claude';
}

const defaultCli = resolveDefaultCli();
const defaultBinPath = process.env['OA_LLM_CLI_BIN'];

const defaultAdapter = createLlmCliAdapter(
  defaultBinPath !== undefined && defaultBinPath.length > 0
    ? { cli: defaultCli, binPath: defaultBinPath }
    : { cli: defaultCli },
);

export default defaultAdapter;
