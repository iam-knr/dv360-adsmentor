import 'server-only';
// What the Create advertiser form needs (module 02 2.2, S2): the partner's currency and time zone, the advertisers that
// can be copied from, and whether the person may create.
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { MAX_ADVERTISERS_PER_PARTNER } from './constants';
import { asResult, isLimited, loadPartner, mayDo, serviceCtx, type Result } from './kit';

export interface CreateAdvertiserContext {
  partnerCurrency: string;
  partnerTimeZone: string;
  advertisers: { id: string; publicId: string; name: string }[];
  atCap: boolean;
  canCreate: boolean;
  limitedAccess: boolean;
}

export async function getCreateAdvertiserContext(
  user: SessionUser,
  pid: string,
): Promise<Result<CreateAdvertiserContext>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const advertisers = await tx.advertiser.findMany({
        where: { partnerId: p.id },
        orderBy: { name: 'asc' },
        select: { id: true, publicId: true, name: true },
      });
      return {
        data: {
          partnerCurrency: p.currencyCode,
          partnerTimeZone: p.timeZone,
          advertisers: advertisers.map((a) => ({
            id: a.id,
            publicId: a.publicId.toString(),
            name: a.name,
          })),
          atCap: advertisers.length >= MAX_ADVERTISERS_PER_PARTNER,
          canCreate: mayDo(ctx, 'entity.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}
