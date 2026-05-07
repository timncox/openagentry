# Changelog

## 0.1.0-alpha.0 (2026-05-06)

- Initial release.
- Implements `EmailAdapter.send` for [Resend](https://resend.com).
- Strict to core `EmailMessage` interface (`to`, `from`, `subject`, `text`, `html`, `replyTo`, `attachments`). No `cc`/`bcc`/`tags`/scheduled-send/idempotency-key in v0.
- Five stable error codes: `E_RESEND_AUTH`, `E_RESEND_INVALID`, `E_RESEND_RATE_LIMIT`, `E_RESEND_NETWORK`, `E_RESEND_UPSTREAM`.
- Lazy default export from `OA_RESEND_API_KEY` + optional `OA_RESEND_ENDPOINT`.
- Conforms to `@openagentry/adapter-test-suite@0.1.0-alpha.2` email suite (universal + `email/structured-errors`; opt-in `email/send-returns-id-shape`).
