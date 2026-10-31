// The app-wide short date: "Oct 31, 2026" (never dd/mm/yyyy). UTC calendar date of an ISO timestamp or a Date, so the
// host time zone never moves a day. Lists that show a stored timestamp use this one.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMediumDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
