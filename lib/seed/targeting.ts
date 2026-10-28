// Targeting rows of seeded line items (module 08 3.4: 2 to 8 rows each, include and exclude, audience groups, day parting).
import type { Prisma } from '@prisma/client';
import { targetingOptionId } from './reference';
import { stableId, type Rng } from './prng';

type Row = Prisma.TargetingAssignmentCreateManyInput;

export interface TargetingContext {
  sandboxId: string;
  advertiserId: string;
  country: 'IN' | 'SG';
  /** First-party audience ids of the advertiser, large first. */
  audienceIds: string[];
  smallAudienceId: string | null;
}

export interface LiTargetingSpec {
  lineItemId: string;
  key: string;
  isDisplayLike: boolean;
  isVideoLike: boolean;
  narrow: boolean;
  verifier: boolean;
  optimized: boolean;
  smallAudience: boolean;
}

const opt = (dimension: string, code: string) => targetingOptionId(dimension, code);

export function targetingRowsForLineItem(
  spec: LiTargetingSpec,
  ctx: TargetingContext,
  rng: Rng,
): Row[] {
  const rows: Row[] = [];
  let n = 0;
  const base = {
    sandboxId: ctx.sandboxId,
    ownerType: 'LINE_ITEM' as const,
    lineItemId: spec.lineItemId,
  };
  const add = (r: Omit<Row, 'id' | 'sandboxId' | 'ownerType' | 'lineItemId'>) => {
    rows.push({ id: stableId(ctx.sandboxId, `ta:${spec.key}:${n++}`), ...base, ...r });
  };

  if (spec.narrow) {
    // One city, one tiny audience, one rare language: the "targeting too narrow" story.
    add({
      dimension: 'GEOGRAPHY',
      mode: 'INCLUDE',
      optionId: opt('GEOGRAPHY', ctx.country === 'IN' ? 'IN-GA-panaji' : 'SG-5'),
    });
    add({
      dimension: 'LANGUAGE',
      mode: 'INCLUDE',
      optionId: opt('LANGUAGE', ctx.country === 'IN' ? 'as' : 'ms'),
    });
    if (ctx.smallAudienceId) {
      add({
        dimension: 'AUDIENCE_LIST',
        mode: 'INCLUDE',
        refType: 'AUDIENCE',
        refId: ctx.smallAudienceId,
        groupIndex: 0,
        audienceSection: 'FIRST_PARTY_AND_PARTNER',
      });
    }
    add({
      dimension: 'DAY_TIME',
      mode: 'INCLUDE',
      config: { days: ['SAT', 'SUN'], fromHour: 6, toHour: 9, timeZone: 'ADVERTISER' },
    });
    return rows;
  }

  // Geography
  if (ctx.country === 'IN') {
    add({ dimension: 'GEOGRAPHY', mode: 'INCLUDE', optionId: opt('GEOGRAPHY', 'IN') });
    if (rng.chance(0.5))
      add({ dimension: 'GEOGRAPHY', mode: 'EXCLUDE', optionId: opt('GEOGRAPHY', 'IN-AS') });
  } else {
    add({ dimension: 'GEOGRAPHY', mode: 'INCLUDE', optionId: opt('GEOGRAPHY', 'SG') });
  }
  add({ dimension: 'LANGUAGE', mode: 'INCLUDE', optionId: opt('LANGUAGE', 'en') });

  const optional: (() => void)[] = [
    () =>
      add({
        dimension: 'DEVICE_TYPE',
        mode: 'INCLUDE',
        optionId: opt('DEVICE_TYPE', 'SMARTPHONE'),
      }),
    () =>
      add({
        dimension: 'DAY_TIME',
        mode: 'INCLUDE',
        config: {
          days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          fromHour: 8,
          toHour: 22,
          timeZone: 'ADVERTISER',
        },
      }),
    () => add({ dimension: 'CATEGORY', mode: 'EXCLUDE', optionId: opt('CATEGORY', 'C9') }),
    () => add({ dimension: 'BROWSER', mode: 'EXCLUDE', optionId: opt('BROWSER', 'B7') }),
    () => add({ dimension: 'ENVIRONMENT', mode: 'INCLUDE', optionId: opt('ENVIRONMENT', 'WEB') }),
    () => add({ dimension: 'AGE', mode: 'INCLUDE', optionId: opt('AGE', '25-34') }),
  ];
  if (spec.isDisplayLike)
    optional.push(() =>
      add({
        dimension: 'VIEWABILITY',
        mode: 'INCLUDE',
        optionId: opt('VIEWABILITY', 'V5'),
        config: { predictedViewabilityMin: 50 },
      }),
    );
  if (spec.isVideoLike)
    optional.push(() =>
      add({
        dimension: 'POSITION_IN_CONTENT',
        mode: 'INCLUDE',
        optionId: opt('POSITION_IN_CONTENT', 'Q1'),
      }),
    );

  // Audience groups: group 0 is an OR list, group 1 narrows it (AND between groups).
  const audiences = ctx.audienceIds;
  if (spec.smallAudience && ctx.smallAudienceId) {
    add({
      dimension: 'AUDIENCE_LIST',
      mode: 'INCLUDE',
      refType: 'AUDIENCE',
      refId: ctx.smallAudienceId,
      groupIndex: 0,
      audienceSection: 'FIRST_PARTY_AND_PARTNER',
    });
  } else if (audiences.length >= 3 && rng.chance(0.7)) {
    add({
      dimension: 'AUDIENCE_LIST',
      mode: 'INCLUDE',
      refType: 'AUDIENCE',
      refId: audiences[0],
      groupIndex: 0,
      audienceSection: 'FIRST_PARTY_AND_PARTNER',
    });
    add({
      dimension: 'AUDIENCE_LIST',
      mode: 'INCLUDE',
      refType: 'AUDIENCE',
      refId: audiences[1],
      groupIndex: 1,
      audienceSection: 'FIRST_PARTY_AND_PARTNER',
    });
    if (rng.chance(0.5))
      add({
        dimension: 'AUDIENCE_LIST',
        mode: 'EXCLUDE',
        refType: 'AUDIENCE',
        refId: audiences[2],
        groupIndex: 0,
        audienceSection: 'FIRST_PARTY_AND_PARTNER',
      });
  }

  if (spec.verifier) {
    add({
      dimension: 'THIRD_PARTY_VERIFIER',
      mode: 'INCLUDE',
      optionId: opt('THIRD_PARTY_VERIFIER', 'TV1'),
      config: { provider: 'DoubleVerify', brandSafetyLevel: 'MEDIUM' },
    });
  }
  if (spec.optimized) {
    add({ dimension: 'OPTIMIZED_TARGETING', mode: 'INCLUDE', config: { enabled: true } });
  }

  // Fill with optional rows until the line item has between 2 and 8 rows in total.
  const target = rng.int(Math.max(rows.length, 3), 8);
  const order = rng.shuffle(optional);
  for (const fn of order) {
    if (rows.length >= target) break;
    fn();
  }
  return rows.slice(0, 8);
}

