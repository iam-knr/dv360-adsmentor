// Plumbing of the YouTube route handlers (routes.md 8.7): body parsing and the Result to HTTP mapping. Pure.
import { z } from 'zod';
import { badRequest, json, resultToHttp, unauthenticated } from '@/lib/line-items/api';
import type { Result } from './types';

export { badRequest, json, resultToHttp, unauthenticated };

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) });
export const parseStatusBody = (raw: unknown) => statusSchema.safeParse(raw);

const writeSchema = z.object({
  value: z.record(z.string(), z.unknown()),
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().optional(),
});
export const parseWrite = (raw: unknown) => writeSchema.safeParse(raw);

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['ACTIVATE', 'PAUSE']),
});
export const parseBulk = (raw: unknown) => bulkSchema.safeParse(raw);

const previewSchema = z.object({
  adGroupId: z.string().min(1),
  videoRef: z.string().default(''),
  headline: z.string().optional(),
  longHeadline: z.string().optional(),
  description: z.string().optional(),
  callToAction: z.string().optional(),
  businessName: z.string().optional(),
  displayUrl: z.string().optional(),
  logoAssetId: z.string().nullable().optional(),
  companionAssetId: z.string().nullable().optional(),
  filter: z.enum(['ALL', 'IN_STREAM', 'IN_FEED', 'SHORTS']).default('ALL'),
  format: z
    .enum(['IN_STREAM_SKIPPABLE', 'BUMPER', 'NON_SKIPPABLE_IN_STREAM', 'IN_FEED', 'SHORTS'])
    .nullable()
    .default(null),
  device: z.enum(['PHONE', 'COMPUTER', 'TV']).default('PHONE'),
  surface: z.enum(['YOUTUBE', 'VIDEO_PARTNERS', 'GOOGLE_TV']).default('YOUTUBE'),
});
export const parsePreview = (raw: unknown) => previewSchema.safeParse(raw);

export function respond<T>(res: Result<T>, okStatus = 200): Response {
  const { status, body } = resultToHttp(res, okStatus);
  return json(body, status);
}
