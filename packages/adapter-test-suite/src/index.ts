/**
 * @openagentry/adapter-test-suite — conformance runner for OpenAgentry adapters.
 *
 * @module
 */

// Side-effect imports register the built-in functional suites with the runner.
import './suites/host.js';
import './suites/storage.js';

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
