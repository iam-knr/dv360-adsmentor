// The one map of audit action codes to plain words (admin polish S4). The audit table, its Action filter and the CSV
// export all read from here, so a code never reaches the screen raw. Pure: no server-only imports.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: 'Created account',
  ACCOUNT_UPDATED: 'Updated account',
  ACCOUNT_ROLE_CHANGED: 'Changed level',
  ACCOUNT_DISABLED: 'Disabled account',
  ACCOUNT_ENABLED: 'Enabled account',
  ACCOUNT_LOCKED: 'Account locked after failed sign-ins',
  ACCOUNT_UNLOCKED: 'Unlocked account',
  ACCOUNT_COHORT_MOVED: 'Moved to another cohort',
  ACCOUNT_OWNER_TRANSFERRED: 'Transferred ownership',
  ACCOUNT_ARCHIVED: 'Archived account',
  ACCOUNT_RESTORED: 'Restored account',
  ACCOUNT_PURGED: 'Purged account',
  ACCOUNTS_IMPORTED: 'Imported accounts',
  PASSWORD_RESET: 'Reset password',
  PASSWORD_CHANGED: 'Changed password',
  SESSIONS_REVOKED: 'Signed out all devices',
  COHORT_CREATED: 'Created cohort',
  COHORT_UPDATED: 'Updated cohort',
  COHORT_ARCHIVED: 'Archived cohort',
  POLICY_CHANGED: 'Changed account policy',
  AUTHZ_DENIED: 'Action refused',
  SANDBOX_REBUILT: 'Rebuilt sandbox',
};

/** Plain label for an action code; an unknown code is lower-cased with spaces instead of being shown raw. */
export function auditActionLabel(code: string): string {
  const known = AUDIT_ACTION_LABELS[code];
  if (known) return known;
  const words = code.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Placeholder addresses written for accounts that no longer have a real one. Never shown. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && /\.invalid$/i.test(email);
}
