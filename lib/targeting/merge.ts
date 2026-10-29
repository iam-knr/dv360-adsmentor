// Merge and apply (module 10 2.7, 4.1), keyword parsing (TGT-031), day & time segments (TGT-122) and the bridge
// to the LI validation input (LI-100, LI-102).
import type { LiTargetingInput } from '@/lib/validation/types';
import {
  MATRIX_TO_DM,
  type MatrixDimension,
} from '@/lib/validation/constants/targeting-availability';
import { CRITERIA_OF, rowsOf } from './dimensions';
import type { CriteriaKey, DaySegment, TargetingCriteria, TargetingState } from './types';
import { DAYS } from './options';

const lockedKeys = (locked: readonly string[]) =>
  new Set(
    locked.map((d) => CRITERIA_OF[d as MatrixDimension]).filter((k): k is CriteriaKey => !!k),
  );

/**
 * `mergeTargeting(partner, template, lineItem, advertiserRules)`: later wins per dimension; advertiser rules always
 * win and come back locked (TPL-006, TGT-150, data-model 5.8).
 */
export function mergeTargeting(
  partner: TargetingCriteria | null,
  template: TargetingCriteria | null,
  lineItem: TargetingCriteria | null,
  advertiser: { criteria: TargetingCriteria; locked: string[] } | null,
  lineItemType: string,
): TargetingState {
  const criteria: TargetingCriteria = { ...partner, ...template, ...lineItem };
  if (advertiser) {
    const keys = lockedKeys(advertiser.locked);
    for (const key of keys)
      if (advertiser.criteria[key] !== undefined)
        (criteria as Record<string, unknown>)[key] = advertiser.criteria[key];
  }
  return {
    version: 1,
    lineItemType,
    criteria,
    ...(advertiser?.locked.length ? { locked: [...advertiser.locked] } : {}),
  };
}

/** Replaces every non-locked dimension with the template's; locked rows stay (4.1, AC-10-20). */
export function applyTemplateToTargeting(
  current: TargetingState,
  template: { id: string; criteria: TargetingCriteria },
  extraLocked: readonly string[] = [],
): { state: TargetingState; templateId: string } {
  const keep = lockedKeys([...(current.locked ?? []), ...extraLocked]);
  const criteria: TargetingCriteria = {};
  for (const [key, value] of Object.entries(template.criteria))
    if (!keep.has(key as CriteriaKey)) (criteria as Record<string, unknown>)[key] = value;
  for (const key of keep)
    if (current.criteria[key] !== undefined)
      (criteria as Record<string, unknown>)[key] = current.criteria[key];
  return { state: { ...current, criteria }, templateId: template.id };
}

/** Locked matrix dimensions whose content differs between the stored and the submitted state (feeds LI-100). */
export function lockedRowsChanged(original: TargetingState, next: TargetingState): string[] {
  return (original.locked ?? []).filter((dim) => {
    const key = CRITERIA_OF[dim as MatrixDimension];
    return key
      ? JSON.stringify(original.criteria[key]) !== JSON.stringify(next.criteria[key])
      : false;
  });
}

/** The LI validation input of P3-06a, built from the card state. */
export function toLiTargetingInput(
  state: TargetingState,
  original?: TargetingState,
): LiTargetingInput & { state: TargetingState } {
  const c = state.criteria;
  const dims = rowsOf(state).flatMap((d) =>
    d === 'INVENTORY_SOURCES' ? [] : [MATRIX_TO_DM[d][0]!],
  );
  return {
    dimensions: [...new Set(dims)],
    ...(original ? { lockedRowsChanged: lockedRowsChanged(original, state) } : {}),
    ...(c.device
      ? {
          device: {
            include: c.device.types.filter((s) => s.mode === 'INCLUDE').map((s) => s.id),
            exclude: c.device.types.filter((s) => s.mode === 'EXCLUDE').map((s) => s.id),
          },
        }
      : {}),
    ...(c.environment
      ? {
          environment: {
            include: [c.environment.web && 'WEB', c.environment.app && 'APP'].filter(
              (v): v is string => !!v,
            ),
          },
        }
      : {}),
    ...(c.position
      ? {
          position: {
            onScreen: c.position.onScreen,
            inContent: [...c.position.inContent, ...c.position.native],
          },
        }
      : {}),
    ...(c.viewability ? { predictedViewability: c.viewability.predictedPct ?? 'ALL' } : {}),
    state,
  };
}

/** TGT-031: split on commas and new lines, trim, lowercase, drop empties and duplicates. */
export function parseKeywords(text: string): { keywords: string[]; raw: number } {
  const parts = text
    .split(/[,\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  return { keywords: [...new Set(parts)], raw: parts.length };
}

const toMin = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** TGT-122: overlapping or touching segments of one day are merged. `merged` is true when anything overlapped. */
export function mergeSegments(segments: DaySegment[]): { segments: DaySegment[]; merged: boolean } {
  const out: DaySegment[] = [];
  let merged = false;
  for (const day of DAYS) {
    const list = segments
      .filter((s) => s.day === day)
      .map((s) => [toMin(s.from), toMin(s.to)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const acc: [number, number][] = [];
    for (const seg of list) {
      const last = acc[acc.length - 1];
      if (last && seg[0] < last[1]) {
        merged = true;
        last[1] = Math.max(last[1], seg[1]);
      } else acc.push([...seg]);
    }
    out.push(...acc.map(([a, b]) => ({ day, from: toHhmm(a), to: toHhmm(b) })));
  }
  return { segments: out, merged };
}

export function hasOverlap(segments: DaySegment[]): boolean {
  return mergeSegments(segments).merged;
}

/** Preset schedules of the Day & time editor: whole days, 12:00 AM to 12:00 AM. */
export function presetSegments(preset: 'ALL_DAYS' | 'WEEKDAYS' | 'WEEKENDS'): DaySegment[] {
  const days =
    preset === 'ALL_DAYS' ? DAYS : preset === 'WEEKDAYS' ? DAYS.slice(0, 5) : DAYS.slice(5);
  return days.map((day) => ({ day, from: '00:00', to: '24:00' }));
}

/** Is hour `h` of `day` inside any segment (for the grid shading)? */
export function isTargeted(segments: DaySegment[], day: DaySegment['day'], h: number): boolean {
  return segments.some(
    (s) => s.day === day && toMin(s.from) <= h * 60 && toMin(s.to) >= (h + 1) * 60,
  );
}
