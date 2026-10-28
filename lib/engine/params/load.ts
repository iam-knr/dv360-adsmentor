import baseParams from '../../../engine/params.json';
import { hashJson } from './hash';
import { paramsSchema, type Params } from './schema';

export interface LoadedParams {
  params: Params;
  /** Hash of the merged, validated parameters; pinned in SimClock.paramsVersion. */
  hash: string;
}

/** RFC 7396 merge patch: null deletes a key, objects merge, everything else replaces. */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const base: Record<string, unknown> =
    target !== null && typeof target === 'object' && !Array.isArray(target)
      ? { ...(target as Record<string, unknown>) }
      : {};
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === null) delete base[k];
    else base[k] = mergePatch(base[k], v);
  }
  return base;
}

/** Base file plus optional merge-patches (classroom, scenario). Throws on schema errors. */
export function loadParams(...patches: unknown[]): LoadedParams {
  let merged: unknown = baseParams;
  for (const p of patches) merged = mergePatch(merged, p);
  const params = paramsSchema.parse(merged);
  return { params, hash: hashJson(params) };
}

let cached: LoadedParams | null = null;

/** The base parameters, validated once per process. */
export function defaultParams(): LoadedParams {
  cached ??= loadParams();
  return cached;
}
