// `agentry` CLI entry point. Real dispatch wired up in Task 5.
// This stub exists so the package builds cleanly from Task 1 onward.

export const CLI_NAME = 'agentry' as const;

async function main(): Promise<number> {
  process.stdout.write(`${CLI_NAME}: stub\n`);
  return 0;
}

// Only run when executed directly (not when imported by tests).
// In CJS, require.main === module when this file was the entry point.
if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${CLI_NAME}: ${String(err)}\n`);
      process.exit(2);
    },
  );
}
