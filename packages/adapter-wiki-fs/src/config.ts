/**
 * Zod-validated config for adapter-wiki-fs.
 *
 * @module
 */

import { z } from 'zod';
import { AgentryError } from '@openagentry/core';

export const wikiFsConfigSchema = z
  .object({
    workspaceVaultPath: z.string().min(1, 'workspaceVaultPath must be a non-empty string'),
    projectVaultPath: z.string().min(1).optional(),
    search: z
      .object({
        maxResults: z.number().int().positive().optional(),
        snippetLength: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type WikiFsConfig = z.infer<typeof wikiFsConfigSchema>;

export function parseWikiFsConfig(input: unknown): WikiFsConfig {
  const result = wikiFsConfigSchema.safeParse(input);
  if (!result.success) {
    throw new AgentryError({
      code: 'E_WIKI_FS_SCHEMA',
      message: `[E_WIKI_FS_SCHEMA] Invalid wiki-fs config: ${result.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`,
      phase: 'init',
      adapter: 'wiki-fs',
      context: { issues: result.error.issues },
    });
  }
  return result.data;
}
