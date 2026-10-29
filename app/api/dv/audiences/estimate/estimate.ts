// Impressions summary for the audience builder (G3, ENG 1.6 `estimateAudienceSize`). Every number comes from the
// engine's pure size function; the expression itself is `evaluateShares` (RC-030). Pure given a World.
import { estimateAudienceSize } from '@/lib/engine';
import type { AudienceEntity, LoadedParams, TargetingSpec, World } from '@/lib/engine';
import {
  audienceRefs,
  buildSummary,
  evaluateShares,
  googleAudience,
  type AudienceLists,
  type ImpressionsSummary,
} from '@/lib/targeting/audience';
import type { TargetingCriteria } from '@/lib/targeting/types';

type Format = Parameters<typeof estimateAudienceSize>[2][number];

/** Supply formats the line item type buys. */
export function formatsFor(type: string | undefined): Format[] {
  switch (type) {
    case 'VIDEO':
      return ['video_instream'];
    case 'CTV':
      return ['ctv'];
    case 'AUDIO':
      return ['audio'];
    case 'YT_VIDEO':
    case 'YT_AUDIO':
    case 'YT_ON_CTV':
      return ['youtube'];
    default:
      return ['display', 'native'];
  }
}

/** The part of the card the summary calls "Other targeting": environment and device (the rest keeps its own editors). */
export function otherSpec(c: TargetingCriteria | undefined): TargetingSpec {
  const spec: TargetingSpec = {};
  if (c?.environment) {
    const env = [c.environment.web && 'web', c.environment.app && 'app'].filter(
      (x): x is 'web' | 'app' => !!x,
    );
    if (env.length > 0) spec.environment = env;
  }
  const dev = c?.device?.types.filter((t) => t.mode === 'INCLUDE') ?? [];
  const map: Record<string, 'computer' | 'smartphone' | 'tablet' | 'ctv'> = {
    COMPUTER: 'computer',
    SMARTPHONE: 'smartphone',
    TABLET: 'tablet',
    CONNECTED_TV: 'ctv',
  };
  const devices = dev.map((d) => map[d.id]).filter((d): d is NonNullable<typeof d> => !!d);
  if (devices.length > 0 && devices.length < 4) spec.devices = devices;
  return spec;
}

export interface EstimateInput {
  world: World;
  loaded: LoadedParams;
  lists: AudienceLists;
  lineItemType?: string;
  criteria?: TargetingCriteria;
  flightDays: number;
}

/** Entities the engine needs: the advertiser's lists plus one per Google audience the state names. */
function entitiesFor(world: World, lists: AudienceLists): AudienceEntity[] {
  const known = new Set(world.audiences.map((a) => a.id));
  const extra: AudienceEntity[] = [];
  for (const r of audienceRefs(lists)) {
    if (known.has(r.id)) continue;
    const g = googleAudience(r.id);
    if (!g) continue;
    known.add(r.id);
    extra.push({ id: r.id, type: g.kind === 'AFFINITY' ? 'affinity' : 'in_market' });
  }
  return [...world.audiences, ...extra, { id: '__all__', type: 'custom', sizeFraction: 1 }];
}

export function estimateSummary(input: EstimateInput): ImpressionsSummary {
  const { loaded, lists } = input;
  const world: World = { ...input.world, audiences: entitiesFor(input.world, lists) };
  const formats = formatsFor(input.lineItemType);
  const size = (t: TargetingSpec) => estimateAudienceSize(world, t, formats, loaded);
  const none = size({});
  const other = otherSpec(input.criteria);
  const otherSize = size(other);

  // One audience's share of users: its size relative to a list that covers everybody (same identified-user factor).
  const everyone = size({ audiences: { includeGroups: [['__all__']] } }).share;
  const cache = new Map<string, number>();
  const frac = (id: string) => {
    const hit = cache.get(id);
    if (hit !== undefined) return hit;
    const s = everyone > 0 ? size({ audiences: { includeGroups: [[id]] } }).share / everyone : 0;
    const v = Math.min(1, Math.max(0, s));
    cache.set(id, v);
    return v;
  };
  const refs = audienceRefs(lists);
  const shares = evaluateShares(lists, frac);

  const p = loaded.params;
  const deviceMix = { desktop: 0, mobile: 0, tablet: 0, ctv: 0 };
  for (const f of formats) {
    const row = p.supply.deviceShare[f] ?? {};
    deviceMix.desktop += row.computer ?? 0;
    deviceMix.mobile += row.smartphone ?? 0;
    deviceMix.tablet += row.tablet ?? 0;
    deviceMix.ctv += row.ctv ?? 0;
  }
  const age = p.targeting.allocation.age;
  const gender = p.targeting.allocation.gender;
  return buildSummary({
    asOf: new Date(world.simStartMs).toISOString(),
    overall: none.requestsPerDay * input.flightDays,
    otherShare: none.share > 0 ? otherSize.share / none.share : 1,
    shares,
    hasAudience: refs.some((r) => r.side === 'INCLUDE'),
    mix: {
      gender: { male: gender.male ?? 0.5, female: gender.female ?? 0.5 },
      age: {
        '18-24': age['18-24'] ?? 0,
        '25-34': age['25-34'] ?? 0,
        '35-44': age['35-44'] ?? 0,
        '45-54': age['45-54'] ?? 0,
        '55-64': age['55-64'] ?? 0,
        '65+': age['65+'] ?? 0,
      },
      device: deviceMix,
    },
  });
}
