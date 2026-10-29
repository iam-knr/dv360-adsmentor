// Custom bidding services against a real database (module 15 6.1 items 13 to 15, 18; E2E-RES-05/06 at service level).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { seedReferenceData } from '@/lib/seed/reference-db';
import {
  deleteCustomBidding,
  getCustomBidding,
  listCustomBidding,
  listCustomBiddingOptions,
  runCustomBiddingTest,
  saveCustomBidding,
  saveCustomBiddingDraft,
  setCustomBiddingStatus,
} from '@/lib/resources/custom-bidding';
import { advanceCustomBidding } from '@/lib/resources/custom-bidding-training';
import type { ResourceScope } from '@/lib/resources/lists';
import type { CbDraftInput } from '@/lib/resources/wire';
import { createWorld, dropWorld, type World } from '../db/helpers';
import { userOf } from '../services/campaigns/fixtures';

let w: World;
let other: World;
let scope: ResourceScope;

beforeAll(async () => {
  await seedReferenceData(prisma);
  w = await createWorld('cb');
  other = await createWorld('cb2');
  const adv = await prisma.advertiser.findUniqueOrThrow({ where: { id: w.advertiserId } });
  scope = { level: 'advertiser', id: adv.publicId.toString() };
}, 120_000);
afterAll(async () => {
  await dropWorld(w);
  await dropWorld(other);
  await prisma.$disconnect();
});

const user = () => userOf(w);
const draft = (over: Partial<CbDraftInput> = {}): CbDraftInput => ({
  name: 'Viewable value',
  objective: 'BRAND_AWARENESS',
  rules: [{ groupKey: 'Viewability rules', signalKey: 'VIEWABLE', value: true, score: 1 }],
  multipliers: [
    { kind: 'DEVICE_TYPE', values: [{ valueKey: 'SMARTPHONE', multiplier: 1.5 }] },
    { kind: 'DAY_AND_TIME', values: [{ valueKey: 'WEEKEND_EVENING', multiplier: 2 }] },
  ],
  ...over,
});

async function create(over: Partial<CbDraftInput> = {}) {
  const r = await saveCustomBiddingDraft(user(), scope, draft(over));
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.data;
}

const groupsOf = (entityId: string) =>
  prisma.changeGroup.findMany({
    where: { sandboxId: w.sandboxId, entityId },
    include: { entries: true },
  });
const rowOf = (publicId: string) =>
  prisma.customBiddingAlgorithm.findFirstOrThrow({ where: { publicId: BigInt(publicId) } });

