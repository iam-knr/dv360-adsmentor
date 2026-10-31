// Q9: a targeting-only edit writes an explicit history entry with the before and after selection.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createLineItem, updateLineItem } from '@/lib/line-items/service';
import { dropWorld } from '../../db/helpers';
import { createLiWorld, userFor, validDraft, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await createLiWorld('litgh');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('Q9 targeting changes in the line item history', () => {
  it('logs a geography edit with before and after', async () => {
    const draft = await validDraft(w, 'DISPLAY', 'Geo LI');
    const created = await createLineItem(userFor(w), w.ioId, draft);
    if (!created.ok) throw new Error('create failed');
    const id = created.data.id;
    const geo = (regions: { id: string; label: string; mode: 'INCLUDE' | 'EXCLUDE' }[]) => ({
      ...draft,
      targetingState: {
        ...draft.targetingState,
        criteria: { ...draft.targetingState.criteria, geography: { regions } },
      },
    });
    const first = await updateLineItem(
      userFor(w),
      id,
      geo([{ id: 'IN-KL', label: 'Kerala', mode: 'INCLUDE' }]),
      {},
    );
    expect(first.ok).toBe(true);
    const second = await updateLineItem(
      userFor(w),
      id,
      geo([
        { id: 'IN-KL', label: 'Kerala', mode: 'INCLUDE' },
        { id: 'IN-TN', label: 'Tamil Nadu', mode: 'EXCLUDE' },
      ]),
      {},
    );
    expect(second.ok).toBe(true);
    const entries = await prisma.changeEntry.findMany({
      where: { group: { entityId: id } },
      orderBy: { sortOrder: 'asc' },
    });
    const update = entries.find(
      (e) => e.fieldPath.startsWith('targeting[GEOGRAPHY]') && e.kind === 'UPDATE',
    );
    expect(update?.oldValue).toMatch(/^Region inclusions: (Kerala|IN-KL)$/);
    expect(update?.newValue).toMatch(/^Region inclusions: (Kerala|IN-KL); Region exclusions: (Tamil Nadu|IN-TN)$/);
  });
});
