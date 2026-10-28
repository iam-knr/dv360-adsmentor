// MX-01 Campaign goal to KPI (validation.md 3). Enum keys follow RC-001.

export const CAMPAIGN_GOALS = ['AWARENESS', 'ONLINE_ACTION', 'OFFLINE_SALES', 'APP_INSTALLS'] as const;
export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const KPIS = [
  'CPM',
  'CPC',
  'CPA',
  'CTR',
  'CPV',
  'CPIAVC',
  'VIEWABLE_PCT',
  'VCPM',
  'CPCL',
  'CPCV',
  'TOS10',
  'VTR',
  'COMPL_AUDIO',
  'COMPL_VIDEO',
  'VALUE_COST',
  'CLICK_CVR',
  'IMPR_CVR',
  'OTHER',
] as const;
export type Kpi = (typeof KPIS)[number];

/** Kpi values that are shown in the campaign form (plus OTHER). */
export const CAMPAIGN_KPI_UNIVERSE = [
  'CPM',
  'CPC',
  'CPA',
  'CTR',
  'CPV',
  'CPIAVC',
  'VIEWABLE_PCT',
] as const satisfies readonly Kpi[];

export const CAMPAIGN_GOAL_LABEL: Record<CampaignGoal, string> = {
  AWARENESS: 'Raise awareness of my brand or product',
  ONLINE_ACTION: 'Drive online action or visits',
  OFFLINE_SALES: 'Drive offline or in-store sales',
  APP_INSTALLS: 'Drive app installs or engagements',
};

export const RECOMMENDED_KPIS: Record<CampaignGoal, readonly Kpi[]> = {
  AWARENESS: ['CPV', 'CPM', 'VIEWABLE_PCT', 'CPIAVC'],
  ONLINE_ACTION: ['CPM', 'CPC', 'CPA', 'CTR', 'VIEWABLE_PCT'],
  OFFLINE_SALES: ['CPV', 'CPM', 'VIEWABLE_PCT', 'CPIAVC'],
  APP_INSTALLS: ['CPM', 'CPC', 'CPA', 'CTR', 'VIEWABLE_PCT'],
};

/** `notRecommended(goal) = KPI_UNIVERSE \ recommended(goal)`. */
export function notRecommendedKpis(goal: CampaignGoal): readonly Kpi[] {
  const recommended = RECOMMENDED_KPIS[goal];
  return CAMPAIGN_KPI_UNIVERSE.filter((k) => !recommended.includes(k));
}

/** KPIs whose value is a percentage; the rest are money in minor units. */
export const MONEY_KPIS = ['CPM', 'CPC', 'CPA', 'CPV', 'CPIAVC', 'VCPM', 'CPCL', 'CPCV', 'VALUE_COST'] as const;

/** Percent KPIs checked on the campaign form (CMP-015). */
export const CAMPAIGN_PERCENT_KPIS: readonly Kpi[] = ['CTR', 'VIEWABLE_PCT'];

/** Percent KPIs checked on the insertion order form (IO-042). */
export const IO_PERCENT_KPIS: readonly Kpi[] = [
  'VTR',
  'TOS10',
  'VIEWABLE_PCT',
  'COMPL_AUDIO',
  'COMPL_VIDEO',
  'CTR',
  'CLICK_CVR',
  'IMPR_CVR',
];
