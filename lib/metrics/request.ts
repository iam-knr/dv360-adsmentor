// Query parsing for GET /api/dv/metrics/grid and /cards: `level`, `ids` (comma separated), `d` (routes.md 6.1),
// optional `currency`. Errors are reported as 400 with a code.
import type { ChartCardId, MetricLevel } from './types';

export const LEVELS: readonly MetricLevel[] = ['advertiser', 'campaign', 'io', 'li', 'adGroup'];
export const MAX_IDS = 1000;
const CARD_IDS: readonly ChartCardId[] = [
  'totalCost',
  'avgPerformance',
  'impressionsLost',
  'addedImpressionReach',
  'exploreBudgetOptions',
];

export interface MetricsQuery {
  level: MetricLevel;
  ids: string[];
  d: string | null;
  currency: string | null;
  cards: ChartCardId[] | undefined;
}

export type ParseResult =
  { ok: true; query: MetricsQuery } | { ok: false; code: string; message: string };

export function parseMetricsQuery(params: URLSearchParams): ParseResult {
  const level = params.get('level') as MetricLevel | null;
  if (!level || !LEVELS.includes(level)) {
    return { ok: false, code: 'BAD_LEVEL', message: `level must be one of ${LEVELS.join(', ')}` };
  }
  const ids = [
    ...new Set(
      params
        .getAll('ids')
        .flatMap((v) => v.split(','))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > MAX_IDS) {
    return { ok: false, code: 'TOO_MANY_IDS', message: `at most ${MAX_IDS} ids` };
  }
  const currency = params.get('currency')?.trim().toUpperCase() || null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, code: 'BAD_CURRENCY', message: 'currency must be an ISO 4217 code' };
  }
  const rawCards = params.get('cards');
  const cards = rawCards ? (rawCards.split(',').map((c) => c.trim()) as ChartCardId[]) : undefined;
  if (cards?.some((c) => !CARD_IDS.includes(c))) {
    return { ok: false, code: 'BAD_CARD', message: `cards must be among ${CARD_IDS.join(', ')}` };
  }
  return { ok: true, query: { level, ids, d: params.get('d'), currency, cards } };
}
