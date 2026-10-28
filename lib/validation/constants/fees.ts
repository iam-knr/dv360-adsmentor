// MX-17 Partner cost fee types (validation.md 3). Real vendor names are kept as reference data (RC-055).

export const FEE_TYPES = [
  'Default',
  'Third-Party Ad Server',
  'DoubleVerify',
  'Adsafe',
  'AdXpose',
  'Vizu',
  'Aggregate Knowledge',
  'Teracent',
  'Evidon',
  'Agency Trading Desk Fee',
  'ShopLocal',
  'TrustMetrics',
  'Integral Ad Science Video',
  'MOAT Video',
  'Scope3',
  'Custom Fee 1',
  'Custom Fee 2',
  'Custom Fee 3',
  'Custom Fee 4',
  'Custom Fee 5',
] as const;
export type FeeType = (typeof FEE_TYPES)[number];

/** Media fee 1 is always the locked, invoiced DV360 fee. */
export const SYSTEM_MEDIA_FEE_LABEL = 'Automated cost - Display & Video 360 Fee';

/** Maximum CPM fees and media fees (IO-074, Q12). */
export const FEES_MAX_PER_KIND = 5;
