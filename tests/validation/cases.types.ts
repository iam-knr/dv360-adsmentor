// Table-driven case format (validation.md 6.7).
import type { CtxOverrides } from '@/lib/validation/testing/fixtures';
import type { EntityKind, LiType, ValidateOptions } from '@/lib/validation/types';

export interface Case {
  /** `T-nn` from validation.md 6.7, `V-nn-nn` from the module files, or `X-...` for a case added here. */
  id: string;
  kind: EntityKind;
  /** The valid fixture to start from. */
  base: () => unknown;
  /** Deep patch on the fixture (objects merge, arrays and scalars replace, undefined removes). */
  patch?: unknown;
  /** Overrides on the valid context. */
  ctx?: CtxOverrides;
  /** Picks the lookups of this line item type. */
  lineItemType?: LiType;
  opts?: ValidateOptions;
  /** `RULE:severity`. Infos are only checked when listed here. */
  expect: string[];
  /** Exact message of the first expected issue (for verbatim rows). */
  message?: string;
}
