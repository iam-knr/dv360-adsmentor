// Allow-list of real vendor names (RC-055, ADR-042). Seeded names must be synthetic or listed in data/reference/vendors.json.
import vendors from '../../data/reference/vendors.json';

export interface VendorAllowList {
  exchanges: readonly string[];
  verifiers: readonly string[];
  feeVendors: readonly string[];
  viewabilityVendors: readonly string[];
  brandSafetyVendors: readonly string[];
  adServers: readonly string[];
  extraNames: readonly string[];
}

export const VENDOR_ALLOW_LIST: VendorAllowList = vendors;

export function allowedVendorNames(list: VendorAllowList = VENDOR_ALLOW_LIST): Set<string> {
  return new Set([
    ...list.exchanges,
    ...list.verifiers,
    ...list.feeVendors,
    ...list.viewabilityVendors,
    ...list.brandSafetyVendors,
    ...list.adServers,
    ...list.extraNames,
  ]);
}

export class VendorNotAllowedError extends Error {
  constructor(readonly names: string[]) {
    super(`Vendor names not in data/reference/vendors.json: ${names.join(', ')}`);
    this.name = 'VendorNotAllowedError';
  }
}

/** Throws when a real vendor name is used that is not on the allow-list (RC-055). */
export function assertVendorsAllowed(
  names: readonly string[],
  list: VendorAllowList = VENDOR_ALLOW_LIST,
): void {
  const allowed = allowedVendorNames(list);
  const bad = names.filter((n) => !allowed.has(n));
  if (bad.length > 0) throw new VendorNotAllowedError([...new Set(bad)]);
}
