/**
 * Implementation of EmailAdapter.send for Resend. Shapes the core
 * `EmailMessage` into Resend's wire format, dispatches via `resendFetch`,
 * synthesizes an `EmailSendResult` from the response.
 *
 * @module
 */

import type { EmailMessage, EmailSendResult } from '@openagentry/core';
import type { ResendEmailConfig } from './config.js';
import { attachmentContentToBase64 } from './attachments.js';
import { resendFetch } from './http.js';
import { resendError, RESEND_ERROR_CODES } from './errors.js';

interface ResendAttachmentBody {
  filename: string;
  content: string;
  content_type?: string;
}

interface ResendSendBody {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  reply_to?: string;
  attachments?: ResendAttachmentBody[];
}

export function shapeResendBody(message: EmailMessage): ResendSendBody {
  const body: ResendSendBody = {
    to: message.to,
    from: message.from,
    subject: message.subject,
  };
  if (message.text !== undefined) body.text = message.text;
  if (message.html !== undefined) body.html = message.html;
  if (message.replyTo !== undefined) body.reply_to = message.replyTo;
  if (message.attachments !== undefined && message.attachments.length > 0) {
    body.attachments = message.attachments.map((a) => {
      const out: ResendAttachmentBody = {
        filename: a.filename,
        content: attachmentContentToBase64(a.content),
      };
      if (a.contentType !== undefined) out.content_type = a.contentType;
      return out;
    });
  }
  return body;
}

export async function send(
  cfg: ResendEmailConfig,
  message: EmailMessage,
): Promise<EmailSendResult> {
  const body = shapeResendBody(message);
  const res = await resendFetch(
    cfg,
    '/emails',
    { method: 'POST', body: JSON.stringify(body) },
    'send',
  );
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch (cause) {
    throw resendError({
      code: RESEND_ERROR_CODES.UPSTREAM,
      message: 'Resend returned a non-JSON response on send',
      phase: 'send',
      suggestedFix: 'Resend returned an unexpected response shape. Retry; if persistent, file a ticket.',
      cause,
    });
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw resendError({
      code: RESEND_ERROR_CODES.UPSTREAM,
      message: `Resend send response was not an object: ${JSON.stringify(parsed)}`,
      phase: 'send',
      suggestedFix: 'Resend returned an unexpected response shape. Retry; if persistent, file a ticket.',
    });
  }
  const id = (parsed as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) {
    throw resendError({
      code: RESEND_ERROR_CODES.UPSTREAM,
      message: `Resend send response missing or malformed "id" field: ${JSON.stringify(parsed)}`,
      phase: 'send',
      suggestedFix: 'Resend returned an unexpected response shape. Retry; if persistent, file a ticket.',
    });
  }
  // Resend's send response doesn't carry a status field; synthesize "queued"
  // because EmailSendResult.status is required by the core interface.
  return { id, status: 'queued' };
}
