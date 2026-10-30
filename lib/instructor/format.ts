// Pure display helpers. Times are stored in UTC and shown in the class time zone (module 18 4.3 rule 6).
export function formatInZone(at: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(typeof at === 'string' ? new Date(at) : at);
}

export function formatWhen(at: Date | null | undefined): string {
  if (!at) return 'Never';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(at) + ' UTC';
}
