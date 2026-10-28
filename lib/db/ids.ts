// Id helpers (data-model conventions). Row ids are cuid-style strings; publicId is the number shown in URLs and grids.
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';

/** Smallest value of entity_public_id_seq (prisma/sql/00-extensions-sequences.sql). */
export const PUBLIC_ID_START = 5_100_000_001n;

/** New row id: 'c' plus 24 hex characters. Use it when an id is needed before the insert (for example in withChangeLog creates). */
export function newId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

/** Next number of the global public id sequence. Normally the column default does this; use it only when the id is needed up front. */
export async function nextPublicId(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<bigint> {
  const rows = await tx.$queryRaw<{ id: bigint }[]>`SELECT next_public_id() AS id`;
  const row = rows[0];
  if (!row) throw new Error('next_public_id() returned no row');
  return row.id;
}

/** URL form of a public id. Public ids are always positive integers. */
export function parsePublicId(value: string): bigint | null {
  return /^[1-9]\d{0,18}$/.test(value) ? BigInt(value) : null;
}
