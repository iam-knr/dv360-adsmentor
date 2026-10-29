// Pure rules of the third-party verification options (TGT-091 to TGT-093, RC-055). The editor only renders them.
import { ABS_REPLACES, VERIFICATION_OPTIONS, verificationCost } from '@/lib/targeting/verification';
import type { TargetingCriteria, VerificationProvider } from '@/lib/targeting/types';

export const BRAND_MESSAGES = {
  TGT_090: 'Choose a verification provider.',
  TGT_091: 'Authentic Brand Safety replaces standard brand safety and fraud and invalid traffic.',
  TGT_092: 'Turn on this verification service in Advertiser settings first.',
} as const;

export const ABS_KEY = 'authentic-brand-safety';

type Brand = NonNullable<TargetingCriteria['brandSuitability']>;

/** Option keys the provider offers. */
export function optionKeys(provider: VerificationProvider): string[] {
  return provider === 'NONE' ? [] : VERIFICATION_OPTIONS[provider].map((o) => o.key);
}

/** Options that cannot be ticked now: with ABS on, standard brand safety and fraud/IVT are disabled (TGT-091). */
export function disabledOptions(
  provider: VerificationProvider,
  selected: readonly string[],
): string[] {
  return provider === 'DOUBLEVERIFY' && selected.includes(ABS_KEY) ? [...ABS_REPLACES] : [];
}

/** Ticking ABS clears the options it replaces; unticking any option just removes it. */
export function toggleOption(
  provider: VerificationProvider,
  selected: readonly string[],
  key: string,
  on: boolean,
): string[] {
  if (!optionKeys(provider).includes(key)) return [...selected];
  if (!on) return selected.filter((k) => k !== key);
  if (selected.includes(key)) return [...selected];
  const next = [...selected, key];
  return provider === 'DOUBLEVERIFY' && key === ABS_KEY
    ? next.filter((k) => !ABS_REPLACES.includes(k))
    : next;
}

/** Changing the provider drops options the new provider does not offer. */
export function setProvider(b: Brand, provider: VerificationProvider): Brand {
  const keys = optionKeys(provider);
  return {
    ...b,
    thirdParty: { provider, options: b.thirdParty.options.filter((k) => keys.includes(k)) },
  };
}

export const totalCost = verificationCost;

/** "Total cost: ~₹20.95 CPM" */
export function totalCostText(
  provider: VerificationProvider,
  options: readonly string[],
  symbol = '₹',
): string {
  return `Total cost: ~${symbol}${verificationCost(provider, options).toFixed(2)} CPM`;
}

/** Error that blocks Apply: TGT-091 and TGT-092. `enabled` absent = every service is on. */
export function brandError(
  b: Brand | undefined,
  enabled: readonly VerificationProvider[] | undefined,
): string | null {
  if (!b) return null;
  const { provider, options } = b.thirdParty;
  if (
    provider === 'DOUBLEVERIFY' &&
    options.includes(ABS_KEY) &&
    options.some((k) => ABS_REPLACES.includes(k))
  )
    return BRAND_MESSAGES.TGT_091;
  if (provider !== 'NONE' && enabled && !enabled.includes(provider)) return BRAND_MESSAGES.TGT_092;
  return null;
}
