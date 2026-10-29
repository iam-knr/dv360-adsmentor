// Fixtures of the line item service tests: a world with an enabled exchange, users of each role and a valid draft.
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { getDraftInit } from '@/lib/line-items/service';
import type { LiFormValue } from '@/lib/line-items/form';
import type { LiType } from '@/lib/validation/types';
import { createWorld, type World } from '../../db/helpers';

export type { World };

export function userFor(w: World, dvRole: SessionUser['dvRole'] = 'STANDARD'): SessionUser {
  return {
    id: w.userId,
    email: `${w.tag}-user@example.test`,
    name: `User ${w.tag}`,
    appRole: 'user',
    classroomId: w.classroomId,
    sandboxId: w.sandboxId,
    partnerId: w.partnerId,
    dvRole,
  };
}

export async function createLiWorld(tag: string): Promise<World> {
  return createWorld(tag);
}

/** Defaults of the create form plus the fields a student must fill (name, fixed bid, budget, EU answer). */
export async function validDraft(
  w: World,
  type: LiType,
  name: string,
  opts: { adType?: 'DISPLAY' | 'VIDEO' } = {},
): Promise<LiFormValue> {
  const init = await getDraftInit(userFor(w), w.ioId, type, { name, ...opts });
  if (!init) throw new Error(`no draft for ${type}`);
  const value = init.value;
  return {
    ...value,
    budget: { mode: 'AMOUNT', amount: 100 },
    pacing: { ...value.pacing, period: 'DAILY', type: 'EVEN', dailyAmount: 10 },
    bid: { ...value.bid, mode: 'FIXED', optimizedTowards: null, fixedCpm: 2 },
    euPoliticalAds: 'NO',
  };
}

export async function addCreative(
  w: World,
  name: string,
  kind: 'STANDARD_IMAGE' | 'VIDEO_FILE' | 'AUDIO_FILE',
  over: { status?: 'ACTIVE' | 'ARCHIVED'; review?: 'SERVABLE' | 'NOT_SERVABLE' } = {},
): Promise<string> {
  const row = await prisma.creative.create({
    data: {
      sandboxId: w.sandboxId,
      advertiserId: w.advertiserId,
      name,
      kind,
      ...(over.status ? { status: over.status } : {}),
      ...(over.review ? { dv360Review: over.review } : {}),
    },
  });
  return row.id;
}
