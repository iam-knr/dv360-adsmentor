// Seed templates and size knobs (data-model 3.2 and 3.4).

export const TEMPLATE_KEYS = ['starter-agency', 'healthy', 'troubleshooting-lab'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Delivery stories of module 08 3.4 plus the pacing and alert cases of module 01 3.3 and engine 3.7. */
export const PLANTED_PROBLEMS = [
  'healthy',
  'bid-too-low',
  'targeting-too-narrow',
  'creative-disapproved-exchange',
  'creative-size-mismatch',
  'budget-exhausted',
  'frequency-cap-too-tight',
  'paused-li',
  'li-under-paused-io',
  'li-no-creatives',
  'li-future-flight',
  'io-underpacing',
  'io-overpacing',
  'io-underperforming',
  'io-conflicting-settings',
  'audience-too-small',
] as const;
export type PlantedProblem = (typeof PLANTED_PROBLEMS)[number];

/** The eleven stories of module 08 3.4. */
export const DELIVERY_STORIES: readonly PlantedProblem[] = PLANTED_PROBLEMS.slice(0, 11);

export interface SeedKnobs {
  advertisers: number;
  campaignsPerAdvertiser: number;
  iosPerCampaign: number;
  lineItemsPerIo: number;
  creativesPerAdvertiser: number;
  /** Days of SimDailyMetric totals before "today". */
  historyDays: number;
  /** Days (the most recent ones) that also get device and exchange slices. Storage guard, see lib/seed/README.md. */
  sliceDays: number;
  /** Days of SimHourlyMetric totals (RC-024 caps this at 14). */
  hourlyDays: number;
  plantedProblems: PlantedProblem[];
}

const LAYOUT = {
  advertisers: 2,
  campaignsPerAdvertiser: 3,
  iosPerCampaign: 2,
  lineItemsPerIo: 3,
  creativesPerAdvertiser: 15,
  historyDays: 90,
  sliceDays: 14,
  hourlyDays: 14,
} as const;

export const TEMPLATE_DEFAULTS: Record<TemplateKey, SeedKnobs> = {
  'starter-agency': {
    ...LAYOUT,
    plantedProblems: [...DELIVERY_STORIES, 'io-underpacing', 'io-overpacing', 'io-underperforming'],
  },
  // Same world, no planted problems (module 01 3.3: the `healthy` variant shows the empty states).
  healthy: { ...LAYOUT, plantedProblems: ['healthy'] },
  'troubleshooting-lab': { ...LAYOUT, plantedProblems: [...PLANTED_PROBLEMS] },
};

export const KNOB_LIMITS = {
  advertisers: [1, 4],
  campaignsPerAdvertiser: [1, 8],
  iosPerCampaign: [1, 4],
  lineItemsPerIo: [1, 6],
  creativesPerAdvertiser: [4, 60],
  historyDays: [0, 180],
  sliceDays: [0, 180],
  hourlyDays: [0, 14],
} as const satisfies Record<string, readonly [number, number]>;

export class KnobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnobError';
  }
}

export function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

/** Template defaults with overrides applied and validated. Throws KnobError for out of range or unknown values. */
export function resolveKnobs(template: TemplateKey, overrides: Partial<SeedKnobs> = {}): SeedKnobs {
  if (!isTemplateKey(template)) throw new KnobError(`Unknown seed template "${String(template)}"`);
  const knobs: SeedKnobs = {
    ...TEMPLATE_DEFAULTS[template],
    plantedProblems: [...TEMPLATE_DEFAULTS[template].plantedProblems],
  };
  for (const key of Object.keys(KNOB_LIMITS) as (keyof typeof KNOB_LIMITS)[]) {
    const value = overrides[key];
    if (value === undefined) continue;
    const [min, max] = KNOB_LIMITS[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new KnobError(
        `Knob ${key} must be an integer from ${min} to ${max}, got ${String(value)}`,
      );
    }
    knobs[key] = value;
  }
  if (overrides.plantedProblems !== undefined) {
    const bad = overrides.plantedProblems.filter(
      (p) => !(PLANTED_PROBLEMS as readonly string[]).includes(p),
    );
    if (bad.length > 0) throw new KnobError(`Unknown planted problem: ${bad.join(', ')}`);
    knobs.plantedProblems = [...new Set(overrides.plantedProblems)];
  }
  if (knobs.sliceDays > knobs.historyDays) knobs.sliceDays = knobs.historyDays;
  if (knobs.hourlyDays > knobs.historyDays) knobs.hourlyDays = knobs.historyDays;
  return knobs;
}
