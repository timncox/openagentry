/**
 * listModels — returns the hardcoded model list from the dispatch.
 *
 * @module
 */

import type { LlmModel } from '@openagentry/core';
import type { CliDispatch } from '../dispatch/index.js';

export function listModels(dispatch: CliDispatch): LlmModel[] {
  return dispatch.models();
}
