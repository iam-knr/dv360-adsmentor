// Field registry types (module 05 4.1). One registry per EntityType; the diff engine reads only these.
import type { EntityType } from '@prisma/client';
import type { Tx } from '@/lib/db';

export type FieldKind = 'scalar' | 'enum' | 'bool' | 'money' | 'date' | 'text' | 'json' | 'list';

export type Image = Record<string, unknown>;

export interface FmtCtx {
  /** Decimal places for money fields (currency scale). Default 2. */
  moneyScale?: number;
}

export interface FieldDef {
  /** Key in the entity image. For plain columns this is the Prisma column name. */
  path: string;
  /** Label at write time, e.g. "Pacing type". */
  label: string;
  kind: FieldKind;
  /** true: never logged (updatedAt, version, derived caches, engine counters). */
  ignore?: boolean;
  /** Read-time formatter for canonical values (renderers only; the log stores canonical strings). */
  format?: (canonical: string | null, ctx: FmtCtx) => string;
  /** Lists only. Stable key of one element. Default: String(element.id). */
  elementKey?: (el: Image) => string;
  /** Lists only. Label of one element, e.g. "Budget segment 2". */
  elementLabel?: (el: Image) => string;
  /** Lists only. Singular noun for summaries, e.g. "ad exchange". */
  elementNoun?: string;
  /** Lists only. Plural noun when "s" is wrong. */
  elementNounPlural?: string;
  /** Lists only. Fields compared inside one element. An element with no childFields is only logged when added or removed. */
  childFields?: FieldDef[];
}

export interface EntityRegistry {
  entityType: EntityType;
  /** Prisma model name, e.g. "Advertiser". Used for the row lock and the default loader. */
  model: string;
  /** Singular lower case noun for summaries: "insertion order", "line item". */
  noun: string;
  /** Written to ChangeGroup.schemaVersion. Bump when labels or paths change. */
  version: number;
  /** Prisma `include` used by the default loader so list fields are part of the image. */
  include?: Record<string, unknown>;
  fields: FieldDef[];
  /** Custom loader. Return null when the row does not exist. */
  load?: (tx: Tx, id: string) => Promise<Image | null>;
}

export const MAX_CREATE_ENTRIES = 60;
