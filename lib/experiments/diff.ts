// Difference algorithm of the Settings panel (module 17 4.4). Pure: flat setting maps in, rows out. Several line items
// on one side are paired greedily by the smallest number of differing settings, ties by name.
export type Settings = Record<string, string>;

export interface DiffEntity {
  name: string;
  settings: Settings;
}

export interface DiffRow {
  setting: string;
  control: string;
  variant: string;
}

const countDiff = (a: Settings, b: Settings): number => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let n = 0;
  for (const k of keys) if ((a[k] ?? '-') !== (b[k] ?? '-')) n++;
  return n;
};

/** Pair control and variant entities: smallest difference first, then by control name, then variant name. */
export function pairEntities(control: DiffEntity[], variant: DiffEntity[]): [DiffEntity | null, DiffEntity | null][] {
  const cands: { c: number; v: number; d: number }[] = [];
  control.forEach((c, ci) =>
    variant.forEach((v, vi) => cands.push({ c: ci, v: vi, d: countDiff(c.settings, v.settings) })),
  );
  cands.sort(
    (x, y) =>
      x.d - y.d ||
      (control[x.c] as DiffEntity).name.localeCompare((control[y.c] as DiffEntity).name) ||
      (variant[x.v] as DiffEntity).name.localeCompare((variant[y.v] as DiffEntity).name),
  );
  const usedC = new Set<number>();
  const usedV = new Set<number>();
  const out: [DiffEntity | null, DiffEntity | null][] = [];
  for (const k of cands) {
    if (usedC.has(k.c) || usedV.has(k.v)) continue;
    usedC.add(k.c);
    usedV.add(k.v);
    out.push([control[k.c] as DiffEntity, variant[k.v] as DiffEntity]);
  }
  control.forEach((c, i) => !usedC.has(i) && out.push([c, null]));
  variant.forEach((v, i) => !usedV.has(i) && out.push([null, v]));
  return out;
}

/** Rows for settings that differ. `prefix` names the entity ("Line item 1"). Equal settings are omitted. */
export function diffSettings(
  control: Settings,
  variant: Settings,
  prefix = '',
): DiffRow[] {
  const keys = [...new Set([...Object.keys(control), ...Object.keys(variant)])];
  const rows: DiffRow[] = [];
  for (const k of keys) {
    const c = control[k] ?? '-';
    const v = variant[k] ?? '-';
    if (c !== v) rows.push({ setting: prefix ? `${prefix}: ${k}` : k, control: c, variant: v });
  }
  return rows;
}

/** Full difference between two arms: arm level settings plus matched pairs of entities. */
export function diffArms(
  controlArm: DiffEntity[],
  variantArm: DiffEntity[],
  noun: string,
): DiffRow[] {
  const rows: DiffRow[] = [];
  const pairs = pairEntities(controlArm, variantArm);
  pairs.forEach(([c, v], i) => {
    const prefix = `${noun} ${i + 1}`;
    if (c && v) rows.push(...diffSettings(c.settings, v.settings, prefix));
    else if (c) rows.push({ setting: prefix, control: c.name, variant: '-' });
    else if (v) rows.push({ setting: prefix, control: '-', variant: v.name });
  });
  return rows;
}
