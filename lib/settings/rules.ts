// PRT, ADV and USR rules of modules 02 and 03 (validation.md 2.2, 2.3, 2.25 plus the proposed IDs adopted by RC-053).
// Pure and synchronous, like lib/validation. They live here and not in lib/validation/rules because that registry is
// guarded by a coverage test owned by P3-06a; see the PR body (Deviations). Messages are verbatim from the specs.
import { MSG, format } from '@/lib/validation/messages';
import {
  codePointLength,
  byteLength,
  isBlank,
  isUrl,
  isWhole,
  toNum,
} from '@/lib/validation/primitives';
import type { WireIssue } from '@/lib/campaigns/wire';
import {
  BUSINESS_NAME_MAX,
  INTEGRATION_CODE_MAX,
  NAME_MAX,
  SDF_KEYS,
  type AlertKey,
} from './constants';

export type SettingsIssue = WireIssue;

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export const isEmail = (v: string): boolean => v.length <= 254 && EMAIL_RE.test(v);

const err = (code: string, path: string, message: string): SettingsIssue => ({
  path,
  severity: 'error',
  code,
  message,
});
const warn = (code: string, path: string, message: string): SettingsIssue => ({
  path,
  severity: 'warning',
  code,
  message,
});

export const SIM = {
  VALID_EMAIL: 'Enter a valid email address.',
  SDF_VERSION: 'Choose a supported SDF version.',
  EXCHANGES_NEED_WRITE: 'You need read and write access to the partner to change exchanges.',
  PRODUCT_IMPROVEMENT_LOCKED: "This setting can't be changed while Enhanced automation is on.",
  EXCHANGE_TARGETED: '{n} line items target this exchange. They will stop buying on it.',
  INSTANT_DEALS_TERMS: 'Accept the terms and conditions to use YouTube guaranteed instant deals.',
  GOOGLE_INVENTORY_OFF:
    '{n} YouTube & partners or Demand Gen line items will stop delivering for these advertisers.',
  ADV_CAP: 'This partner can have up to 50 advertisers.',
  ADV_COPY_SOURCE: 'Choose an advertiser from this partner.',
  PARTNER_WRITE: 'You need write access to the partner to create an advertiser.',
  SELECT_EU: 'Select whether this advertiser plans to serve EU political ads.',
  DEMAND_GEN_OFF: '{n} Demand Gen line items will stop delivering until this is turned back on.',
  PRODUCT_IMPROVEMENT_TERMS:
    'Product improvement can only be turned off after the data processing terms are accepted.',
  PCT_1_100: 'Enter a number between 1 and 100.',
  RATE_CARD_TERMS: 'Confirm the terms to use this rate card.',
  UNDERPACING_NEEDED: 'Turn on Underpacing to use this alert.',
  SCHEDULE_ROLE: 'Only users with write access to the advertiser can schedule it for deletion.',
  ALREADY_LINKED: 'This account is already linked.',
  CERT_PENDING: 'A request for this certificate is already pending.',
  USER_EXISTS: 'A user with this email already exists.',
  LAST_ADMIN: 'A partner needs at least one admin.',
  OWN_ACCESS: "You can't reduce your own access.",
  USR_NO_ACCESS:
    'You can give users different roles for each advertiser or partner they have access to',
  LIMITED_INVENTORY: 'This reduces the inventory available to all line items.',
} as const;

// ---------------------------------------------------------------------------------------------
// Partner (PRT)
// ---------------------------------------------------------------------------------------------

export interface PartnerContactInput {
  name?: string;
  email?: string;
  address?: string;
  phone?: string;
}

export interface PartnerDetailsInput {
  name: string;
  status: string;
  currencyCode: string;
  timeZone: string;
  nielsenCountry?: string | null;
  sdfVersion: string;
  sdfAdminEmail?: string | null;
  autoEnableNewExchanges: boolean;
  dataProtection: {
    accepted: boolean;
    contacts: Partial<Record<string, PartnerContactInput>>;
    contactPerson: string;
  };
}

export interface PartnerStored {
  currencyCode: string;
  timeZone: string;
  dataTermsAccepted: boolean;
}

