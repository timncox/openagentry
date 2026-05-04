/**
 * EmailAdapter — sends transactional email.
 *
 * @module
 */

export interface EmailMessage {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: ArrayBuffer | string;
    contentType?: string;
  }>;
}

export interface EmailSendResult {
  /** Provider-assigned message id. */
  id: string;
  /** Provider-reported status: queued, sent, etc. Vendor-specific values. */
  status: string;
}

export interface EmailAdapter {
  readonly category: 'email';
  readonly id: string;

  send(message: EmailMessage): Promise<EmailSendResult>;
}