describe('wizard', () => {
  it('keeps a draft out of the list and out of History until step 3 saves it', async () => {
    const d = await create({ name: 'Wizard happy path' });
    const row = await rowOf(d.id);
    expect(row.isDraft).toBe(true);
    expect((await listCustomBidding(user(), scope)).map((r) => r.name)).not.toContain(
      'Wizard happy path',
    );
    expect((await listCustomBiddingOptions(user(), w.advertiserId)).map((o) => o.id)).not.toContain(
      row.id,
    );
    expect(await groupsOf(row.id)).toHaveLength(0);

    const t = await runCustomBiddingTest(user(), d.id);
    expect(t.ok && t.data.sampleSize).toBe(2000);
    const saved = await saveCustomBidding(user(), d.id, {
      ownerScope: 'ADVERTISER',
      activate: false,
    });
    expect(saved.ok && saved.data.status).toBe('TRAINING');

    const listed = (await listCustomBidding(user(), scope)).find((r) => r.id === d.id);
    expect(listed).toMatchObject({
      status: 'TRAINING',
      readinessPct: 0,
      source: 'RULES',
      ownerScope: 'ADVERTISER',
      activeLineItems: 0,
    });
    const groups = await groupsOf(row.id);
    expect(groups).toHaveLength(1);
    expect(
      groups[0]!.entries.some(
        (e) => e.label === 'Algorithm name' && e.newValue === 'Wizard happy path',
      ),
    ).toBe(true);
    const view = await getCustomBidding(user(), d.id);
    expect(view.rules).toEqual([
      { groupKey: 'Viewability rules', signalKey: 'VIEWABLE', value: true, score: 1 },
    ]);
    expect(view.multipliers.map((m) => m.kind).sort()).toEqual(['DAY_AND_TIME', 'DEVICE_TYPE']);
    expect(view.lastTest?.passed).toBe(true);
  });

  it('validates step 1: no rules, no objective, five or duplicate multipliers', async () => {
    const cases: [Partial<CbDraftInput>, string][] = [
      [{ rules: [] }, 'CB-004'],
      [{ objective: null }, 'CB-002'],
      [{ name: ' ' }, 'CB-001'],
      [
        {
          multipliers: [
            'AD_POSITION',
            'CREATIVE_DIMENSION',
            'DAY_AND_TIME',
            'DEVICE_TYPE',
            'GENRE',
          ].map((kind) => ({ kind, values: [] })),
        },
        'CB-006',
      ],
      [
        {
          multipliers: [
            { kind: 'GENRE', values: [] },
            { kind: 'GENRE', values: [] },
          ],
        },
        'CB-007',
      ],
      [
        {
          multipliers: [{ kind: 'DEVICE_TYPE', values: [{ valueKey: 'TABLET', multiplier: 11 }] }],
        },
        'CB-012',
      ],
    ];
    for (const [over, ruleId] of cases) {
      const r = await saveCustomBiddingDraft(user(), scope, draft(over));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.map((i) => i.code)).toContain(ruleId);
    }
  });

  it('rejects a rule signal that does not belong to the objective', async () => {
    const r = await saveCustomBiddingDraft(
      user(),
      scope,
      draft({
        objective: 'CLICKS',
        rules: [{ groupKey: 'Viewability rules', signalKey: 'VIEWABLE', value: true, score: 1 }],
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('CB-008: Save needs a test of the current definition; any edit clears it', async () => {
    const d = await create({ name: 'Guarded' });
    const noTest = await saveCustomBidding(user(), d.id, {
      ownerScope: 'ADVERTISER',
      activate: false,
    });
    expect(noTest.ok).toBe(false);
    if (!noTest.ok) expect(noTest.issues[0]?.code).toBe('CB-008');

    await runCustomBiddingTest(user(), d.id);
    const edit = await saveCustomBiddingDraft(user(), scope, {
      ...draft({ name: 'Guarded' }),
      id: d.id,
      rules: [
        { groupKey: 'Viewability rules', signalKey: 'TIME_ON_SCREEN_10S', value: true, score: 2 },
      ],
    });
    expect(edit.ok).toBe(true);
    expect((await rowOf(d.id)).lastTestRunId).toBeNull();
    const again = await saveCustomBidding(user(), d.id, {
      ownerScope: 'ADVERTISER',
      activate: false,
    });
    expect(again.ok).toBe(false);
  });

  it('refuses to save after a test with a hard warning', async () => {
    const d = await create({
      name: 'Hard fail',
      objective: 'CONVERSIONS',
      rules: [
        {
          groupKey: 'Conversion rules',
          signalKey: 'ACTIVITY:no-such-activity',
          value: true,
          score: 1,
        },
      ],
      multipliers: [],
    });
    const t = await runCustomBiddingTest(user(), d.id);
    expect(t.ok && t.data.passed).toBe(false);
    expect(t.ok && t.data.warnings.some((x) => x.kind === 'HARD')).toBe(true);
    const s = await saveCustomBidding(user(), d.id, { ownerScope: 'ADVERTISER', activate: false });
    expect(s.ok).toBe(false);
  });

  it('runs the same test twice with the same result (determinism)', async () => {
    const d = await create({ name: 'Deterministic' });
    const a = await runCustomBiddingTest(user(), d.id);
    const b = await runCustomBiddingTest(user(), d.id);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect({ ...b.data, ranAt: '' }).toEqual({ ...a.data, ranAt: '' });
    }
  });

  it('stores the owner as partner when saved to partner level', async () => {
    const d = await create({ name: 'Partner owned' });
    await runCustomBiddingTest(user(), d.id);
    const s = await saveCustomBidding(user(), d.id, { ownerScope: 'PARTNER', activate: false });
    expect(s.ok).toBe(true);
    const row = await rowOf(d.id);
    expect(row.advertiserId).toBeNull();
    expect(row.partnerId).toBe(w.partnerId);
    expect(row.ownerScope).toBe('PARTNER');
    const asPartner = await listCustomBidding(user(), {
      level: 'partner',
      id: (
        await prisma.partner.findUniqueOrThrow({ where: { id: w.partnerId } })
      ).publicId.toString(),
    });
    expect(asPartner.map((r) => r.id)).toContain(d.id);
    // The advertiser still sees it.
    expect((await listCustomBidding(user(), scope)).find((r) => r.id === d.id)?.ownerScope).toBe(
      'PARTNER',
    );
  });
});

describe('lifecycle', () => {
  async function saved(name: string) {
    const d = await create({ name });
    await runCustomBiddingTest(user(), d.id);
    await saveCustomBidding(user(), d.id, { ownerScope: 'ADVERTISER', activate: false });
    return d.id;
  }

  it('editing a saved algorithm resets it to TRAINING, drops readiness and clears the test', async () => {
    const id = await saved('Reset on edit');
    const row = await rowOf(id);
    await prisma.customBiddingAlgorithm.update({
      where: { id: row.id },
      data: {
        status: 'ACTIVE',
        readinessPct: 100,
        trainingImpressions: 5000n,
        modelReadiness: 'READY',
      },
    });
    const r = await saveCustomBiddingDraft(user(), scope, {
      ...draft({ name: 'Reset on edit' }),
      id,
      rules: [{ groupKey: 'Viewability rules', signalKey: 'VIEWABLE', value: false, score: 1 }],
    });
    expect(r.ok && r.data.reset).toBe(true);
    const after = await rowOf(id);
    expect(after).toMatchObject({ status: 'TRAINING', readinessPct: 100 - 100, isDraft: false });
    expect(Number(after.trainingImpressions)).toBe(0);
    expect(after.lastTestRunId).toBeNull();
  });

  it('a rename alone keeps the model and the test', async () => {
    const id = await saved('Rename only');
    const r = await saveCustomBiddingDraft(user(), scope, { ...draft({ name: 'Renamed' }), id });
    expect(r.ok && r.data.reset).toBe(false);
    expect((await rowOf(id)).lastTestRunId).not.toBeNull();
  });

  it('rejects a stale version (optimistic lock)', async () => {
    const id = await saved('Locked');
    const r = await saveCustomBiddingDraft(
      user(),
      scope,
      { ...draft({ name: 'Locked' }), id },
      { expectedVersion: 1 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONFLICT');
  });

  it('suspend blocks the line items that use it; activate returns it to TRAINING or ACTIVE', async () => {
    const id = await saved('Suspend me');
    const row = await rowOf(id);
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: row.id, status: 'ACTIVE' },
    });
    const s = await setCustomBiddingStatus(user(), id, 'SUSPEND');
    expect(s.ok && s.data).toEqual({ status: 'SUSPENDED', usedBy: 1 });
    expect(s.ok && s.warnings?.[0]?.code).toBe('CB-011');
    expect((await listCustomBidding(user(), scope)).find((r) => r.id === id)).toMatchObject({
      status: 'SUSPENDED',
      activeLineItems: 1,
    });

    const a = await setCustomBiddingStatus(user(), id, 'ACTIVATE');
    expect(a.ok && a.data.status).toBe('TRAINING');
    await prisma.customBiddingAlgorithm.update({
      where: { id: row.id },
      data: { readinessPct: 100 },
    });
    await setCustomBiddingStatus(user(), id, 'SUSPEND');
    const b = await setCustomBiddingStatus(user(), id, 'ACTIVATE');
    expect(b.ok && b.data.status).toBe('ACTIVE');
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: null },
    });
  });

  it('a suspended algorithm stays suspended while it trains', async () => {
    const id = await saved('Stay suspended');
    const row = await rowOf(id);
    await setCustomBiddingStatus(user(), id, 'SUSPEND');
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: row.id },
    });
    await prisma.$transaction((tx) =>
      advanceCustomBidding(tx as never, w.sandboxId, [
        { lineItemId: w.lineItemId, metrics: { impressions: 6000 } },
      ]),
    );
    expect(await rowOf(id)).toMatchObject({ status: 'SUSPENDED', readinessPct: 100 });
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: null },
    });
  });

  it('training turns a saved algorithm ACTIVE once 5,000 labelled impressions are in', async () => {
    const id = await saved('Trains up');
    const row = await rowOf(id);
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: row.id },
    });
    await prisma.$transaction((tx) =>
      advanceCustomBidding(tx as never, w.sandboxId, [
        { lineItemId: w.lineItemId, metrics: { impressions: 5000 } },
      ]),
    );
    expect(await rowOf(id)).toMatchObject({ status: 'ACTIVE', readinessPct: 100 });
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: null },
    });
  });

  it('blocks deleting an algorithm a line item uses; deletes an unused one and logs it', async () => {
    const used = await saved('In use');
    const usedRow = await rowOf(used);
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: usedRow.id },
    });
    const blocked = await deleteCustomBidding(user(), used);
    expect(blocked.ok && blocked.data).toEqual({ deleted: false, usedBy: 1 });
    expect(blocked.ok && blocked.warnings?.[0]?.message).toBe(
      'This algorithm is used by 1 line items.',
    );
    await prisma.lineItem.update({
      where: { id: w.lineItemId },
      data: { customBiddingAlgorithmId: null },
    });

    const free = await saved('Unused');
    const freeRow = await rowOf(free);
    const gone = await deleteCustomBidding(user(), free);
    expect(gone.ok && gone.data.deleted).toBe(true);
    expect(await prisma.customBiddingAlgorithm.count({ where: { id: freeRow.id } })).toBe(0);
    expect((await groupsOf(freeRow.id)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('access', () => {
  it('READ_ONLY can read but not write; REPORTING_ONLY gets not found; foreign ids are not found', async () => {
    const d = await create({ name: 'Access' });
    expect((await listCustomBidding(userOf(w, 'READ_ONLY'), scope)).length).toBeGreaterThan(0);
    const write = await saveCustomBiddingDraft(userOf(w, 'READ_ONLY'), scope, draft());
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.code).toBe('FORBIDDEN');
    await expect(listCustomBidding(userOf(w, 'REPORTING_ONLY'), scope)).rejects.toThrow();
    await expect(getCustomBidding(userOf(other), d.id)).rejects.toThrow();
  });
});
