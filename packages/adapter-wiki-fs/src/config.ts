/**
 * Zod-validated config for adapter-wiki-fs.
 *
 * @module
 */

import { z } from 'zod';
import { wikiFsError, WIKI_FS_ERROR_CODES } from './errors.js';

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
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw wikiFsError({
      code: WIKI_FS_ERROR_CODES.SCHEMA,
      message: `Invalid wiki-fs config: ${detail}`,
      phase: 'init',
      suggestedFix:
        "Pass an object with required 'workspaceVaultPath' (non-empty string). " +
        "'projectVaultPath' is optional. 'search.maxResults' and 'search.snippetLength' must be positive integers.",
      context: { issues: result.error.issues },
    });
  }
  return result.data;
}
