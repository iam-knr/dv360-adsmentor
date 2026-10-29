// Creative assignment rules LI-060 to LI-064 through the service (AC-08-11).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  assignCreatives,
  createLineItem,
  getCreativeCandidates,
  getLineItemDetail,
  setLineItemStatus,
  validateLineItem,
} from '@/lib/line-items/service';
import { dropWorld } from '../../db/helpers';
import { addCreative, createLiWorld, userFor, validDraft, type World } from './helpers';

let w: World;
let displayLi: string;
let emptyLi: string;
let image: string;
let video: string;
let audio: string;
let archived: string;
let notServable: string;

const user = () => userFor(w);

beforeAll(async () => {
  w = await createLiWorld('licre');
  image = await addCreative(w, 'Banner', 'STANDARD_IMAGE');
  video = await addCreative(w, 'Spot', 'VIDEO_FILE');
  audio = await addCreative(w, 'Jingle', 'AUDIO_FILE');
  archived = await addCreative(w, 'Old banner', 'STANDARD_IMAGE', { status: 'ARCHIVED' });
  notServable = await addCreative(w, 'Rejected banner', 'STANDARD_IMAGE', {
    review: 'NOT_SERVABLE',
  });
  const a = await createLineItem(user(), w.ioId, await validDraft(w, 'DISPLAY', 'Display A'));
  const b = await createLineItem(user(), w.ioId, await validDraft(w, 'DISPLAY', 'Display B'));
  if (!a.ok || !b.ok) throw new Error('setup failed');
  displayLi = a.data.id;
  emptyLi = b.data.id;
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

const assigned = async (liId: string) =>
  (await prisma.creativeAssignment.findMany({ where: { lineItemId: liId } })).map(
    (r) => r.creativeId,
  );

describe('candidates (AC-08-11)', () => {
  it('marks eligibility per line item type and servability', async () => {
    const rows = await getCreativeCandidates(user(), w.ioId, { type: 'DISPLAY' });
    const by = new Map(rows.map((r) => [r.id, r]));
    expect(by.get(image)?.eligible).toBe(true);
    expect(by.get(video)?.eligible).toBe(false);
    expect(by.get(video)?.reason).toBeTruthy();
    expect(by.get(audio)?.eligible).toBe(false);
    expect(by.get(archived)?.eligible).toBe(false);
    expect(by.get(notServable)?.eligible).toBe(false);
    expect(by.get(notServable)?.reason).toMatch(/servable/);
  });

  it('an Audio line item accepts the audio creative only', async () => {
    const rows = await getCreativeCandidates(user(), w.ioId, { type: 'AUDIO' });
    expect(rows.filter((r) => r.eligible).map((r) => r.id)).toEqual([audio]);
  });
});

describe('assignCreatives', () => {
  it('LI-060: a creative type the line item does not accept is refused', async () => {
    const res = await assignCreatives(user(), displayLi, { add: [video] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.issues.map((i) => i.ruleId)).toContain('LI-060');
    expect(await assigned(displayLi)).toEqual([]);
  });

  it('LI-060: an unknown creative id is refused', async () => {
    const res = await assignCreatives(user(), displayLi, { add: ['nope'] });
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.issues[0]?.ruleId).toBe('LI-060');
  });

  it('LI-061: an archived or not servable creative is refused', async () => {
    for (const id of [archived, notServable]) {
      const res = await assignCreatives(user(), displayLi, { add: [id] });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.issues.map((i) => i.ruleId)).toContain('LI-061');
    }
    expect(await assigned(displayLi)).toEqual([]);
  });

  it('assigns an eligible creative, is idempotent and logs the change', async () => {
    const first = await assignCreatives(user(), displayLi, { add: [image] });
    expect(first).toMatchObject({ ok: true, data: { assigned: [image] } });
    const again = await assignCreatives(user(), displayLi, { add: [image] });
    expect(again).toMatchObject({ ok: true, data: { assigned: [image] } });
    expect(await assigned(displayLi)).toEqual([image]);
    expect(await prisma.changeGroup.count({ where: { entityId: displayLi } })).toBeGreaterThan(0);
    const detail = await getLineItemDetail(user(), displayLi);
    expect(detail?.creatives.map((c) => c.id)).toEqual([image]);
  });

  it('removes a creative', async () => {
    const res = await assignCreatives(user(), displayLi, { remove: [image] });
    expect(res).toMatchObject({ ok: true, data: { assigned: [] } });
    expect(await assigned(displayLi)).toEqual([]);
  });

  it('is forbidden for a read-only user', async () => {
    const res = await assignCreatives(userFor(w, 'READ_ONLY'), displayLi, { add: [image] });
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });
});

describe('creative warnings', () => {
  it('LI-062: no creatives gives the info text and does not block', async () => {
    const detail = await getLineItemDetail(user(), emptyLi);
    const issues = await validateLineItem(user(), w.ioId, detail!.value, emptyLi);
    const li062 = issues.find((i) => i.ruleId === 'LI-062');
    expect(li062?.blocking).toBe(false);
    expect(issues.filter((i) => i.blocking)).toEqual([]);
  });

  it('LI-063: activating without creatives warns but never blocks', async () => {
    const res = await setLineItemStatus(user(), { id: emptyLi, status: 'ACTIVE' });
    if (res.ok) {
      expect(res.warnings?.map((i) => i.ruleId)).toContain('LI-063');
    } else {
      // another activation rule of the fixture IO may block; LI-063 itself never does
      expect(res.issues.filter((i) => i.ruleId === 'LI-063' && i.blocking)).toEqual([]);
    }
  });

  it('LI-064: a creative restricted from a targeted country warns', async () => {
    const restricted = await addCreative(w, 'Restricted banner', 'STANDARD_IMAGE');
    await prisma.creativeRestriction.create({
      data: {
        sandboxId: w.sandboxId,
        creativeId: restricted,
        kind: 'LEGAL_COUNTRY',
        countryCode: 'DE',
        message: 'Not allowed in Germany',
      },
    });
    const detail = await getLineItemDetail(user(), emptyLi);
    const value = {
      ...detail!.value,
      creatives: [restricted],
      targeting: { ...detail!.value.targeting, countries: ['DE'] },
    };
    const issues = await validateLineItem(user(), w.ioId, value, emptyLi);
    const li064 = issues.find((i) => i.ruleId === 'LI-064');
    expect(li064?.blocking).toBe(false);
    expect(li064?.message).toContain('DE');
    const other = await validateLineItem(
      user(),
      w.ioId,
      { ...value, targeting: { ...value.targeting, countries: ['IN'] } },
      emptyLi,
    );
    expect(other.some((i) => i.ruleId === 'LI-064')).toBe(false);
  });
});
