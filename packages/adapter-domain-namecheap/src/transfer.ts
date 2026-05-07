/**
 * Implementation of DomainAdapter.initiateTransfer for Namecheap.
 * Calls namecheap.domains.transfer.create and maps the response to the
 * core DomainTransfer interface.
 *
 * @module
 */

import type { DomainTransfer } from '@openagentry/core';
import type { NamecheapDomainConfig } from './config.js';
import { namecheapFetch } from './http.js';
import { namecheapError, NAMECHEAP_ERROR_CODES } from './errors.js';
import { xmlString } from './xml.js';

type CoreTransferStatus = 'pending' | 'confirmed' | 'failed';

/**
 * Maps a Namecheap transfer status string to the core union.
 * Unknown / unmapped statuses default to 'pending' (conservative — the caller
 * should poll and detect any real failure later).
 */
function mapTransferStatus(namecheapStatus: string | undefined): CoreTransferStatus {
  switch (namecheapStatus) {
    case 'Success':
      return 'confirmed';
    case 'Failed':
      return 'failed';
    case 'Inprogress':
    case 'Pending':
      return 'pending';
    default:
      return 'pending';
  }
}

export async function initiateTransfer(
  cfg: NamecheapDomainConfig,
  domain: string,
  authCode: string,
): Promise<DomainTransfer> {
  const envelope = await namecheapFetch(
    cfg,
    'namecheap.domains.transfer.create',
    {
      DomainName: domain,
      EPPCode: authCode,
      Years: '1',
    },
    'transfer',
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (envelope as any)?.ApiResponse?.CommandResponse?.DomainTransferCreateResult;
  if (result == null) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: 'Namecheap initiateTransfer response missing DomainTransferCreateResult element.',
      phase: 'transfer',
      suggestedFix: 'Retry the request. If the issue persists, verify the domain and auth code.',
    });
  }

  const transferId = xmlString(result['@_TransferID']);
  if (!transferId) {
    throw namecheapError({
      code: NAMECHEAP_ERROR_CODES.UPSTREAM,
      message: 'Namecheap initiateTransfer response missing TransferID attribute.',
      phase: 'transfer',
      suggestedFix:
        'Retry the request. If the issue persists, check the Namecheap dashboard for transfer status.',
    });
  }

  const rawStatus = xmlString(result['@_Status']);
  const status = mapTransferStatus(rawStatus ?? undefined);

  return {
    domain,
    transferId,
    status,
    authCode,
  };
}
