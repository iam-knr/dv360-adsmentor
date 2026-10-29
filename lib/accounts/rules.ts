// ACC rule texts (module 19 4.9, validation.md 2.26) and the pure checks the service shares with the forms.
export const ACC = {
  'ACC-001': 'Enter a valid email address.',
  'ACC-002': 'An account with this email already exists.',
  'ACC-002A': 'This email belongs to an archived account. Restore it instead.',
  'ACC-003': 'Enter a value',
  'ACC-003B': 'Use 100 characters or fewer.',
  'ACC-004': 'Use 500 characters or fewer.',
  'ACC-020': "You can't create accounts with this role.",
  'ACC-021': "You can't change this role.",
  'ACC-022': 'Account not found.',
  'ACC-023': "You can't do this to your own account.",
  'ACC-024': 'At least one active super admin is required.',
  'ACC-025': "Move this admin's users and cohorts to another admin first.",
  'ACC-026': 'Super admin accounts can be disabled but not deleted.',
  'ACC-030': 'Choose a cohort.',
  'ACC-031': 'Cohort not found.',
  'ACC-033': 'Enter a value',
  'ACC-033B': 'You already have a cohort with this name.',
  'ACC-034': 'Use a number from 1 to 60.',
  'ACC-060': 'Select 100 accounts or fewer.',
  'ACC-061': 'Type DELETE to confirm.',
  'ACC-063': 'Generate passwords when you reset more than 25 accounts.',
  FORBIDDEN: "You don't have access to this.",
} as const;

export type AccCode = keyof typeof ACC;

export class AccountError extends Error {
  constructor(
    readonly code: AccCode | (string & {}),
    message?: string,
  ) {
    super(message ?? (code in ACC ? ACC[code as AccCode] : String(code)));
    this.name = 'AccountError';
  }
}

export const MAX_BULK = 100;
export const MAX_SHARED_PASSWORD_BULK = 25;
export const DEFAULT_CAPACITY_CEILING = 25;
export const MAX_CAPACITY = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** ACC-001. Returns the text or null. */
export function checkEmail(email: string): string | null {
  return email.length > 0 && email.length <= 254 && EMAIL.test(email) ? null : ACC['ACC-001'];
}

/** ACC-003. */
export function checkName(name: string): string | null {
  if (!name.trim()) return ACC['ACC-003'];
  return [...name.trim()].length > 100 ? ACC['ACC-003B'] : null;
}

/** ACC-004. */
export function checkNotes(notes: string | undefined): string | null {
  return notes && [...notes].length > 500 ? ACC['ACC-004'] : null;
}

/** ACC-034. */
export function checkCapacity(n: number, isSuper: boolean): string | null {
  if (!Number.isInteger(n) || n < 1 || n > MAX_CAPACITY) return ACC['ACC-034'];
  if (n > DEFAULT_CAPACITY_CEILING && !isSuper)
    return `Only a super admin can raise the limit above ${DEFAULT_CAPACITY_CEILING}.`;
  return null;
}
