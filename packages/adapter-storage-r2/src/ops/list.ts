/**
 * StorageAdapter.list — paginated AsyncIterable over ListObjectsV2.
 *
 * @module
 */

import type { StorageObject } from '@openagentry/core';
import type { R2StorageConfig } from '../config.js';
import type { SignedFetch } from '../s3-client.js';
import { httpToR2Error, networkErr, r2Error, R2_ERROR_CODES } from '../errors.js';
import { presignGetUrl } from '../url.js';
import { parseListV2Response } from '../parse-list-response.js';

export async function* listOp(
  client: SignedFetch,
  cfg: R2StorageConfig,
  prefix?: string,
): AsyncIterable<StorageObject> {
  let continuationToken: string | undefined;
  do {
    const query: Record<string, string> = { 'list-type': '2' };
    if (prefix !== undefined) query.prefix = prefix;
    if (continuationToken !== undefined) query['continuation-token'] = continuationToken;

    let response: Response;
    try {
      response = await client.request({ method: 'GET', query });
    } catch (err) {
      throw networkErr(err, 'list', prefix);
    }
    if (!response.ok) {
      throw await httpToR2Error(response, 'list', prefix);
    }

    const xml = await response.text();
    let parsed;
    try {
      parsed = parseListV2Response(xml);
    } catch (err) {
      throw r2Error({
        code: R2_ERROR_CODES.UPSTREAM,
        message: `Failed to parse R2 list response: ${(err as Error).message}`,
        phase: 'list',
        suggestedFix: 'R2 returned a malformed XML response. Retry; if the failure persists, check the R2 status page.',
        context: { responseBody: xml.slice(0, 500) },
        cause: err,
      });
    }

    for (const obj of parsed.contents) {
      const url = await presignGetUrl(client, obj.key, cfg.presignTtlSeconds ?? 3600);
      yield {
        key: obj.key,
        url,
        size: obj.size,
        uploadedAt: obj.lastModified as StorageObject['uploadedAt'],
      };
    }

    continuationToken = parsed.isTruncated ? parsed.nextContinuationToken : undefined;
  } while (continuationToken !== undefined);
}
