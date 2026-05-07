# @openagentry/adapter-email-resend

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

`EmailAdapter` for [OpenAgentry](https://github.com/timncox/openagentry), backed by [Resend](https://resend.com).

## Install

```bash
pnpm add @openagentry/adapter-email-resend @openagentry/core
```

## Usage

```ts
import email from '@openagentry/adapter-email-resend';

await email.send({
  to: 'recipient@example.com',
  from: 'you@verified-domain.com',
  subject: 'Hello',
  text: 'plain-text body',
});
```

Reads `OA_RESEND_API_KEY` from the environment. Get a key at https://resend.com/api-keys.

For programmatic configuration, use the factory:

```ts
import { createResendEmailAdapter } from '@openagentry/adapter-email-resend';
const email = createResendEmailAdapter({ apiKey: process.env.MY_RESEND_KEY });
```

## Documentation

See [LLM.md](./LLM.md) for the full operator reference, field mapping, error codes, and limitations.

## License

Apache-2.0.
