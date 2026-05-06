/**
 * @openagentry/adapter-test-suite — conformance runner for OpenAgentry adapters.
 *
 * @module
 */

// Side-effect imports register the built-in functional suites with the runner.
import './suites/host.js';
import './suites/storage.js';
import './suites/db.js';
import './suites/auth.js';
import './suites/llm.js';
import './suites/wiki.js';

export { runSuite, registerFunctionalSuite } from './runner.js';
export { formatText, formatJson } from './reporter.js';
export { loadTarget } from './loader.js';
export type {
  CheckResult,
  CheckStatus,
  SuiteResult,
  RunOpts,
  LoadedTarget,
  SuiteCtx,
} from './types.js';
