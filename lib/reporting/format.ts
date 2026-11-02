// Display formats of the reporting pages (fidelity audit REP-009, REP-014, OFF-007). Pure, UTC based, so the server and
// the browser print the same text.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
};

/** `Oct 10, 2026 02:37` from an ISO instant (UTC). */
export function formatModified(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${hh}:${mm}`;
}

/** `Oct 25 – 31, 2026`, `Oct 25 – Nov 2, 2026`, `Dec 28, 2026 – Jan 3, 2027`, or `Oct 25, 2026` for one day. */
export function formatRange(from: string, to: string): string {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  if (from === to) return `${MON[fm - 1]} ${fd}, ${fy}`;
  if (fy !== ty) return `${MON[fm - 1]} ${fd}, ${fy} – ${MON[tm - 1]} ${td}, ${ty}`;
  if (fm !== tm) return `${MON[fm - 1]} ${fd} – ${MON[tm - 1]} ${td}, ${ty}`;
  return `${MON[fm - 1]} ${fd} – ${td}, ${fy}`;
}

/** `Oct 25, 2026` from `YYYY-MM-DD`. */
export function formatDay(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${MON[m - 1]} ${d}, ${y}`;
}

/** `Last 7 days : Oct 25, 2026 - Oct 31, 2026` (offline builder). */
export function formatOfflineRange(label: string, from: string, to: string): string {
  return `${label} : ${formatDay(from)} - ${formatDay(to)}`;
}

/** `MM/DD/YYYY` from `YYYY-MM-DD` (offline schedule block). */
export function toUs(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
}
/** `YYYY-MM-DD` from `MM/DD/YYYY`; empty or invalid text gives the input back unchanged. */
export function fromUs(text: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return text;
  return `${m[3]}-${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}

/** Offline schedule time zones, labelled as in the classic form. */
export const OFFLINE_ZONES: { value: string; label: string }[] = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (GMT-08:00)' },
  { value: 'America/New_York', label: 'Eastern Time (GMT-05:00)' },
  { value: 'UTC', label: 'UTC (GMT+00:00)' },
  { value: 'Europe/London', label: 'London (GMT+00:00)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (GMT+05:30)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+08:00)' },
];
export const zoneLabel = (tz: string) => OFFLINE_ZONES.find((z) => z.value === tz)?.label ?? tz;
