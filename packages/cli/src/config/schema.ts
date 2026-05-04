/**
 * Zod schemas for CLI-managed config files.
 *
 * @module
 */

import { z } from 'zod';

export const homeConfigSchema = z
  .object({
    workspacePath: z.string().optional(),
    telemetryOptIn: z.boolean().optional().default(false),
  })
  .strict();

export type HomeConfig = z.infer<typeof homeConfigSchema>;

export const workspaceConfigSchema = z
  .object({
    plugins: z.array(z.string()).default([]),
    defaultEnv: z.enum(['preview', 'prod', 'dev']).optional(),
  })
  .strict();

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>;
