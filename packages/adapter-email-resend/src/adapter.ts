/**
 * Resend EmailAdapter factory. Returns a frozen object implementing the core
 * EmailAdapter interface. The single `send` method delegates to the shared
 * `send` function in `send.ts`.
 *
 * @module
 */

import type { EmailAdapter, EmailMessage, EmailSendResult } from '@openagentry/core';
import { parseResendEmailConfig, type ResendEmailConfig } from './config.js';
import { send } from './send.js';
import { ADAPTER_ID } from './errors.js';

export function createResendEmailAdapter(input: unknown): EmailAdapter {
  const cfg: ResendEmailConfig = parseResendEmailConfig(input);
  return Object.freeze({
    category: 'email' as const,
    id: ADAPTER_ID,
    send(message: EmailMessage): Promise<EmailSendResult> {
      return send(cfg, message);
    },
  });
}
