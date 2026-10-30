// Entity and version detection from a header row (module 11 4.4 "Version resolution"). Pure.
import { columnsFor, ID_COLUMN, LAYOUTS } from './layouts';
import { SDF_ENTITIES, SDF_VERSIONS, type SdfEntity, type SdfVersion } from './versions';

/** The file's entity, from its identifying columns. Null when none matches. */
export function detectEntity(headers: readonly string[]): SdfEntity | null {
  const set = new Set(headers);
  const order: SdfEntity[] = ['ADS', 'AD_GROUPS', 'LINE_ITEMS', 'INSERTION_ORDERS', 'MEDIA_PRODUCTS', 'CAMPAIGNS'];
  return order.find((e) => set.has(ID_COLUMN[e])) ?? null;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** The single version whose column set equals the headers (any order). Null for mixed or unknown headers. */
export function detectVersion(entity: SdfEntity, headers: readonly string[]): SdfVersion | null {
  const matches = SDF_VERSIONS.filter((v) =>
    sameSet(
      columnsFor(entity, v).map((c) => c.name),
      headers,
    ),
  );
  // versions that share a column set (for example 10.1 and 11 for ad groups) are ambiguous: first is returned
  return matches[0] ?? null;
}

/** Headers that are not columns of the entity in this version, and required columns that are missing. */
export function headerProblems(entity: SdfEntity, version: SdfVersion, headers: readonly string[]) {
  const cols = columnsFor(entity, version);
  const names = new Set(cols.map((c) => c.name));
  return {
    unknown: headers.filter((h) => !names.has(h)),
    missingRequired: cols.filter((c) => c.required && !headers.includes(c.name)).map((c) => c.name),
  };
}

export { LAYOUTS, SDF_ENTITIES };
