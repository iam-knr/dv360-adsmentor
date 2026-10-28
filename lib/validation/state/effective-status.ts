// Serving formula and COMPLETED derivation (validation.md 4.0). Pure; "today" is passed in.
import type { EntityStatus } from '../types';

export type EffectiveStatus = EntityStatus | 'COMPLETED';

/**
 * `COMPLETED` is never written by users. It is derived when the entity is `ACTIVE` and its flight
 * (last budget segment end, or end date) is in the past.
 */
export function effectiveStatus(
  entity: { status: EntityStatus; flightEnd: string | null },
  today: string,
): EffectiveStatus {
  if (entity.status === 'ACTIVE' && entity.flightEnd !== null && entity.flightEnd < today)
    return 'COMPLETED';
  return entity.status;
}

export interface ServingChain {
  advertiserActive: boolean;
  campaignStatus: EntityStatus;
  ioStatus: EntityStatus;
  liStatus: EntityStatus;
  /** Line item flight; null means open ended. */
  flight: { start: string | null; end: string | null };
  budgetRemaining: boolean;
  servableCreativeOrAd: boolean;
}

/**
 * `serving(li) = advertiser.ACTIVE and campaign.ACTIVE and io.ACTIVE and li.ACTIVE and now in flight
 *  and budgetRemaining and servableCreativeOrAd`. A parent that is not serving stops its children
 * without changing their stored status.
 */
export function isServing(chain: ServingChain, today: string): boolean {
  const inFlight =
    (chain.flight.start === null || chain.flight.start <= today) &&
    (chain.flight.end === null || chain.flight.end >= today);
  return (
    chain.advertiserActive &&
    chain.campaignStatus === 'ACTIVE' &&
    chain.ioStatus === 'ACTIVE' &&
    chain.liStatus === 'ACTIVE' &&
    inFlight &&
    chain.budgetRemaining &&
    chain.servableCreativeOrAd
  );
}
