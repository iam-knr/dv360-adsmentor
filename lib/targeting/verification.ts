// Third-party verification options and indicative CPMs (module 10 2.6). DoubleVerify values from explore 07;
// IAS and Scope3 are simulator options. Pure data, shared by the TGT rules and the brand suitability editor.
import type { VerificationProvider } from './types';

export interface VerificationOption {
  key: string;
  label: string;
  cpm: number;
}

export const VERIFICATION_PROVIDERS: { id: VerificationProvider; label: string }[] = [
  { id: 'NONE', label: 'No third party verification' },
  { id: 'DOUBLEVERIFY', label: 'DoubleVerify' },
  { id: 'IAS', label: 'Integral Ad Science' },
  { id: 'SCOPE3', label: 'Scope3' },
];

export const VERIFICATION_OPTIONS: Record<
  Exclude<VerificationProvider, 'NONE'>,
  VerificationOption[]
> = {
  DOUBLEVERIFY: [
    { key: 'authentic-brand-safety', label: 'Authentic Brand Safety', cpm: 20.95 },
    { key: 'brand-safety', label: 'Brand safety', cpm: 5.71 },
    { key: 'display-viewability', label: 'Display viewability', cpm: 12.38 },
    { key: 'fraud-ivt', label: 'Fraud & invalid traffic', cpm: 5.71 },
  ],
  IAS: [
    { key: 'total-visibility', label: 'Total visibility and brand safety', cpm: 18 },
    { key: 'brand-safety', label: 'Brand safety', cpm: 6 },
    { key: 'fraud', label: 'Fraud', cpm: 5 },
  ],
  SCOPE3: [
    { key: 'brand-standards', label: 'Brand standards', cpm: 4.5 },
    { key: 'carbon-aware', label: 'Carbon-aware inventory', cpm: 3 },
  ],
};

/** Options that Authentic Brand Safety replaces (TGT-091). */
export const ABS_REPLACES = ['brand-safety', 'fraud-ivt'];

/** TGT-093: sum of the selected options' indicative CPMs, rounded to 2 decimals. */
export function verificationCost(
  provider: VerificationProvider,
  options: readonly string[],
): number {
  if (provider === 'NONE') return 0;
  const cents = VERIFICATION_OPTIONS[provider]
    .filter((o) => options.includes(o.key))
    .reduce((sum, o) => sum + Math.round(o.cpm * 100), 0);
  return cents / 100;
}
