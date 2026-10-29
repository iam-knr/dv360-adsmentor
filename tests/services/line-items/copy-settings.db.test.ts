// AC-08-14 and L17: "Copy settings from" copies everything except name and status.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { mergeCopySettings } from '@/lib/line-items/form';
import {
  createLineItem,
  getCopyCandidates,
  getCopySource,
  getDraftInit,
  getLineItemDetail,
} from '@/lib/line-items/service';
import { dropWorld } from '../../db/helpers';
import { createLiWorld, userFor, validDraft, type World } from './helpers';

let w: World;
let sourceId: string;
let videoId: string;

beforeAll(async () => {
  w = await createLiWorld('licopy');
  const source = await validDraft(w, 'DISPLAY', 'Source display');
  source.budget = { mode: 'AMOUNT', amount: 250 };
  source.bid = { ...source.bid, fixedCpm: 4.5 };
  source.frequencyCap = { mode: 'LIMITED', maxImpressions: 7, periodCount: 2, period: 'WEEK' };
  source.integrationCode = 'SRC-1';
  const made = await createLineItem(userFor(w), w.ioId, source);
  if (!made.ok) throw new Error(JSON.stringify(made.issues));
  sourceId = made.data.id;
  const video = await validDraft(w, 'VIDEO', 'Source video');
  const v = await createLineItem(userFor(w), w.ioId, video);
  if (!v.ok) throw new Error(JSON.stringify(v.issues));
  videoId = v.data.id;
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('copy settings (AC-08-14)', () => {
  it('lists only line items of the same type, never the one being edited', async () => {
    const list = await getCopyCandidates(userFor(w), w.advertiserId, 'DISPLAY');
    expect(list.map((c) => c.id)).toContain(sourceId);
    expect(list.map((c) => c.id)).not.toContain(videoId);
    expect(list.map((c) => c.id)).toContain(w.lineItemId);
    const without = await getCopyCandidates(userFor(w), w.advertiserId, 'DISPLAY', sourceId);
    expect(without.map((c) => c.id)).not.toContain(sourceId);
  });

  it('returns the stored settings without name, status or parent', async () => {
    const res = await getCopySource(userFor(w), sourceId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.type).toBe('DISPLAY');
    const settings = res.data.settings as Record<string, unknown>;
    for (const key of ['name', 'status', 'ioId']) expect(settings).not.toHaveProperty(key);
    expect(settings.integrationCode).toBe('SRC-1');
    expect(res.data.settings.frequencyCap).toMatchObject({
      mode: 'LIMITED',
      maxImpressions: 7,
      period: 'WEEK',
    });
  });

  it('merges onto a draft: settings come from the source, name and status stay', async () => {
    const source = await getCopySource(userFor(w), sourceId);
    if (!source.ok) throw new Error('no source');
    const init = await getDraftInit(userFor(w), w.ioId, 'DISPLAY', { name: 'My copy' });
    const draft = { ...init!.value, name: 'My copy', status: 'PAUSED' as const };
    const merged = mergeCopySettings(draft, source.data, init!.io);
    expect(merged.name).toBe('My copy');
    expect(merged.status).toBe('PAUSED');
    expect(merged.ioId).toBe(draft.ioId);
    expect(merged.integrationCode).toBe('SRC-1');
    expect(merged.frequencyCap.maxImpressions).toBe(7);
    expect(Number(merged.budget.amount)).toBe(250);
    // the target IO's automation locks win over the copied bid (module 08 4.3 item 2)
    if (init!.io.mode === 'IO_AUTOMATED') {
      expect(merged.bid).toMatchObject({ mode: 'AUTOMATED', fixedCpm: null });
      expect(merged.pacing.type).not.toBe('EVEN');
    } else {
      expect(Number(merged.bid.fixedCpm)).toBe(4.5);
    }
  });

  it('a line item created from the merged draft stores the copied settings under its own name', async () => {
    const source = await getCopySource(userFor(w), sourceId);
    if (!source.ok) throw new Error('no source');
    const init = await getDraftInit(userFor(w), w.ioId, 'DISPLAY', { name: 'Copied LI' });
    const merged = mergeCopySettings(init!.value, source.data, init!.io);
    merged.euPoliticalAds = 'NO';
    const made = await createLineItem(userFor(w), w.ioId, merged);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const detail = await getLineItemDetail(userFor(w), made.data.id);
    expect(detail?.value.name).toBe('Copied LI');
    expect(detail?.value.status).toBe('DRAFT');
    expect(detail?.value.integrationCode).toBe('SRC-1');
    expect(detail?.value.frequencyCap.maxImpressions).toBe(7);
    expect(made.data.id).not.toBe(sourceId);
  });

  it('is refused for a read-only user and for an unknown id', async () => {
    const denied = await getCopySource(userFor(w, 'READ_ONLY'), sourceId);
    expect(denied).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    const missing = await getCopySource(userFor(w), 'does-not-exist');
    expect(missing).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });
});
