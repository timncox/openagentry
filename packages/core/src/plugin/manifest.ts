/**
 * Plugin manifest — declared in each plugin's package.json under the
 * `openagentry` key. Validated by zod at install time.
 *
 * @module
 */

import { z } from 'zod';
import { AgentryError } from '../runtime/errors.js';

export const pluginTypes = ['scaffold', 'adapter', 'mcp', 'command', 'skill'] as const;
export type PluginType = (typeof pluginTypes)[number];

export const adapterCategories = [
  'host',
  'db',
  'auth',
  'email',
  'llm',
  'storage',
  'kv',
  'cron',
  'domain',
  'repo',
  'wiki',
  'billing',
  'push',
] as const;
export type AdapterCategory = (typeof adapterCategories)[number];

const envVarSchema = z.object({
  name: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'env var must be SCREAMING_SNAKE_CASE'),
  secret: z.boolean().optional().default(false),
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
});

const aiFriendlySchema = z
  .object({
    structuredErrors: z.boolean().optional().default(true),
    dryRun: z.boolean().optional().default(false),
    idempotent: z.array(z.string()).optional().default([]),
    queryableState: z.boolean().optional().default(true),
  })
  .optional()
  .default({});

export const pluginManifestSchema = z.object({
  type: z.enum(pluginTypes),
  id: z.string().min(1),
  category: z.enum(adapterCategories).optional(),
  protocolVersion: z
    .string()
    .regex(
      /^(\^|>=)?\d+$/,
      'protocolVersion must be a range like "1", "^1", or ">=1"',
    ),
  envVars: z.array(envVarSchema).default([]),
  fillsSlots: z.array(z.string()).default([]),
  requiresSlots: z.array(z.string()).default([]),
  capabilities: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])).default({}),
  aiFriendly: aiFriendlySchema,
  llmDocs: z.string().optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export function validateManifest(input: unknown): PluginManifest {
  const result = pluginManifestSchema.safeParse(input);
  if (!result.success) {
    throw new AgentryError({
      code: 'E_PLUGIN_MANIFEST_INVALID',
      message: `Plugin manifest failed validation: ${result.error.message}`,
      phase: 'validate',
      context: { issues: result.error.issues },
    });
  }
  return result.data;
}
