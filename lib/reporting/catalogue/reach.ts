// Unique Reach family (module 16 4.2). Reach is not additive: it reads SimReachSnapshot or the negative binomial
// formula (engine 9.5). Overlap and frequency-pivot categories are ZERO stubs in v1 (documented deviation).
import { currencyTriplet, ratio, reach, sliceDim, zeroDim, zeroMetric } from './generators';
import type { ReportFieldDef } from './types';

const UR = 'Unique Reach' as const;
export const HOUSEHOLD_FACTOR = 0.42;

export function uniqueReachFields(): ReportFieldDef[] {
  const cpu = (label: string, reachKey: string) =>
    currencyTriplet(UR, label, (_c, suffix) => ({
      t: 'RATIO',
      num: `total_media_cost_${suffix}`,
      den: reachKey,
      scale: 1,
    }));
  return [
    reach(UR, 'Impression Reach', 'impressionReach'),
    reach(UR, 'Impression Reach (Co-Viewed)', 'coViewedReach'),
    reach(UR, 'Average Impression Frequency', 'avgFrequency'),
    {
      ...reach(UR, 'Average Impression Frequency (Co-Viewed)', 'avgFrequency'),
      source: {
        t: 'RATIO',
        num: 'impressions_co_viewed',
        den: 'impression_reach_co_viewed',
        scale: 1,
      },
    },
    {
      ...reach(UR, 'Average Viewable Impression Frequency', 'avgFrequency'),
      source: {
        t: 'RATIO',
        num: 'viewable_impressions',
        den: 'viewable_impression_reach',
        scale: 1,
      },
    },
    reach(UR, 'Click Reach', 'clickReach'),
    reach(UR, 'Viewable Impression Reach', 'viewableReach'),
    ...cpu('Cost per Unique Impression Reach', 'impression_reach'),
    ...cpu('Cost per Unique Impression Reach (Co-Viewed)', 'impression_reach_co_viewed'),
    ...cpu('Cost per Unique Click Reach', 'click_reach'),
    ...cpu('Cost per Unique Viewable Reach', 'viewable_impression_reach'),
    {
      ...ratio(UR, 'Average Click Frequency', 'clicks', 'click_reach', 1),
    },
    ratio(
      UR,
      'Viewable Impression Reach Rate',
      'viewable_impression_reach',
      'impression_reach',
      100,
    ),
    ratio(UR, 'Co-Viewed Reach Rate', 'impression_reach_co_viewed', 'impression_reach', 100),
    zeroMetric(UR, 'Added Impression Reach From Frequency Cap'),
    zeroMetric(UR, 'Added Unique Impression Reach From Digital TV Deduplication'),
    zeroMetric(UR, 'Added Unique Impression Reach From Linear TV Deduplication'),
    zeroMetric(UR, 'Programmatic Guaranteed Added Unique Reach'),
  ];
}

const URA = 'Unique Reach Audience' as const;
export function uniqueReachAudienceFields(): ReportFieldDef[] {
  return [
    sliceDim(URA, 'Unique Reach Audience List', 'audience', 'name'),
    sliceDim(URA, 'Unique Reach Audience List ID', 'audience', 'id', 'ID'),
    reach(URA, 'Audience Impression Reach', 'impressionReach'),
    reach(URA, 'Audience Average Impression Frequency', 'avgFrequency'),
  ];
}

const UHR = 'Unique Household Reach' as const;
export function uniqueHouseholdReachFields(): ReportFieldDef[] {
  const f = { factor: HOUSEHOLD_FACTOR };
  return [
    reach(UHR, 'Unique Household Reach (Impression)', 'impressionReach', f),
    {
      ...reach(UHR, 'Average Household Frequency', 'avgFrequency'),
      source: {
        t: 'RATIO',
        num: 'impressions',
        den: 'unique_household_reach_impression',
        scale: 1,
      },
    },
    reach(UHR, 'Unique Household Reach (Click)', 'clickReach', f),
    reach(UHR, 'Unique Household Reach (Viewable)', 'viewableReach', f),
    reach(UHR, 'Unique Household Reach (Co-Viewed)', 'coViewedReach', f),
    {
      ...reach(UHR, 'Average Household Frequency (Co-Viewed)', 'avgFrequency'),
      source: {
        t: 'RATIO',
        num: 'impressions_co_viewed',
        den: 'unique_household_reach_co_viewed',
        scale: 1,
      },
    },
    ratio(
      UHR,
      'Household Reach Rate',
      'unique_household_reach_impression',
      'impression_reach',
      100,
    ),
    ...currencyTriplet(UHR, 'Cost per Unique Household Reach', (_c, suffix) => ({
      t: 'RATIO',
      num: `total_media_cost_${suffix}`,
      den: 'unique_household_reach_impression',
      scale: 1,
    })),
  ];
}

export function overlapFields(): {
  overlap: ReportFieldDef[];
  overlapPivoted: ReportFieldDef[];
  frequencyPivoted: ReportFieldDef[];
} {
  const O = 'Unique Reach Overlap' as const;
  const OP = 'Unique Reach Overlap (pivoted)' as const;
  const FP = 'Unique Reach by Frequency (pivoted)' as const;
  return {
    overlap: [
      zeroDim(O, 'Overlap Group'),
      zeroMetric(O, 'Overlap Impression Reach'),
      zeroMetric(O, 'Overlap Percentage', 'PERCENT'),
      zeroMetric(O, 'Exclusive Impression Reach'),
      zeroMetric(O, 'Combined Impression Reach'),
      zeroMetric(O, 'Overlap Average Frequency', 'DECIMAL'),
    ],
    overlapPivoted: [
      zeroDim(OP, 'Overlap Pivot Group'),
      zeroMetric(OP, 'Overlap Pivot Reach'),
      zeroMetric(OP, 'Overlap Pivot Percentage', 'PERCENT'),
      zeroMetric(OP, 'Overlap Pivot Exclusive Reach'),
    ],
    frequencyPivoted: [
      zeroDim(FP, 'Frequency Bucket'),
      zeroMetric(FP, 'Reach at Frequency'),
      zeroMetric(FP, 'Cumulative Reach at Frequency'),
      zeroMetric(FP, 'Impressions at Frequency'),
    ],
  };
}
