// Age text of a bell entry (module 05 4.7), real time (Q2). Pure.
/** "5 m", "3 h", "9 d" (real time, Q2). */
export function ageLabel(publishedAt: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}
