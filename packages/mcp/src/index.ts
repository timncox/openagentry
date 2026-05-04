// `agentry-mcp` server entry. Real wiring lands in Tasks 3–6.
// This stub exists so the package builds cleanly from Task 2 onward.

export const SERVER_NAME = 'agentry-mcp' as const;

async function main(): Promise<number> {
  process.stderr.write(`${SERVER_NAME}: stub\n`);
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${SERVER_NAME}: ${String(err)}\n`);
      process.exit(2);
    },
  );
}
