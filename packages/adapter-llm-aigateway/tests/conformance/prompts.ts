/**
 * Prompts mirrored from @openagentry/adapter-test-suite's llm suite so the
 * SDK mock can recognize them without a circular dep on the suite source.
 *
 * Keep these in sync with packages/adapter-test-suite/src/suites/llm.ts.
 *
 * @module
 */

export const SYSTEM_MARKER = 'TEST_SYS_MARKER';
export const ECHO_PROMPT = 'Echo system.';
export const HELLO_PROMPT = 'Say hi.';
export const COUNT_PROMPT = 'Count to three.';
export const ERROR_PROMPT = 'error:nonzero';
