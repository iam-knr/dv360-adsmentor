// Route param parsing (routes.md 6.4). A bad id gives the 404 page; it is never looked up.
import { z } from 'zod';

/** Public ids are positive integers (data-model header). */
const PUBLIC_ID = /^[1-9]\d{0,18}$/;
/** Row ids (cuid style). Accepted so links built from a row id (the P3-02 welcome page) still resolve. */
const ROW_ID = /^c[a-z0-9]{20,32}$/;

export type IdRef = { kind: 'public'; value: bigint } | { kind: 'row'; value: string };

export const idSegment = z
  .string()
  .max(40)
  .refine((v) => PUBLIC_ID.test(v) || ROW_ID.test(v));

/** Parse one id segment. Null for anything that is not a public id or a row id. */
export function parseIdRef(value: string | undefined): IdRef | null {
  if (value === undefined || !idSegment.safeParse(value).success) return null;
  return PUBLIC_ID.test(value) ? { kind: 'public', value: BigInt(value) } : { kind: 'row', value };
}

/** Prisma `where` for an id segment. */
export function whereId(ref: IdRef): { publicId: bigint } | { id: string } {
  return ref.kind === 'public' ? { publicId: ref.value } : { id: ref.value };
}

/** A path segment that is neither empty nor a traversal, for kinds and tabs (`[kind]`, `[tid]`). */
export const slugSegment = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
