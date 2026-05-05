/**
 * attachDomain / detachDomain. attachDomain is idempotent.
 *
 * @module
 */

import {
  isAgentryError,
  type DomainAttachment,
  type HostProject,
} from '@openagentry/core';
import type { CloudflareApi } from '../client.js';
import type { CfPagesDomain } from '../types.js';

const DUP_DOMAIN_CODE = 8000022;

function attachmentFromCf(cf: CfPagesDomain): DomainAttachment {
  const status: DomainAttachment['status'] =
    cf.status === 'active' ? 'active' : cf.status === 'error' ? 'failed' : 'pending';
  return {
    domain: cf.name,
    status,
  };
}

export async function attachDomain(
  api: CloudflareApi,
  project: HostProject,
  domain: string,
): Promise<DomainAttachment> {
  try {
    const cf = await api.request<CfPagesDomain>(
      'POST',
      `/accounts/{account_id}/pages/projects/${project.slug}/domains`,
      { phase: 'attachDomain', json: { name: domain } },
    );
    return attachmentFromCf(cf);
  } catch (err) {
    if (isAgentryError(err) && err.context?.['cf_code'] === DUP_DOMAIN_CODE) {
      const existing = await api.request<CfPagesDomain>(
        'GET',
        `/accounts/{account_id}/pages/projects/${project.slug}/domains/${domain}`,
        { phase: 'attachDomain' },
      );
      return attachmentFromCf(existing);
    }
    throw err;
  }
}

export async function detachDomain(
  api: CloudflareApi,
  project: HostProject,
  domain: string,
): Promise<void> {
  await api.request<unknown>(
    'DELETE',
    `/accounts/{account_id}/pages/projects/${project.slug}/domains/${domain}`,
    { phase: 'detachDomain' },
  );
}