export function validatePartner(
  input: PartnerDetailsInput,
  stored: PartnerStored,
): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  if (isBlank(input.name)) out.push(err('PRT-001', 'name', MSG.ENTER_VALUE));
  else if (codePointLength(input.name) > NAME_MAX)
    out.push(err('GEN-004', 'name', format(MSG.MAX_CHARS, { max: NAME_MAX })));
  if (input.status !== 'ACTIVE' && input.status !== 'PAUSED')
    out.push(err('PRT-002', 'status', MSG.CHOOSE_STATUS));
  if (input.currencyCode !== stored.currencyCode)
    out.push(err('PRT-003', 'currencyCode', MSG.LOCKED_AFTER_CREATE));
  if (input.timeZone !== stored.timeZone)
    out.push(err('PRT-003', 'timeZone', MSG.LOCKED_AFTER_CREATE));
  if (!SDF_KEYS.includes(input.sdfVersion)) out.push(err('PRT-004', 'sdfVersion', SIM.SDF_VERSION));
  if (!isBlank(input.sdfAdminEmail) && !isEmail(input.sdfAdminEmail ?? ''))
    out.push(err('PRT-005', 'sdfAdminEmail', SIM.VALID_EMAIL));
  if (stored.dataTermsAccepted && !input.dataProtection.accepted)
    out.push(err('PRT-006', 'dataProtection.accepted', MSG.LOCKED_AFTER_CREATE));
  for (const [role, c] of Object.entries(input.dataProtection.contacts))
    if (c && !isBlank(c.email) && !isEmail(c.email ?? ''))
      out.push(err('PRT-011', `dataProtection.contacts.${role}.email`, SIM.VALID_EMAIL));
  if (!Object.keys(input.dataProtection.contacts).includes(input.dataProtection.contactPerson))
    out.push(err('PRT-012', 'dataProtection.contactPerson', MSG.SELECTION_REQUIRED));
  return out;
}

export interface ExchangePick {
  exchangeId: string;
  networkId?: string | null;
  agencyId?: string | null;
  seatId?: string | null;
}
export interface ExchangeMeta {
  id: string;
  needsNetworkId: boolean;
  needsSeatId: boolean;
}

/** PRT-008: an enabled exchange with extra fields needs them filled. */
export function validateExchanges(
  picks: ExchangePick[],
  meta: Map<string, ExchangeMeta>,
): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  picks.forEach((p, i) => {
    const m = meta.get(p.exchangeId);
    if (!m) return;
    if (m.needsNetworkId) {
      if (isBlank(p.networkId))
        out.push(err('PRT-008', `enabled[${i}].networkId`, MSG.ENTER_VALUE));
      if (isBlank(p.agencyId)) out.push(err('PRT-008', `enabled[${i}].agencyId`, MSG.ENTER_VALUE));
    }
    if (m.needsSeatId && isBlank(p.seatId))
      out.push(err('PRT-008', `enabled[${i}].seatId`, MSG.ENTER_VALUE));
  });
  return out;
}

/** PRT-010 (warning): line items that still target an exchange being disabled. */
export const exchangeTargetedWarning = (n: number): SettingsIssue =>
  warn('PRT-010', 'enabled', format(SIM.EXCHANGE_TARGETED, { n }));

export interface ConfigInput {
  flags: Record<
    string,
    { enabled: boolean; scope: 'ALL_ADVERTISERS' | 'SELECTED'; advertiserIds: string[] }
  >;
}
export interface ConfigStored {
  enhancedAutomation: boolean;
  productImprovement: boolean;
  instantDealsTermsAccepted: boolean;
}

export function validateConfigurations(input: ConfigInput, stored: ConfigStored): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  const f = input.flags;
  // PRT-009: product improvement is read only while Enhanced automation is on (the stored value stays).
  if (
    f.ENHANCED_AUTOMATION?.enabled &&
    f.PRODUCT_IMPROVEMENT &&
    f.PRODUCT_IMPROVEMENT.enabled !== stored.productImprovement
  )
    out.push(err('PRT-009', 'flags.PRODUCT_IMPROVEMENT', SIM.PRODUCT_IMPROVEMENT_LOCKED));
  if (f.YOUTUBE_GUARANTEED_INSTANT_DEALS?.enabled && !stored.instantDealsTermsAccepted)
    out.push(err('PRT-013', 'flags.YOUTUBE_GUARANTEED_INSTANT_DEALS', SIM.INSTANT_DEALS_TERMS));
  for (const [key, flag] of Object.entries(f))
    if (flag.enabled && flag.scope === 'SELECTED' && flag.advertiserIds.length === 0)
      out.push(err('PRT-014', `flags.${key}`, MSG.SELECTION_REQUIRED));
  return out;
}

export const googleInventoryOffWarning = (n: number): SettingsIssue =>
  warn('PRT-015', 'flags.GOOGLE_PARTNER_INVENTORY', format(SIM.GOOGLE_INVENTORY_OFF, { n }));

