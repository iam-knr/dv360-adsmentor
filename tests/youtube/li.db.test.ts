// YouTube line items through the shared line item service (module 09 Y2, Y3, AC-09-03..08).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createLineItem,
  getDraftInit,
  getLineItemDetail,
  setLineItemStatus,
  updateLineItem,
} from '@/lib/line-items/service';
import type { LiFormValue } from '@/lib/line-items/form';
import { dropWorld } from '../db/helpers';
import { createLiWorld, userFor, type World } from '../services/line-items/helpers';

let w: World;
beforeAll(async () => {
  w = await createLiWorld('ytli');
  // YouTube line items need a manual IO (automation locks bid and pacing) with a brand awareness objective
  await prisma.insertionOrder.update({
    where: { id: w.ioId },
    data: { objective: 'BRAND_AWARENESS', bidBudgetControl: 'LI_CONTROLLED' },
  });
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

async function draft(
  name: string,
  optimization: 'REACH' | 'TARGET_FREQUENCY' | 'TRUEVIEW_VIEWS' = 'REACH',
  choice: 'EFFICIENT' | 'NON_SKIPPABLE' | 'ALL_FORMATS' | 'IN_STREAM_ONLY' | null = 'EFFICIENT',
  type: 'YT_VIDEO' | 'YT_AUDIO' = 'YT_VIDEO',
): Promise<LiFormValue> {
  const init = await getDraftInit(userFor(w), w.ioId, type, {
    name,
    youtube: { optimization, choice },
  });
  if (!init) throw new Error('no draft');
  return { ...init.value, euPoliticalAds: 'NO' };
}

const rules = (r: { ok: boolean; issues?: { ruleId: string }[] }) =>
  r.ok ? [] : (r.issues ?? []).map((i) => i.ruleId);

describe('YouTube line item form (Y1, Y2)', () => {
  it('builds the defaults of the step 1 choice (AC-09-03, AC-09-05, AC-09-06)', async () => {
    const v = await draft('Efficient');
    expect(v.youtube).toMatchObject({
      subtype: 'EFFICIENT_REACH',
      adFormats: { inStream: true, inFeed: true, shorts: true },
      inventorySources: ['YOUTUBE', 'GOOGLE_TV', 'VIDEO_PARTNERS'],
    });
    expect(v.bid).toMatchObject({ mode: 'AUTOMATED', optimizedTowards: 'MAX_REACH' });
    expect(v.pacing).toMatchObject({ period: 'DAILY', type: 'EVEN' });
    const tf = await draft('TF', 'TARGET_FREQUENCY', 'IN_STREAM_ONLY');
    expect(tf.youtube?.subtype).toBe('TARGET_FREQUENCY_IN_STREAM');
    expect(tf.youtube?.adFormats).toEqual({ inStream: true, inFeed: false, shorts: false });
    expect(tf.youtube?.targetFrequency).toBeTruthy();
    const audio = await draft('Audio', 'REACH', null, 'YT_AUDIO');
    expect(audio.youtube?.subtype).toBe('AUDIO_REACH');
  });

  it('requires the amount, a format and the target frequency (LI-YT-005, 006, 012, 013, 017)', async () => {
    const v = await draft('Needs amount');
    expect(rules(await createLineItem(userFor(w), w.ioId, v))).toContain('LI-YT-006');
    const noFormats = {
      ...v,
      pacing: { ...v.pacing, dailyAmount: 1000 },
      youtube: { ...v.youtube!, adFormats: { inStream: false, inFeed: false, shorts: false } },
    };
    expect(rules(await createLineItem(userFor(w), w.ioId, noFormats))).toContain('LI-YT-005');
    const feed = {
      ...v,
      pacing: { ...v.pacing, dailyAmount: 1000 },
      youtube: { ...v.youtube!, productFeed: true, inventorySources: [] },
    };
    const got = rules(await createLineItem(userFor(w), w.ioId, feed));
    expect(got).toEqual(expect.arrayContaining(['LI-YT-013', 'LI-YT-017']));
    const tf = await draft('TF', 'TARGET_FREQUENCY', 'ALL_FORMATS');
    const missing = { ...tf, pacing: { ...tf.pacing, dailyAmount: 1000 } };
    expect(rules(await createLineItem(userFor(w), w.ioId, missing))).toContain('LI-YT-012');
  });

  let liId: string;

  it('creates, stores the YouTube columns and the inventory sources, and reads them back (Y2)', async () => {
    const v = await draft('Created', 'TARGET_FREQUENCY', 'ALL_FORMATS');
    const ok = {
      ...v,
      pacing: { ...v.pacing, dailyAmount: 1000 },
      youtube: {
        ...v.youtube!,
        targetFrequency: {
          mode: 'LIMITED' as const,
          maxImpressions: 4,
          periodCount: 1,
          period: 'WEEK' as const,
        },
        viewCap: {
          mode: 'LIMITED' as const,
          maxImpressions: 2,
          periodCount: 1,
          period: 'DAY' as const,
        },
        inventorySources: ['YOUTUBE', 'VIDEO_PARTNERS'] as ('YOUTUBE' | 'VIDEO_PARTNERS')[],
        relatedVideoIds: ['SIMbump0001'],
      },
    };
    const res = await createLineItem(userFor(w), w.ioId, ok);
    if (!res.ok) throw new Error(JSON.stringify(res.issues.map((i) => [i.ruleId, i.path])));
    liId = res.data.id;
    const row = await prisma.lineItem.findUniqueOrThrow({ where: { id: liId } });
    expect(row).toMatchObject({
      type: 'YT_VIDEO',
      ytSubtype: 'TARGET_FREQUENCY',
      ytSurfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
      targetFreqExposures: 4,
      viewFreqMode: 'UNLIMITED', // target frequency uses the exposure cap only (MX-07)
      bidGoal: 'TARGET_CPM',
    });
    const detail = await getLineItemDetail(userFor(w), liId);
    expect(detail?.value.youtube).toMatchObject({
      subtype: 'TARGET_FREQUENCY',
      inventorySources: ['YOUTUBE', 'VIDEO_PARTNERS'],
      relatedVideoIds: ['SIMbump0001'],
    });
    expect(detail?.value.youtube?.targetFrequency?.maxImpressions).toBe(4);
  });

  it('stores the view cap of an efficient reach line item', async () => {
    const v = await draft('Efficient with view cap');
    const res = await createLineItem(userFor(w), w.ioId, {
      ...v,
      pacing: { ...v.pacing, dailyAmount: 500 },
      youtube: {
        ...v.youtube!,
        viewCap: { mode: 'LIMITED', maxImpressions: 2, periodCount: 1, period: 'DAY' },
      },
    });
    if (!res.ok) throw new Error(JSON.stringify(res.issues));
    const row = await prisma.lineItem.findUniqueOrThrow({ where: { id: res.data.id } });
    expect(row).toMatchObject({ viewFreqMode: 'LIMITED', viewFreqMax: 2, viewFreqUnit: 'DAY' });
  });

  it('keeps the subtype read-only after create (LI-YT-004) and saves other edits (Y3)', async () => {
    const detail = await getLineItemDetail(userFor(w), liId);
    const forged = {
      ...detail!.value,
      youtube: { ...detail!.value.youtube!, subtype: 'EFFICIENT_REACH' as const },
    };
    expect(rules(await updateLineItem(userFor(w), liId, forged))).toContain('LI-YT-004');
    const renamed = { ...detail!.value, name: 'Renamed YT' };
    expect(
      await updateLineItem(userFor(w), liId, renamed, { expectedVersion: detail!.version }),
    ).toMatchObject({ ok: true });
  });

  it('activating without active ad groups warns (LI-YT-018) and never blocks', async () => {
    const res = await setLineItemStatus(userFor(w), { id: liId, status: 'ACTIVE' });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.warnings ?? []).map((i) => i.ruleId)).toContain('LI-YT-018');
  });
});
