/**
 * LlmAdapter.listModels — plain fetch against the gateway's OpenAI-compat
 * `/v1/models` endpoint. No SDK dependency; uses `globalThis.fetch`.
 *
 * @module
 */

import type { LlmModel } from '@openagentry/core';
import type { AigatewayLlmConfig } from '../config.js';
import { httpToAigatewayError, networkErr } from '../errors.js';

interface RawModel {
  id?: unknown;
  context_window?: unknown;
  capabilities?: { tools?: unknown; vision?: unknown } | undefined;
}

interface RawList {
  data?: RawModel[];
}

export async function listModelsOp(cfg: AigatewayLlmConfig): Promise<LlmModel[]> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/models`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
  } catch (err) {
    throw networkErr(err, 'listModels');
  }
  if (!response.ok) {
    throw await httpToAigatewayError(response, 'listModels');
  }
  let json: RawList;
  try {
    json = (await response.json()) as RawList;
  } catch (err) {
    throw networkErr(err, 'listModels');
  }
  const data = Array.isArray(json.data) ? json.data : [];
  const models: LlmModel[] = [];
  for (const m of data) {
    if (typeof m?.id !== 'string' || m.id.length === 0) continue;
    const caps: LlmModel['capabilities'] = { streaming: true };
    if (typeof m.capabilities?.tools === 'boolean') caps.tools = m.capabilities.tools;
    if (typeof m.capabilities?.vision === 'boolean') caps.vision = m.capabilities.vision;
    models.push({
      id: m.id,
      label: m.id,
      contextWindow: typeof m.context_window === 'number' ? m.context_window : 0,
      capabilities: caps,
    });
  }
  return models;
}
