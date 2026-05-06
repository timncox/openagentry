/** Stable error codes for adapter-llm-cli. Filled out in Task 7. */
export const LLM_CLI_ERROR_CODES = {
  NOT_FOUND: 'E_LLM_CLI_NOT_FOUND',
  AUTH: 'E_LLM_CLI_AUTH',
  TIMEOUT: 'E_LLM_CLI_TIMEOUT',
  NONZERO: 'E_LLM_CLI_NONZERO',
  PARSE: 'E_LLM_CLI_PARSE',
  SCHEMA: 'E_LLM_CLI_SCHEMA',
} as const;

export const ADAPTER_ID = 'llm-cli';
