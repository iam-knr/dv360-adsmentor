// Registry of field registries, one per EntityType. Entity sessions add their file and one line here
// (campaign, IO, LI in their module sessions). A missing registry makes withChangeLog throw, never skip.
import type { EntityType } from '@prisma/client';
import type { EntityRegistry } from '../registry-types';
import { advertiserRegistry } from './advertiser';
import { campaignRegistry } from './campaign';
import { insertionOrderRegistry } from './insertion-order';
import { lineItemRegistry } from './line-item';
import {
  channelRegistry,
  floodlightActivityRegistry,
  floodlightGroupRegistry,
  keywordListRegistry,
  locationListRegistry,
} from './resources';
import { partnerRegistry } from './partner';

export const REGISTRIES: Partial<Record<EntityType, EntityRegistry>> = {
  ADVERTISER: advertiserRegistry,
  CAMPAIGN: campaignRegistry,
  INSERTION_ORDER: insertionOrderRegistry,
  LINE_ITEM: lineItemRegistry,
  CHANNEL: channelRegistry,
  KEYWORD_LIST: keywordListRegistry,
  LOCATION_LIST: locationListRegistry,
  FLOODLIGHT_GROUP: floodlightGroupRegistry,
  FLOODLIGHT_ACTIVITY: floodlightActivityRegistry,
  PARTNER: partnerRegistry,
};

export class MissingRegistryError extends Error {
  constructor(readonly entityType: EntityType) {
    super(
      `No change log registry for ${entityType}. Add lib/changelog/registries/<entity>.ts and list it in registries/index.ts.`,
    );
    this.name = 'MissingRegistryError';
  }
}

export function getRegistry(type: EntityType): EntityRegistry {
  const reg = REGISTRIES[type];
  if (!reg) throw new MissingRegistryError(type);
  return reg;
}
