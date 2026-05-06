import type { NeonConfig } from '../../src/config.js';

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface MockResponseSpec {
  body?: unknown;
  status?: number;
  headers?: Record<string, string>;
}

// Statuses that MUST have a null body per the Fetch spec (undici enforces this).
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

export function makeMockFetch(...responses: MockResponseSpec[]) {
  const calls: RecordedCall[] = [];
  let index = 0;

  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};
    const initHeaders = init?.headers as Record<string, string> | undefined;
    if (initHeaders !== undefined) {
      for (const [k, v] of Object.entries(initHeaders)) headers[k.toLowerCase()] = v;
    }
    let body = '';
    if (typeof init?.body === 'string') body = init.body;
    else if (init?.body !== undefined) body = JSON.stringify(init.body);
    calls.push({ url, method, headers, body });

    const spec = responses[index];
    index += 1;
    const status = spec?.status ?? 200;
    const respHeaders = new Headers(spec?.headers);
    if (!respHeaders.has('content-type')) respHeaders.set('content-type', 'application/json');
    const respBody = NULL_BODY_STATUSES.has(status)
      ? null
      : typeof spec?.body === 'string'
      ? spec.body
      : JSON.stringify(spec?.body ?? {});
    return new Response(respBody, { status, headers: respHeaders });
  };

  return { fetch: fetchImpl, calls };
}

export const baseConfigInput: Pick<NeonConfig, 'apiKey'> & {
  apiBase: string;
  defaultRegion: string;
} = {
  apiKey: 'neon_test',
  apiBase: 'https://console.neon.tech/api/v2',
  defaultRegion: 'aws-us-east-2',
};
