// Plan rows inherit the plan's dates and location unless the row was changed on its own (DV360 line items follow the plan
// header until overridden). The store keeps explicit values per row, so "not overridden" means "equal to the plan value
// before the edit": such a row moves with the plan; a row that differs keeps what the student set.

export interface PlanScopeValues {
  start: string;
  end: string;
  location: string;
}

export interface InheritingRow {
  startDate: string;
  endDate: string;
  locations: string[];
}

const sameLocations = (r: string[], loc: string): boolean => r.length === 1 && r[0] === loc;

/** The new dates and locations of one row after the plan header went from `from` to `to`. */
export function inheritRow(
  r: InheritingRow,
  from: PlanScopeValues,
  to: PlanScopeValues,
): InheritingRow {
  return {
    startDate: r.startDate === from.start ? to.start : r.startDate,
    endDate: r.endDate === from.end ? to.end : r.endDate,
    locations: sameLocations(r.locations, from.location) ? [to.location] : r.locations,
  };
}

/** Same for a list of rows; other fields are kept. Returns the input rows when nothing moved. */
export function inheritRows<R extends InheritingRow>(
  rows: R[],
  from: PlanScopeValues,
  to: PlanScopeValues,
): R[] {
  if (from.start === to.start && from.end === to.end && from.location === to.location) return rows;
  return rows.map((r) => ({ ...r, ...inheritRow(r, from, to) }));
}