// ---------------------------------------------------------------------------------------------
// Advertiser (ADV)
// ---------------------------------------------------------------------------------------------

export interface CreateAdvertiserInput {
  name: string;
  website: string;
  currencyCode: string;
  timeZone: string;
  adServer: 'THIRD_PARTY_ONLY' | 'CM360_HYBRID';
  industry?: string | null;
}

export function validateCreateAdvertiser(
  input: CreateAdvertiserInput,
  ctx: { currencies: readonly string[]; timeZones: readonly string[] },
): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  if (isBlank(input.name)) out.push(err('ADV-001', 'name', MSG.ENTER_VALUE));
  else if (codePointLength(input.name) > NAME_MAX)
    out.push(err('GEN-004', 'name', format(MSG.MAX_CHARS, { max: NAME_MAX })));
  if (isBlank(input.website)) out.push(err('ADV-002', 'website', MSG.ENTER_VALUE));
  else if (!isUrl(input.website.trim())) out.push(err('ADV-003', 'website', MSG.VALID_URL));
  if (!ctx.currencies.includes(input.currencyCode))
    out.push(err('GEN-005', 'currencyCode', MSG.SELECTION_REQUIRED));
  if (!ctx.timeZones.includes(input.timeZone))
    out.push(err('GEN-005', 'timeZone', MSG.SELECTION_REQUIRED));
  return out;
}

export interface AdvertiserDetailsInput {
  name: string;
  status: string;
  website: string;
  currencyCode: string;
  timeZone: string;
  sdfVersion: string;
  sdfAdminEmail?: string | null;
  integrationCode?: string | null;
  euPoliticalAds: 'CONTAINS_EU_POLITICAL_ADS' | 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS' | null;
  businessName?: string | null;
  productImprovement: boolean;
}

export function validateAdvertiser(
  input: AdvertiserDetailsInput,
  stored: { currencyCode: string; timeZone: string },
  ctx: { partnerDataTermsAccepted: boolean },
): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  if (isBlank(input.name)) out.push(err('ADV-001', 'name', MSG.ENTER_VALUE));
  else if (codePointLength(input.name) > NAME_MAX)
    out.push(err('GEN-004', 'name', format(MSG.MAX_CHARS, { max: NAME_MAX })));
  if (isBlank(input.website)) out.push(err('ADV-002', 'website', MSG.ENTER_VALUE));
  else if (!isUrl(input.website.trim())) out.push(err('ADV-003', 'website', MSG.VALID_URL));
  if (input.currencyCode !== stored.currencyCode)
    out.push(err('ADV-004', 'currencyCode', MSG.LOCKED_AFTER_CREATE));
  if (input.timeZone !== stored.timeZone)
    out.push(err('ADV-004', 'timeZone', MSG.LOCKED_AFTER_CREATE));
  if (input.status !== 'ACTIVE' && input.status !== 'PAUSED')
    out.push(err('ADV-005', 'status', MSG.CHOOSE_STATUS));
  if (!SDF_KEYS.includes(input.sdfVersion)) out.push(err('ADV-006', 'sdfVersion', SIM.SDF_VERSION));
  if (!isBlank(input.sdfAdminEmail) && !isEmail(input.sdfAdminEmail ?? ''))
    out.push(err('ADV-007', 'sdfAdminEmail', SIM.VALID_EMAIL));
  if (
    !isBlank(input.integrationCode) &&
    byteLength(input.integrationCode ?? '') > INTEGRATION_CODE_MAX
  )
    out.push(
      err('ADV-008', 'integrationCode', format(MSG.MAX_CHARS, { max: INTEGRATION_CODE_MAX })),
    );
  if (!input.euPoliticalAds) out.push(err('ADV-011', 'euPoliticalAds', SIM.SELECT_EU));
  if (!isBlank(input.businessName) && codePointLength(input.businessName ?? '') > BUSINESS_NAME_MAX)
    out.push(err('ADV-013', 'businessName', format(MSG.MAX_CHARS, { max: BUSINESS_NAME_MAX })));
  if (!input.productImprovement && !ctx.partnerDataTermsAccepted)
    out.push(err('ADV-014', 'productImprovement', SIM.PRODUCT_IMPROVEMENT_TERMS));
  return out;
}

export const demandGenOffWarning = (n: number): SettingsIssue =>
  warn('ADV-012', 'demandGenFloodlightOptimization', format(SIM.DEMAND_GEN_OFF, { n }));

