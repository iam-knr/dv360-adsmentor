import 'server-only';
// Read model for the minimal Advertisers page (P3-03 item 8). The full list with metrics is module 02 work.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import type { EntityStatusKey } from './types';

export interface AdvertiserListRow {
  publicId: string;
  name: string;
  status: EntityStatusKey;
  currencyCode: string;
}

export async function listAdvertisers(
  user: Pick<SessionUser, 'sandboxId'>,
  partnerRowId: string,
): Promise<AdvertiserListRow[]> {
  if (!user.sandboxId) return [];
  const rows = await withSandbox(user.sandboxId, (tx) =>
    tx.advertiser.findMany({
      where: { partnerId: partnerRowId },
      orderBy: { name: 'asc' },
      select: { publicId: true, name: true, status: true, currencyCode: true },
    }),
  );
  return rows.map((r) => ({ ...r, publicId: r.publicId.toString() }));
}
