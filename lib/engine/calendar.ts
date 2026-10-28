// Sim-time calendar maths on plain integers. No Date objects are created without an argument,
// and nothing reads the real clock (engine.md 1.3).

export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;

export interface LocalTime {
  tick: number;
  /** Local days since 1970-01-01 in the chosen offset. */
  dayIndex: number;
  /** 0..23 */
  hour: number;
  /** 0 = Monday ... 6 = Sunday */
  dow: number;
  /** YYYY-MM-DD */
  date: string;
}

/** Local wall time of tick `tick` for a zone with a fixed UTC offset (minutes). */
export function tickToLocal(simStartMs: number, tzOffsetMin: number, tick: number): LocalTime {
  const localMs = simStartMs + tick * MS_HOUR + tzOffsetMin * 60_000;
  const dayIndex = Math.floor(localMs / MS_DAY);
  const hour = Math.floor((localMs - dayIndex * MS_DAY) / MS_HOUR);
  return { tick, dayIndex, hour, dow: (((dayIndex + 3) % 7) + 7) % 7, date: dayToIso(dayIndex) };
}

/** Days since epoch to y/m/d (Howard Hinnant's civil_from_days). */
export function civilFromDays(z0: number): { y: number; m: number; d: number } {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

export function daysFromCivil(y0: number, m: number, d: number): number {
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function dayToIso(dayIndex: number): string {
  const { y, m, d } = civilFromDays(dayIndex);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isoToDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return daysFromCivil(y as number, m as number, d as number);
}