/** Rows of a targeting template (owner TEMPLATE). */
export function targetingRowsForTemplate(
  templateId: string,
  key: string,
  ctx: Pick<TargetingContext, 'sandboxId' | 'country'>,
): Row[] {
  const base = { sandboxId: ctx.sandboxId, ownerType: 'TEMPLATE' as const, templateId };
  return [
    {
      id: stableId(ctx.sandboxId, `ta:${key}:0`),
      ...base,
      dimension: 'GEOGRAPHY',
      mode: 'INCLUDE',
      optionId: opt('GEOGRAPHY', ctx.country),
    },
    {
      id: stableId(ctx.sandboxId, `ta:${key}:1`),
      ...base,
      dimension: 'LANGUAGE',
      mode: 'INCLUDE',
      optionId: opt('LANGUAGE', 'en'),
    },
    {
      id: stableId(ctx.sandboxId, `ta:${key}:2`),
      ...base,
      dimension: 'DEVICE_TYPE',
      mode: 'INCLUDE',
      optionId: opt('DEVICE_TYPE', 'SMARTPHONE'),
    },
  ];
}

/** Locked advertiser rules (module 10 3.4): Maximum inventory and Open Measurement. */
export function advertiserLockedRows(advertiserId: string, key: string, sandboxId: string): Row[] {
  const base = { sandboxId, ownerType: 'ADVERTISER' as const, advertiserId, isLocked: true };
  return [
    {
      id: stableId(sandboxId, `ta:${key}:inv`),
      ...base,
      dimension: 'BRAND_SUITABILITY',
      mode: 'INCLUDE',
      config: { inventoryMode: 'MAXIMUM' },
    },
    {
      id: stableId(sandboxId, `ta:${key}:om`),
      ...base,
      dimension: 'VIEWABILITY',
      mode: 'INCLUDE',
      config: { openMeasurement: true },
    },
  ];
}
