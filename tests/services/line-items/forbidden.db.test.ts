// AC-08-25: a forged write from a read-only role is refused by the service, whatever the UI shows.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  assignCreatives,
  createLineItem,
  getLineItemDetail,
  setLineItemStatus,
  updateLineItem,
} from '@/lib/line-items/service';
import { dropWorld } from '../../db/helpers';
import { createLiWorld, userFor, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await createLiWorld('liforbid');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('read-only role (AC-08-25)', () => {
  it('forged updateLineItem returns FORBIDDEN and changes nothing', async () => {
    const detail = await getLineItemDetail(userFor(w, 'READ_ONLY'), w.lineItemId);
    expect(detail?.readOnly).toBe(true);
    const before = await prisma.lineItem.findUniqueOrThrow({ where: { id: w.lineItemId } });
    const res = await updateLineItem(userFor(w, 'READ_ONLY'), w.lineItemId, {
      ...detail!.value,
      name: 'Forged rename',
    });
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const after = await prisma.lineItem.findUniqueOrThrow({ where: { id: w.lineItemId } });
    expect(after.name).toBe(before.name);
    expect(after.version).toBe(before.version);
    expect(await prisma.changeGroup.count({ where: { entityId: w.lineItemId } })).toBe(0);
  });

  it('forged create, status change and creative assignment are refused too', async () => {
    const detail = await getLineItemDetail(userFor(w, 'READ_ONLY'), w.lineItemId);
    const ro = userFor(w, 'READ_ONLY');
    expect(await createLineItem(ro, w.ioId, detail!.value)).toMatchObject({ code: 'FORBIDDEN' });
    expect(await setLineItemStatus(ro, { id: w.lineItemId, status: 'ACTIVE' })).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(await assignCreatives(ro, w.lineItemId, { remove: [w.creativeId] })).toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('a standard user can write the same change', async () => {
    const detail = await getLineItemDetail(userFor(w), w.lineItemId);
    expect(detail?.readOnly).toBe(false);
    const res = await updateLineItem(userFor(w), w.lineItemId, {
      ...detail!.value,
      name: 'Allowed rename',
    });
    expect(res.ok || res.code !== 'FORBIDDEN').toBe(true);
  });
});
