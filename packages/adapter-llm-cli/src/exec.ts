/** SpawnFn type. Filled out with default implementation in Task 8. */
import type { ChildProcess } from 'node:child_process';

export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: { env?: Record<string, string> },
) => ChildProcess;
