// User facing auth texts. SIM-001/002 are module 18 4.10; ACC-xxx are module 19 4.9.
export const SIM_001 = 'Incorrect email or password.';
export const SIM_010 = 'Class has ended. Your work is saved.';
export const ACC_070 = 'Your account is disabled. Contact your admin.';
export const ACC_SUSPENDED =
  'Access suspended. A screenshot attempt was detected. Contact your administrator.';
export const ACC_074 = 'You were signed out because this account signed in on another device.';
export const ACC_075 = 'Your session expired. Sign in again.';
export const ACC_013 = 'The passwords do not match.';
export const ACC_014 = 'Your new password must be different from the current one.';
export const ACC_015 = 'Your current password is incorrect.';
export const ACC_024 = 'At least one active super admin is required.';
export const GENERIC_ERROR = 'Something went wrong. Try again.';

export function simLocked(minutes: number): string {
  const n = Math.max(1, Math.ceil(minutes));
  return `Too many attempts. Try again in ${n} ${n === 1 ? 'minute' : 'minutes'}.`;
}

export function formatDate(date: Date, timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}

export function formatTime(date: Date, timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

export function formatDateTime(date: Date, timeZone = 'Asia/Kolkata'): string {
  return `${formatDate(date, timeZone)}, ${formatTime(date, timeZone)}`;
}

export const acc071 = (startsAt: Date, timeZone?: string) =>
  `Your access starts on ${formatDate(startsAt, timeZone)}.`;
export const acc072 = (endedAt: Date, timeZone?: string) =>
  `Your access ended on ${formatDate(endedAt, timeZone)}. Contact your admin.`;

export type SessionEndReason = 'idle' | 'absolute' | 'revoked' | 'other-device' | 'suspended';

export function sessionEndMessage(reason: string | undefined): string {
  if (reason === 'suspended') return ACC_SUSPENDED;
  return reason === 'other-device' ? ACC_074 : ACC_075;
}
