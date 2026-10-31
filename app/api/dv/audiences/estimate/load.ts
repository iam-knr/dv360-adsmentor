// Reads what the estimate needs: the sandbox clock, the advertiser and its audiences (server only).
import 'server-only';
import { withBypass, type Tx } from '@/lib/db';
import type { AudienceEntity, LoadedParams, World } from '@/lib/engine';
import type { AudienceMeta } from '@/lib/targeting/audience';
import type { LiType } from '@/lib/validation/constants/li-compat';

function tzOffsetMin(timeZone: string, atMs: number): number {
  try {
    const d = new Date(atMs);
    const local = Date.parse(d.toLocaleString('en-US', { timeZone, hour12: false }));
    const utc = Date.parse(d.toLocaleString('en-US', { timeZone: 'UTC', hour12: false }));
    return Math.round((local - utc) / 60_000);
  } catch {
    return 0;
  }
}

function marketFor(loaded: LoadedParams, currency: string): string {
  for (const [key, m] of Object.entries(loaded.params.markets))
    if (m.currency === currency) return key;
  return 'IN';
}

type AudienceRow = Awaited<ReturnType<Tx['audience']['findMany']>>[number];

const KIND = (t: AudienceRow['type']): AudienceMeta['kind'] =>
  t === 'COMBINED'
    ? 'COMBINED'
    : t === 'LOOKALIKE'
      ? 'LOOKALIKE'
      : t.startsWith('CUSTOM_')
        ? 'CUSTOM'
        : 'FIRST_PARTY';

export interface AdvertiserAudiences {
  advertiserId: string;
  rows: AudienceRow[];
  nowMs: number;
}

export async function readAudiences(
  sandboxId: string,
  advertiserId?: string | null,
): Promise<AdvertiserAudiences | null> {
  return withBypass(async (tx) => {
    const adv = await tx.advertiser.findFirst({
      where: { sandboxId, ...(advertiserId ? { id: advertiserId } : {}) },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!adv) return null;
    const [rows, clock] = await Promise.all([
      tx.audience.findMany({
        where: { sandboxId, advertiserId: adv.id, status: { not: 'ARCHIVED' } },
        orderBy: { name: 'asc' },
      }),
      tx.simClock.findUnique({ where: { sandboxId } }),
    ]);
    const nowMs = clock
      ? clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000
      : Date.now();
    return { advertiserId: adv.id, rows, nowMs };
  });
}

export function audienceMeta(row: AudienceRow, nowMs: number): AudienceMeta {
  const kind = KIND(row.type);
  const waitMs = row.availableAt ? row.availableAt.getTime() - nowMs : 0;
  return {
    id: row.id,
    name: row.name,
    kind,
    ...(row.type === 'YOUTUBE_USERS' || row.type === 'CUSTOM_INTENT_YOUTUBE'
      ? { eligibleTypes: ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'] as LiType[] }
      : {}),
    ...(waitMs > 0 ? { availableInHours: Math.ceil(waitMs / 3_600_000) } : {}),
    ...(row.sizeDisplay !== null && row.sizeDisplay < 1000n ? { sizeBucket: '< 1K' } : {}),
  };
}

export async function readWorld(
  sandboxId: string,
  advertiserId: string | null | undefined,
  loaded: LoadedParams,
): Promise<World | null> {
  return withBypass(async (tx) => {
    const adv = await tx.advertiser.findFirst({
      where: { sandboxId, ...(advertiserId ? { id: advertiserId } : {}) },
      orderBy: { id: 'asc' },
    });
    // A sandbox without an advertiser (the dev page, a fresh class) is forecast on the default market.
    if (!adv) {
      const clock = await tx.simClock.findUnique({ where: { sandboxId } });
      const simStartMs = clock?.simStart.getTime() ?? Date.UTC(2026, 0, 1);
      return {
        sandboxId,
        marketSeed: clock?.marketSeed ?? 'market',
        sandboxSeed: clock?.sandboxSeed ?? 'sandbox',
        simStartMs,
        tzOffsetMin: 330,
        country: 'IN',
        partner: { id: 'partner', currency: 'INR' },
        advertiser: {
          id: 'none',
          currency: 'INR',
          tzOffsetMin: 330,
          vertical: 'ecommerce',
          alertPrefs: {},
        },
        campaigns: [],
        insertionOrders: [],
        lineItems: [],
        creatives: [],
        audiences: [],
        floodlightActivities: [],
        deals: [],
      } satisfies World;
    }
    const [clock, audiences, partner] = await Promise.all([
      tx.simClock.findUnique({ where: { sandboxId } }),
      tx.audience.findMany({ where: { sandboxId, advertiserId: adv.id } }),
      tx.partner.findFirst({ where: { sandboxId }, orderBy: { id: 'asc' } }),
    ]);
    const simStartMs = clock?.simStart.getTime() ?? Date.UTC(2026, 0, 1);
    const entities: AudienceEntity[] = audiences.map((a) => ({
      id: a.id,
      type:
        a.type === 'LOOKALIKE'
          ? 'lookalike'
          : a.type === 'COMBINED' || a.type === 'CUSTOM_INTENT_YOUTUBE'
            ? 'custom'
            : a.type === 'CUSTOM_AFFINITY'
              ? 'affinity'
              : a.type === 'CUSTOM_INTENT_DISPLAY_VIDEO'
                ? 'in_market'
                : 'first_party',
      ...(a.sizeDisplay !== null ? { size: Number(a.sizeDisplay) } : {}),
      ...(a.lookalikeReachPct !== null ? { reachPct: Number(a.lookalikeReachPct) } : {}),
    }));
    return {
      sandboxId,
      marketSeed: clock?.marketSeed ?? 'market',
      sandboxSeed: clock?.sandboxSeed ?? 'sandbox',
      simStartMs,
      tzOffsetMin: tzOffsetMin(adv.timeZone, simStartMs),
      country: marketFor(loaded, adv.currencyCode),
      partner: { id: partner?.id ?? 'partner', currency: adv.currencyCode },
      advertiser: {
        id: adv.id,
        currency: adv.currencyCode,
        tzOffsetMin: tzOffsetMin(adv.timeZone, simStartMs),
        vertical: 'ecommerce',
        alertPrefs: {},
      },
      campaigns: [],
      insertionOrders: [],
      lineItems: [],
      creatives: [],
      audiences: entities,
      floodlightActivities: [],
      deals: [],
    } satisfies World;
  });
}
