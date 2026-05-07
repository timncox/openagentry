# @openagentry/adapter-email-resend

EmailAdapter for OpenAgentry, backed by [Resend](https://resend.com).

## What it does

Sends transactional email via Resend's HTTP API. Implements `EmailAdapter.send(message)` from `@openagentry/core`. No SDK — direct `fetch` calls against `https://api.resend.com/emails`.

## When to use

- You want to send transactional email (signup confirmation, password reset, receipt, alert) and prefer Resend's developer-focused API + dashboard.
- You're OK with v0 limitations: no `cc`/`bcc`/`tags`/scheduled-send/idempotency-key support yet.

## Configuration

```ts
import { createResendEmailAdapter } from '@openagentry/adapter-email-resend';

const email = createResendEmailAdapter({
  apiKey: process.env.OA_RESEND_API_KEY!,
  // endpoint: 'https://api.resend.com',  // optional override
});
```

Or use the default export, which builds itself from env vars on first `send()`:

```ts
import email from '@openagentry/adapter-email-resend';
await email.send({ to: 'a@b.com', from: 'me@verified.com', subject: 'hi', text: 'hello' });
```

### Env vars

| Var | Required | Purpose |
|---|---|---|
| `OA_RESEND_API_KEY` | yes | Resend API key (`re_*`) from https://resend.com/api-keys |
| `OA_RESEND_ENDPOINT` | no | Override base URL (default `https://api.resend.com`) |

## API

```ts
adapter.send({
  to: string | string[],
  from: string,
  subject: string,
  text?: string,
  html?: string,
  replyTo?: string,
  attachments?: Array<{
    filename: string,
    content: ArrayBuffer | string,
    contentType?: string,
  }>,
}): Promise<{ id: string, status: string }>
```

`status` is always `"queued"` — Resend's send response carries no status field, so we synthesize one.

### Field mapping (camelCase ↔ Resend's snake_case)

| Interface field | Wire field |
|---|---|
| `replyTo` | `reply_to` |
| `attachments[].contentType` | `attachments[].content_type` |

### Attachment encoding

`attachments[].content` accepts `ArrayBuffer | string`:
- `ArrayBuffer` → encoded byte-for-byte to base64
- `string` → treated as UTF-8 text, encoded to base64

## Errors

All failures throw `AgentryError`. Stable codes:

| Code | When |
|---|---|
| `E_RESEND_AUTH` | 401/403, or `OA_RESEND_API_KEY` unset on default export |
| `E_RESEND_INVALID` | 422 — malformed address or **unverified sending domain** |
| `E_RESEND_RATE_LIMIT` | 429 — `context.retryAfter` carries seconds from `Retry-After` header |
| `E_RESEND_NETWORK` | `fetch` rejection (DNS, timeout) |
| `E_RESEND_UPSTREAM` | 5xx, or unrecognized response shape |

The adapter does not retry. On `E_RESEND_RATE_LIMIT`, back off and retry yourself.

## Limitations (v0)

- No `cc`, `bcc`, `headers`, `tags`, or `scheduled_at` support.
- No idempotency-key. Naive retries can dupe.
- No webhook handling for delivery events.
- No domain provisioning.

## Testing tips

- Override `OA_RESEND_ENDPOINT` to point at MSW or a fake server for local tests.
- Send to `delivered@resend.dev` for wire-format smoke tests (real key required).
- See `tests/integration.test.ts` for the gated end-to-end pattern.
