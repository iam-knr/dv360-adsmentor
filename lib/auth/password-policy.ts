// Password policy ACC-010 to ACC-012 (module 19 4.4). Pure and client safe: the form's strength meter and the
// server call the same function, so the rule lives in one place.
import { isCommonPassword } from './common-passwords';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordIssueCode = 'ACC-010' | 'ACC-011' | 'ACC-012';

export interface PasswordIssue {
  code: PasswordIssueCode;
  message: string;
}

export interface PasswordCheck {
  ok: boolean;
  issues: PasswordIssue[];
}

export interface PasswordCheckOptions {
  email?: string;
  /** Raised by the Super admin in settings; never below 10. */
  minLength?: number;
}

export const PASSWORD_MESSAGES = {
  short: (min: number) => `Use at least ${min} characters.`,
  long: `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`,
  classes: 'Use at least 3 of: lowercase, uppercase, number, symbol.',
  weak: 'Choose a password that is harder to guess.',
} as const;

export function characterClasses(password: string): number {
  let n = 0;
  if (/[a-z]/.test(password)) n++;
  if (/[A-Z]/.test(password)) n++;
  if (/[0-9]/.test(password)) n++;
  if (/[^A-Za-z0-9]/.test(password)) n++;
  return n;
}

export function checkPassword(password: string, options: PasswordCheckOptions = {}): PasswordCheck {
  const min = Math.max(MIN_PASSWORD_LENGTH, options.minLength ?? MIN_PASSWORD_LENGTH);
  const issues: PasswordIssue[] = [];
  const chars = [...password].length;

  if (chars < min) issues.push({ code: 'ACC-010', message: PASSWORD_MESSAGES.short(min) });
  else if (chars > MAX_PASSWORD_LENGTH)
    issues.push({ code: 'ACC-010', message: PASSWORD_MESSAGES.long });

  if (characterClasses(password) < 3)
    issues.push({ code: 'ACC-011', message: PASSWORD_MESSAGES.classes });

  const lower = password.toLowerCase();
  const email = options.email?.trim().toLowerCase();
  let weak = isCommonPassword(password);
  if (email) {
    const local = email.split('@')[0] ?? '';
    if (lower === email) weak = true;
    if (local.length >= 4 && lower.includes(local)) weak = true;
  }
  if (weak) issues.push({ code: 'ACC-012', message: PASSWORD_MESSAGES.weak });

  return { ok: issues.length === 0, issues };
}

export type PasswordStrength = 'weak' | 'fair' | 'strong';

/** For the strength meter. "strong" means it passes the policy and is at least 14 characters. */
export function passwordStrength(
  password: string,
  options: PasswordCheckOptions = {},
): PasswordStrength {
  const check = checkPassword(password, options);
  if (!check.ok) return 'weak';
  return [...password].length >= 14 ? 'strong' : 'fair';
}
