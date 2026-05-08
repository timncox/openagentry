/**
 * LlmAdapter.listModels — plain fetch against OpenRouter's /models endpoint.
 *
 * @module
 */

import type { LlmModel } from '@openagentry/core';
import type { OpenrouterLlmConfig } from '../config.js';
import { httpToOpenrouterError, networkErr } from '../errors.js';
import { buildHeaders } from '../headers.js';

interface RawModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
}

interface RawList {
  data?: RawModel[];
}

export async function listModelsOp(cfg: OpenrouterLlmConfig): Promise<LlmModel[]> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/models`;
  let response: Response;
  try {
    response = await fetch(url, { headers: buildHeaders(cfg) });
  } catch (err) {
    throw networkErr(err, 'listModels');
  }
  if (!response.ok) {
    throw await httpToOpenrouterError(response, 'listModels');
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
    const label = typeof m.name === 'string' && m.name.length > 0 ? m.name : m.id;
    const contextWindow = typeof m.context_length === 'number' ? m.context_length : 0;
    models.push({
      id: m.id,
      label,
      contextWindow,
      capabilities: { streaming: true },
    });
  }
  return models;
}
