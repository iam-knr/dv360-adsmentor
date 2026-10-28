import type { LocalTime } from '../calendar';
import { neutralRateCtx, type RateCtx } from '../params/rates';
import type { Params } from '../params/schema';
import { buildTargetingPlan, type TargetingPlan } from '../supply/shares';
import type { AdvertiserEntity, AudienceEntity, LineItemEntity } from '../world';

export interface TargetingInput {
  li: LineItemEntity;
  advertiser: AdvertiserEntity;
  params: Params;
  tick: number;
  advLocal: LocalTime;
  audiences: Map<string, AudienceEntity>;
  /** Market volume index; scales the user pool for audience list shares. */
  poolScale: number;
}

export function compileTargeting(inp: TargetingInput): TargetingPlan {
  return buildTargetingPlan(
    inp.li,
    {
      params: inp.params,
      tick: inp.tick,
      advHour: inp.advLocal.hour,
      advDow: inp.advLocal.dow,
      audiences: inp.audiences,
    },
    inp.poolScale,
  );
}

/** LI-level inputs to the rate functions that come from targeting alone (6.2, 2.3, 2.4). */
export function rateCtxFromPlan(plan: TargetingPlan, inp: TargetingInput): RateCtx {
  const p = inp.params;
  const ctx = neutralRateCtx();
  ctx.audienceKind = plan.audienceKind;
  if (plan.optimizedTargeting && plan.hasProfileTargeting) {
    const e = p.targeting.optimizedExpansion;
    ctx.optimizedFactor = (1 + p.targeting.optimizedRateMult * e) / (1 + e);
  }
  if (plan.positionMix) {
    const m = p.multipliers.position;
    const mix = plan.positionMix;
    const mixed = (k: 'price' | 'ctr' | 'view') =>
      mix.above_fold * (m.above_fold?.[k] ?? 1) +
      mix.below_fold * (m.below_fold?.[k] ?? 1) +
      mix.unknown * (m.unknown?.[k] ?? 1);
    ctx.positionMult = { price: mixed('price'), ctr: mixed('ctr'), view: mixed('view') };
  }
  ctx.viewabilityMin = plan.viewabilityMin;
  ctx.vertical =
    p.multipliers.vertical[inp.advertiser.vertical] ?? p.multipliers.vertical.default ?? 1;
  const verified = plan.verificationOptions.some(
    (v) => v === 'dv_fraud' || v === 'dv_abs' || v === 'ias',
  );
  ctx.fraudVerifiedShare = verified ? 1 : 0;
  const premium = p.multipliers.audiencePremium[plan.audienceKind] ?? 1;
  const vPrem =
    plan.viewabilityMin > 0.5
      ? 1 + p.targeting.viewabilityPremiumSlope * (plan.viewabilityMin - 0.5)
      : 1;
  ctx.premiumLn = Math.log(premium) + Math.log(vPrem) + Math.log(ctx.positionMult.price);
  return ctx;
}
