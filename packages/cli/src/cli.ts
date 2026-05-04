/**
 * `agentry` CLI entry point.
 *
 * The shebang is added by tsup's `banner.js` config so this file remains
 * a valid TypeScript source.
 *
 * @module
 */

import { dispatch } from './dispatcher.js';

export const CLI_NAME = 'agentry' as const;

async function main(): Promise<number> {
  return dispatch(process.argv.slice(2));
}

// Only run when executed directly (not when imported by tests).
// In CJS, require.main === module when this file was the entry point.
if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${CLI_NAME}: fatal: ${String(err)}\n`);
      process.exit(2);
    },
  );
}
