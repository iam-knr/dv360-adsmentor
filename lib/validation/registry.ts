// RULES by EntityKind. Asserts unique IDs and complete metadata (validation.md 6.2).
import { abTestRules, liftStudyRules } from './rules/experiments';
import { adGroupRules } from './rules/ad-group';
import { adRules } from './rules/ad';
import { advertiserRules } from './rules/advertiser';
import { audienceRules } from './rules/audience';
import { bulkRules } from './rules/bulk';
import { campaignRules } from './rules/campaign';
import { creativeRules } from './rules/creative';
import { genRules } from './rules/gen';
import { insertionOrderRules } from './rules/io';
import { inventoryRules } from './rules/inventory';
import { liAppRules } from './rules/li-app';
import { liAudioRules } from './rules/li-audio';
import { liCtvRules } from './rules/li-ctv';
import { liDemandGenRules } from './rules/li-demand-gen';
import { liDisplayRules } from './rules/li-display';
import { liDoohRules } from './rules/li-dooh';
import { liVideoRules } from './rules/li-video';
import { liYoutubeRules } from './rules/li-youtube';
import { lineItemRules } from './rules/line-item';
import { planRules, reportRules, userRules } from './rules/misc';
import { partnerRules } from './rules/partner';
import {
  channelRules,
  customBiddingRules,
  floodlightRules,
  keywordListRules,
  locationListRules,
} from './rules/resources';
import { targetingRules } from './rules/targeting';
import { templateRules } from './rules/template';
import type { AnyRule, EntityKind } from './types';

const ID_FORMAT = /^[A-Z]+(-[A-Z]+)?-\d{3}$/;

const lineItemAll: readonly AnyRule[] = [
  ...lineItemRules,
  ...liDisplayRules,
  ...liVideoRules,
  ...liCtvRules,
  ...liAudioRules,
  ...liAppRules,
  ...liDoohRules,
  ...liDemandGenRules,
  ...liYoutubeRules,
];

/** Rules by kind. Kinds whose domain is built later are empty arrays so the registry compiles (build-plan 4.4). */
export const RULES: Record<EntityKind, readonly AnyRule[]> = {
  generic: genRules,
  partner: partnerRules,
  advertiser: advertiserRules,
  campaign: campaignRules,
  insertionOrder: insertionOrderRules,
  lineItem: [...lineItemAll, ...targetingRules],
  adGroup: adGroupRules,
  ad: adRules,
  targetingTemplate: templateRules,
  creative: creativeRules,
  audience: audienceRules,
  instantDeal: inventoryRules,
  deal: [],
  dealGroup: [],
  channel: channelRules,
  keywordList: keywordListRules,
  locationList: locationListRules,
  floodlightGroup: floodlightRules,
  floodlightConversion: [],
  customBidding: customBiddingRules,
  abTest: abTestRules,
  liftStudy: liftStudyRules,
  plan: planRules,
  report: reportRules,
  user: userRules,
  sdfUpload: bulkRules,
};

/** Form field order per kind, used to order issues of equal severity (6.4 rule 6). */
export const PATH_ORDER: Partial<Record<EntityKind, readonly string[]>> = {
  campaign: [
    'name',
    'status',
    'goal',
    'kpi',
    'creativeTypes',
    'plannedSpend',
    'startDate',
    'endDate',
    'frequencyCap',
    'budgets',
    'landingPageUrls',
    'keywords',
  ],
  insertionOrder: [
    'type',
    'objective',
    'name',
    'status',
    'budget.type',
    'budget.segments',
    'pacing',
    'kpi',
    'optimization',
    'frequencyCap',
    'partnerCosts',
    'integrationCode',
    'lineItems',
  ],
  lineItem: [
    'ioId',
    'type',
    'name',
    'status',
    'app',
    'adType',
    'inventory',
    'targeting',
    'flight',
    'budget',
    'pacing',
    'bid',
    'frequencyCap',
    'creatives',
    'conversions',
    'euPoliticalAds',
    'revenueModel',
    'partnerCosts',
    'integrationCode',
    'ads',
  ],
};

/** All rules in one flat list, with the checks of 6.2: unique IDs, ID format, complete metadata. */
export function allRules(): readonly AnyRule[] {
  return Object.values(RULES).flat();
}

export function assertRegistry(): void {
  const seen = new Set<string>();
  for (const [kind, rules] of Object.entries(RULES)) {
    for (const rule of rules) {
      if (!ID_FORMAT.test(rule.id)) throw new Error(`Rule id ${rule.id} does not match ${String(ID_FORMAT)}`);
      if (seen.has(rule.id)) throw new Error(`Duplicate rule id ${rule.id}`);
      seen.add(rule.id);
      if (rule.kind !== kind) {
        throw new Error(`Rule ${rule.id} has kind ${rule.kind} but is registered under ${kind}`);
      }
      if (rule.reads.length === 0 && rule.message !== null) {
        throw new Error(`Rule ${rule.id} needs a non-empty reads list`);
      }
    }
  }
}

assertRegistry();

export function findRule(id: string): AnyRule | undefined {
  return allRules().find((r) => r.id === id);
}
