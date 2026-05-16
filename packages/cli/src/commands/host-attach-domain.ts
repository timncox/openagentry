/**
 * `agentry host:attach-domain <slug> <domain>` — attach a custom domain to
 * a project via the registered HostAdapter. Prints status plus any pending
 * DNS records the user must configure.
 *
 * @module
 */

import {
  AgentryError,
  useAdapter,
  type HostAdapter,
  type HostProject,
  type IsoTimestamp,
} from '@openagentry/core';
import { defineCommand } from '../command.js';

export const hostAttachDomainCommand = defineCommand({
  name: 'host:attach-domain',
  summary: 'Attach a custom domain to a project via the registered host adapter.',
  async run(args, output) {
    const [slug, domain] = args.positional;
    if (slug === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <project-slug> argument.',
        phase: 'init',
        suggestedFix: `agentry host:attach-domain <slug> <domain>`,
      });
    }
    if (domain === undefined) {
      throw new AgentryError({
        code: 'E_MISSING_ARG',
        message: 'Missing required <domain> argument.',
        phase: 'init',
        suggestedFix: `agentry host:attach-domain ${slug} example.com`,
      });
    }
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

    const result = await adapter.attachDomain(project, domain);

    output.text(`Domain ${result.domain} on ${slug}: ${result.status}`);
    if (result.pendingRecords && result.pendingRecords.length > 0) {
      output.text('Pending DNS records:');
      for (const r of result.pendingRecords) {
        const prio = r.priority !== undefined ? ` (prio ${r.priority})` : '';
        output.text(`  ${r.type} ${r.name} -> ${r.value}${prio}`);
      }
    }
    output.json({ slug, ...result });
    return 0;
  },
});
