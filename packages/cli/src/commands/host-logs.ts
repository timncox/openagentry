/**
 * `agentry host:logs <slug> [--tail] [--since ISO] [--deployment <id>]` —
 * stream logs from the registered HostAdapter to stdout.
 *
 * For one-shot (non-tail) usage, iteration ends when the adapter's iterator
 * completes. Tail mode is provider-dependent and runs until the consumer
 * interrupts (Ctrl-C).
 *
 * @module
 */

import {
  AgentryError,
  useAdapter,
  type HostAdapter,
  type HostProject,
  type IsoTimestamp,
  type LogOpts,
} from '@openagentry/core';
import { defineCommand } from '../command.js';

export const hostLogsCommand = defineCommand({
  name: 'host:logs',
  summary: 'Stream logs from a project via the registered host adapter.',
  async run(args, output) {
    const slug = args.positional[0];
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:logs <slug> [--tail]`,
      });
    }
    const opts: LogOpts = {};
    if (args.flags['tail'] === true || args.flags['tail'] === 'true') opts.tail = true;
    if (typeof args.flags['since'] === 'string') opts.since = args.flags['since'];
    if (typeof args.flags['deployment'] === 'string') opts.deploymentId = args.flags['deployment'];

    const adapter = useAdapter<HostAdapter>('host');

    // Minimal HostProject reconstructed from the slug. Adapters that need
    // richer state can resolve from slug internally. v2 will persist
    // project metadata (see plan "Known v1 limitations").
    const project: HostProject = {
      id: `proj_${slug}`,
      slug,
      name: slug,
      hostId: `host_${slug}`,
      createdAt: new Date(0).toISOString() as IsoTimestamp,
    };

    const lines: Array<{ timestamp: string; level: string; message: string }> = [];
    for await (const line of adapter.logs(project, opts)) {
      output.text(`[${line.timestamp}] ${line.level} ${line.message}`);
      lines.push({ timestamp: line.timestamp, level: line.level, message: line.message });
    }
    output.json({ slug, count: lines.length, lines });
    return 0;
  },
});
