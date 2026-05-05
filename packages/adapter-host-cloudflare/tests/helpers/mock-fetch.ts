import { vi, type Mock } from 'vitest';

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface MockFetch {
  fetch: typeof fetch;
  calls: RecordedCall[];
  mock: Mock;
}

type Responder =
  | Response
  | { body: unknown; status?: number; headers?: Record<string, string> };

// Statuses that MUST have a null body per the Fetch spec (undici enforces this).
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

function toResponse(r: Responder): Response {
  if (r instanceof Response) return r;
  const status = r.status ?? 200;
  const headers = new Headers({ 'content-type': 'application/json', ...(r.headers ?? {}) });
  const bodyContent = NULL_BODY_STATUSES.has(status)
    ? null
    : typeof r.body === 'string'
    ? r.body
    : JSON.stringify(r.body);
  return new Response(bodyContent, { status, headers });
}

/**
 * Build a fetch mock that returns successive responses (or a single repeating
 * response). Records every call for assertion.
 */
export function makeMockFetch(...responders: Responder[]): MockFetch {
  const calls: RecordedCall[] = [];
  let i = 0;
  const mock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as { url: string }).url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers !== undefined) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => {
        headers[k] = v;
      });
    }
    const bodyInit = init?.body;
    const body =
      typeof bodyInit === 'string'
        ? bodyInit
        : bodyInit instanceof Uint8Array
        ? '[bytes]'
        : bodyInit === undefined || bodyInit === null
        ? undefined
        : '[stream]';
    calls.push(body !== undefined ? { url, method, headers, body } : { url, method, headers });
    const r = responders[Math.min(i, responders.length - 1)];
    i += 1;
    if (r === undefined) throw new Error(`mock-fetch ran out of responders at call ${i}`);
    return toResponse(r);
  });
  return { fetch: mock as unknown as typeof fetch, calls, mock };
}
