import 'server-only';
// Server side of the four History pages: guard, resolve the entity from the URL, read page 1 (module 05 2.1).
import { notFound } from 'next/navigation';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { requireView } from '@/lib/scope/guard';
import { getHistory } from './read';
import type { HistoryEntityType, HistoryPageData } from './types';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export interface HistoryPageLoad {
  data: HistoryPageData;
  initialParams: { d: string | null; local: boolean; system: boolean };
}

/** `entityId` is the row id the scope resolver returned. REPORTING_ONLY gets the 404 page from `requireView`. */
export async function loadHistoryPage(
  type: HistoryEntityType,
  entityId: string,
  q: Record<string, string | string[] | undefined>,
): Promise<HistoryPageLoad> {
  const user = await requireView('RO');
  const d = one(q.d) ?? null;
  const local = one(q.tz) === 'local';
  const system = one(q.s) === '1';
  try {
    const data = await getHistory(user, {
      entityType: type,
      entityId,
      d,
      includeSystem: system,
      tz: 'advertiser',
    });
    return { data, initialParams: { d, local, system } };
  } catch (e) {
    // a malformed `d` falls back to the default range rather than showing an error page
    if (e instanceof ServiceFailure && e.code === 'INVALID' && d) {
      const data = await getHistory(user, { entityType: type, entityId, includeSystem: system });
      return { data, initialParams: { d: null, local, system } };
    }
    if (e instanceof ServiceFailure) notFound();
    throw e;
  }
}
