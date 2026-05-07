/**
 * Zod-validated configuration for the Namecheap domain adapter.
 *
 * @module
 */

import { AgentryError } from '@openagentry/core';
import { z } from 'zod';

export const namecheapContactSchema = z
  .object({
    firstName: z.string().trim().min(1, 'firstName must be a non-empty string'),
    lastName: z.string().trim().min(1, 'lastName must be a non-empty string'),
    address1: z.string().trim().min(1, 'address1 must be a non-empty string'),
    city: z.string().trim().min(1, 'city must be a non-empty string'),
    stateProvince: z.string().trim().min(1, 'stateProvince must be a non-empty string'),
    postalCode: z.string().trim().min(1, 'postalCode must be a non-empty string'),
    country: z.string().trim().length(2, 'country must be ISO 3166-1 alpha-2 (exactly 2 chars)'),
    phone: z
      .string()
      .trim()
      .regex(/^\+\d+\.\d+$/, 'phone must be Namecheap format like +1.5551234567'),
    email: z.string().trim().email('email must be a valid email address'),
  })
  .strict();

export const namecheapDomainConfigSchema = z
  .object({
    apiUser: z.string().trim().min(1, 'apiUser must be a non-empty string'),
    apiKey: z.string().trim().min(1, 'apiKey must be a non-empty string'),
    clientIp: z.string().trim().min(1, 'clientIp must be a non-empty string'),
    userName: z.string().trim().min(1).optional(),
    endpoint: z.string().url().optional(),
    useSandbox: z.boolean().optional().default(false),
    contact: namecheapContactSchema.optional(),
  })
  .strict();

export type NamecheapContactInput = z.input<typeof namecheapContactSchema>;
export type NamecheapContact = z.output<typeof namecheapContactSchema>;

export type NamecheapDomainConfigInput = z.input<typeof namecheapDomainConfigSchema>;
export type NamecheapDomainConfigParsed = z.output<typeof namecheapDomainConfigSchema>;

const PROD_ENDPOINT = 'https://api.namecheap.com/xml.response';
const SANDBOX_ENDPOINT = 'https://api.sandbox.namecheap.com/xml.response';

export interface NamecheapDomainConfig
  extends Required<
    Pick<
      NamecheapDomainConfigParsed,
      'apiUser' | 'apiKey' | 'clientIp' | 'userName' | 'endpoint' | 'useSandbox'
    >
  > {
  contact?: NamecheapContact;
}

export function parseNamecheapDomainConfig(input: unknown): NamecheapDomainConfig {
  let parsed: NamecheapDomainConfigParsed;
  try {
    parsed = namecheapDomainConfigSchema.parse(input);
  } catch (err) {
    const zodIssues = (err as { issues?: unknown[] }).issues ?? [];
    throw new AgentryError({
      code: 'E_NAMECHEAP_SCHEMA',
      message: 'Invalid Namecheap domain adapter configuration',
      phase: 'init',
      adapter: 'domain-namecheap',
      suggestedFix:
        'Check all required config fields: apiUser, apiKey, clientIp. See context.zodIssues for details.',
      context: { zodIssues },
    });
  }

  const endpoint =
    parsed.endpoint !== undefined
      ? parsed.endpoint
      : parsed.useSandbox
        ? SANDBOX_ENDPOINT
        : PROD_ENDPOINT;

  const cfg: NamecheapDomainConfig = {
    apiUser: parsed.apiUser,
    apiKey: parsed.apiKey,
    clientIp: parsed.clientIp,
    userName: parsed.userName ?? parsed.apiUser,
    endpoint,
    useSandbox: parsed.useSandbox,
  };
  if (parsed.contact !== undefined) cfg.contact = parsed.contact;
  return cfg;
}