export interface AlertPrefInput {
  enabled: boolean;
  thresholdPct?: number | string | null;
  thresholdAmount?: number | string | null;
}

export function validateAlertPrefs(prefs: Record<AlertKey, AlertPrefInput>): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  const u = prefs.UNDERPACING;
  if (u.enabled) {
    const n = toNum(u.thresholdPct);
    if (n === null || !isWhole(u.thresholdPct) || n < 1 || n > 100)
      out.push(err('ADV-015', 'UNDERPACING.thresholdPct', SIM.PCT_1_100));
  }
  const s = prefs.EXCEEDED_SPEND_THRESHOLD;
  if (s.enabled) {
    const n = toNum(s.thresholdAmount);
    if (n === null || n < 0)
      out.push(err('ADV-016', 'EXCEEDED_SPEND_THRESHOLD.thresholdAmount', MSG.NON_NEGATIVE));
  }
  if (!u.enabled)
    for (const k of ['LIMITED_AUDIENCE_SIZE', 'DEALS_OFFLINE'] as const)
      if (prefs[k].enabled) out.push(err('ADV-019', k, SIM.UNDERPACING_NEEDED));
  return out;
}

export function validateThirdParty(input: {
  iasClientId: number | string;
  rateCards: { vendorKey: string; affirmed: boolean; selected: boolean }[];
}): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  const n = toNum(input.iasClientId);
  if (n === null || !Number.isInteger(n) || n < 0)
    out.push(err('ADV-017', 'iasClientId', MSG.WHOLE_NUMBER));
  input.rateCards.forEach((r, i) => {
    if (r.selected && !r.affirmed) out.push(err('ADV-018', `rateCards[${i}]`, SIM.RATE_CARD_TERMS));
  });
  return out;
}

export function validateLink(input: { displayName: string }): SettingsIssue[] {
  return isBlank(input.displayName) ? [err('ADV-025', 'displayName', MSG.ENTER_VALUE)] : [];
}

export function validateCertificateRequest(input: {
  needsCountry: boolean;
  countryCode?: string | null;
}): SettingsIssue[] {
  return input.needsCountry && isBlank(input.countryCode)
    ? [err('ADV-027', 'countryCode', MSG.SELECTION_REQUIRED)]
    : [];
}

// ---------------------------------------------------------------------------------------------
// Users (USR)
// ---------------------------------------------------------------------------------------------

export interface UserAccessInput {
  partnerId?: string | null;
  advertiserId?: string | null;
  role?: string | null;
}

export function validateUser(input: {
  name: string;
  email: string;
  access: UserAccessInput[];
}): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  if (isBlank(input.name)) out.push(err('USR-001', 'name', MSG.ENTER_VALUE));
  if (isBlank(input.email)) out.push(err('USR-001', 'email', MSG.ENTER_VALUE));
  else if (!isEmail(input.email.trim())) out.push(err('USR-001', 'email', SIM.VALID_EMAIL));
  if (input.access.length === 0) out.push(err('USR-002', 'access', SIM.USR_NO_ACCESS));
  input.access.forEach((a, i) => {
    if (isBlank(a.role)) out.push(err('USR-003', `access[${i}].role`, MSG.SELECTION_REQUIRED));
  });
  return out;
}

export const userExists = (): SettingsIssue => err('USR-004', 'email', SIM.USER_EXISTS);
export const lastAdmin = (): SettingsIssue => err('USR-010', 'access', SIM.LAST_ADMIN);
export const ownAccess = (): SettingsIssue => err('USR-011', 'access', SIM.OWN_ACCESS);
export const advertiserCap = (): SettingsIssue => err('ADV-023', 'name', SIM.ADV_CAP);
export const alreadyLinked = (): SettingsIssue => err('ADV-026', 'externalId', SIM.ALREADY_LINKED);
export const certPending = (): SettingsIssue => err('ADV-028', 'kind', SIM.CERT_PENDING);
export const partnerWriteNeeded = (): SettingsIssue => err('ADV-021', 'name', SIM.PARTNER_WRITE);
export const copySourceInvalid = (): SettingsIssue =>
  err('ADV-022', 'copyFromAdvertiserId', SIM.ADV_COPY_SOURCE);

/** Display string of several roles of one user: "Standard, Read only" (AC-02-21). */
export function roleSummary(roles: readonly string[], label: Record<string, string>): string {
  const seen: string[] = [];
  for (const r of roles) {
    const l = label[r] ?? r;
    if (!seen.includes(l)) seen.push(l);
  }
  return seen.join(', ');
}
