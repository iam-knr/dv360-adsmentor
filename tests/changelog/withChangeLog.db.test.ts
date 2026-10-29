import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DuplicateChangeError,
  historyWhere,
  renderLine,
  withChangeLog,
  type ChangeCtx,
} from '@/lib/changelog';
import { advertiserRegistry } from '@/lib/changelog/registries/advertiser';
import { MissingRegistryError } from '@/lib/changelog/registries';
import { prisma, withSandbox } from '@/lib/db';
import { createWorld, dropWorld, type World } from '../db/helpers';
import {
  adGroupTestRegistry,
  ioTestRegistry,
  lineItemTestRegistry,
  partnerTestRegistry,
} from './fixtures';

let w: World;
const label = 'student014@sim.adsmetor.invalid';

const ctx = (over: Partial<ChangeCtx> = {}): ChangeCtx => ({
  sandboxId: w.sandboxId,
  classroomId: w.classroomId,
  actor: { type: 'USER', userId: w.userId, label },
  ...over,
});
const chain = () => ({ advertiserId: w.advertiserId, campaignId: w.campaignId, ioId: w.ioId });

async function groupsFor(entityId: string) {
  return prisma.changeGroup.findMany({
    where: { sandboxId: w.sandboxId, entityId },
    include: { entries: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { occurredAt: 'asc' },
  });
}

beforeAll(async () => {
  w = await createWorld('log');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.exchange.deleteMany({ where: { code: { startsWith: 'log-ex-' } } });
  await prisma.$disconnect();
});

describe('withChangeLog', () => {
  it('AC-05-1: one scalar edit of an IO writes one group with one UPDATE entry', async () => {
    await withChangeLog(
      ctx(),
      { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
      (tx) => tx.insertionOrder.update({ where: { id: w.ioId }, data: { name: 'Renamed IO' } }),
      { registry: ioTestRegistry },
    );
    const groups = await groupsFor(w.ioId);
    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    expect(g.summary).toBe('1 change to insertion order');
    expect(g.actorType).toBe('USER');
    expect(g.userId).toBe(w.userId);
    expect(g.actorLabel).toBe(label);
    expect([g.advertiserId, g.campaignId, g.ioId, g.lineItemId]).toEqual([
      w.advertiserId,
      w.campaignId,
      w.ioId,
      null,
    ]);
    expect(g.entityName).toBe('Renamed IO');
    expect(g.entityPublicId).not.toBeNull();
    expect(g.entries).toHaveLength(1);
    expect(g.entries[0]).toMatchObject({
      kind: 'UPDATE',
      fieldPath: 'name',
      label: 'Name',
      newValue: 'Renamed IO',
    });
    expect(g.entries[0]!.oldValue).toMatch(/^IO /);
  });

  it('AC-05-2: a save with no real change writes no group', async () => {
    await prisma.advertiser.update({
      where: { id: w.advertiserId },
      data: { thirdPartyConfig: { a: 2, b: 1 } },
    });
    const before = (await groupsFor(w.advertiserId)).length;
    // same values, new object identity, Json keys in another order
    const row = await withChangeLog(
      ctx(),
      { type: 'ADVERTISER', id: w.advertiserId, chain: { advertiserId: w.advertiserId } },
      (tx) =>
        tx.advertiser.update({
          where: { id: w.advertiserId },
          data: { thirdPartyConfig: { b: 1, a: 2 }, name: `Advertiser ${w.tag}` },
        }),
    );
    expect(row.id).toBe(w.advertiserId);
    expect((await groupsFor(w.advertiserId)).length).toBe(before);
  });

  it('AC-05-3: a create writes one CREATE entry per non-null registered field and says "N changes made."', async () => {
    const created = await withChangeLog(
      ctx(),
      { type: 'INSERTION_ORDER', chain: chain() },
      (tx) =>
        tx.insertionOrder.create({
          data: {
            sandboxId: w.sandboxId,
            campaignId: w.campaignId,
            advertiserId: w.advertiserId,
            name: 'Brand new IO',
            objective: 'CLICKS',
          },
        }),
      { registry: ioTestRegistry },
    );
    const [g] = await groupsFor(created.id);
    expect(g).toBeDefined();
    expect(g!.entries.every((e) => e.kind === 'CREATE')).toBe(true);
    expect(g!.entries.map((e) => e.fieldPath)).toEqual(['name', 'status', 'objective']);
    expect(g!.summary).toBe(`${g!.entries.length} changes made.`);
    expect(g!.entityName).toBe('Brand new IO');
  });

  it('AC-05-3: a create of an advertiser lists registered non-null columns in registry order', async () => {
    const adv = await withChangeLog(ctx(), { type: 'ADVERTISER', chain: {} }, (tx) =>
      tx.advertiser.create({
        data: {
          sandboxId: w.sandboxId,
          partnerId: w.partnerId,
          name: 'Second advertiser',
          websiteUrl: 'https://example.test',
          currencyCode: 'INR',
          timeZone: 'Asia/Calcutta',
        },
      }),
    );
    const [g] = await groupsFor(adv.id);
    const paths = g!.entries.map((e) => e.fieldPath);
    const registered = advertiserRegistry.fields.filter((f) => !f.ignore).map((f) => f.path);
    expect(paths.every((p) => registered.includes(p))).toBe(true);
    expect(paths).toEqual(registered.filter((p) => paths.includes(p)));
    expect(paths).toContain('productImprovement');
    expect(paths).not.toContain('industry'); // null
    expect(paths).not.toContain('version');
    expect(paths).not.toContain('updatedAt');
  });

  it('AC-05-5: a status change writes a STATUS_CHANGE entry', async () => {
    await withChangeLog(
      ctx(),
      { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
      (tx) => tx.insertionOrder.update({ where: { id: w.ioId }, data: { status: 'PAUSED' } }),
      { registry: ioTestRegistry },
    );
    const g = (await groupsFor(w.ioId)).at(-1)!;
    expect(g.summary).toBe('Status changed to Paused');
    const [e] = g.entries;
    expect(e).toMatchObject({ kind: 'STATUS_CHANGE', fieldPath: 'status', label: 'Status' });
    expect(e!.newValue).toBe('PAUSED');
    expect(renderLine({ ...e!, oldValue: 'ACTIVE' })).toBe(
      'Status changed from "Active" to "Paused"',
    );
  });

  it('AC-05-6: ignore fields never appear in entries', async () => {
    const before = (await groupsFor(w.ioId)).length;
    await withChangeLog(
      ctx(),
      { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
      (tx) =>
        tx.insertionOrder.update({ where: { id: w.ioId }, data: { version: { increment: 1 } } }),
      { registry: ioTestRegistry },
    );
    expect((await groupsFor(w.ioId)).length).toBe(before); // version and updatedAt only: no group
    await withChangeLog(
      ctx(),
      { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
      (tx) =>
        tx.insertionOrder.update({
          where: { id: w.ioId },
          data: { name: 'With version bump', version: { increment: 1 } },
        }),
      { registry: ioTestRegistry },
    );
    const g = (await groupsFor(w.ioId)).at(-1)!;
    expect(g.entries.map((e) => e.fieldPath)).toEqual(['name']);
  });

  it('AC-05-4: adding 2 exchanges and removing 1 in one save writes one group with 3 entries', async () => {
    const ex = await Promise.all(
      [1, 2, 3].map((n) =>
        prisma.exchange.upsert({
          where: { code: `log-ex-${n}` },
          create: { code: `log-ex-${n}`, name: `Log exchange ${n}` },
          update: {},
        }),
      ),
    );
    await prisma.partnerExchange.deleteMany({ where: { partnerId: w.partnerId } });
    await prisma.partnerExchange.create({
      data: { sandboxId: w.sandboxId, partnerId: w.partnerId, exchangeId: ex[0]!.id },
    });
    const before = (await groupsFor(w.partnerId)).length;
    await withChangeLog(
      ctx(),
      { type: 'PARTNER', id: w.partnerId, chain: {} },
      async (tx) => {
        await tx.partnerExchange.deleteMany({
          where: { partnerId: w.partnerId, exchangeId: ex[0]!.id },
        });
        await tx.partnerExchange.createMany({
          data: [ex[1]!, ex[2]!].map((e) => ({
            sandboxId: w.sandboxId,
            partnerId: w.partnerId,
            exchangeId: e.id,
          })),
        });
      },
      { registry: partnerTestRegistry },
    );
    const groups = await groupsFor(w.partnerId);
    expect(groups.length).toBe(before + 1);
    const g = groups.at(-1)!;
    expect(g.entries).toHaveLength(3);
    expect(g.summary).toBe('3 changes to partner');
    expect(g.entries.filter((e) => e.kind === 'CREATE')).toHaveLength(2);
    expect(g.entries.filter((e) => e.kind === 'DELETE')).toHaveLength(1);
  });

  it('adding one exchange says "1 ad exchange added"', async () => {
    const ex = await prisma.exchange.upsert({
      where: { code: 'log-ex-9' },
      create: { code: 'log-ex-9', name: 'Log exchange 9' },
      update: {},
    });
    await withChangeLog(
      ctx(),
      { type: 'PARTNER', id: w.partnerId, chain: {} },
      (tx) =>
        tx.partnerExchange.create({
          data: { sandboxId: w.sandboxId, partnerId: w.partnerId, exchangeId: ex.id },
        }),
      { registry: partnerTestRegistry },
    );
    expect((await groupsFor(w.partnerId)).at(-1)!.summary).toBe('1 ad exchange added');
  });

  it('AC-05-9: a partner change writes 1 partner group and 1 PARTNER_FANOUT group per advertiser', async () => {
    const second = await prisma.advertiser.create({
      data: {
        sandboxId: w.sandboxId,
        partnerId: w.partnerId,
        name: 'Fan-out advertiser',
        websiteUrl: 'https://example.test',
        currencyCode: 'INR',
        timeZone: 'Asia/Calcutta',
      },
    });
    const advertiserIds = [w.advertiserId, second.id];
    await withChangeLog(
      ctx(),
      { type: 'PARTNER', id: w.partnerId, chain: {} },
      (tx) => tx.partner.update({ where: { id: w.partnerId }, data: { name: 'Partner renamed' } }),
      { registry: partnerTestRegistry, fanOut: { advertiserIds } },
    );
    const groups = (await groupsFor(w.partnerId)).filter((g) =>
      g.entries.some((e) => e.newValue === 'Partner renamed'),
    );
    const partnerGroup = groups.find((g) => g.advertiserId === null)!;
    expect(partnerGroup.source).toBe('UI');
    const fan = groups.filter((g) => g.source === 'PARTNER_FANOUT');
    expect(fan.map((g) => g.advertiserId).sort()).toEqual([...advertiserIds].sort());
    for (const g of fan) {
      expect(g.systemActor).toBe('PARTNER_SETTING_UPDATER');
      expect(g.actorType).toBe('SYSTEM');
      expect(g.fanOutFromGroupId).toBe(partnerGroup.id);
    }
    const scope = { advertiserId: second.id };
    const hidden = await prisma.changeGroup.findMany({
      where: historyWhere({ sandboxId: w.sandboxId, scope }),
    });
    expect(hidden).toHaveLength(0); // "Include system changes" is off
    const shown = await prisma.changeGroup.findMany({
      where: historyWhere({ sandboxId: w.sandboxId, scope, includeSystem: true }),
    });
    expect(shown).toHaveLength(1);
  });

  it('AC-05-8: a bulk pause of 3 line items writes 3 groups with one bulkJobId', async () => {
    const items = await Promise.all(
      [1, 2, 3].map((n) =>
        prisma.lineItem.create({
          data: {
            sandboxId: w.sandboxId,
            ioId: w.ioId,
            campaignId: w.campaignId,
            advertiserId: w.advertiserId,
            name: `Bulk LI ${n}`,
            type: 'DISPLAY',
            status: 'ACTIVE',
          },
        }),
      ),
    );
    const bulkJobId = `bulk-${w.tag}`;
    for (const li of items) {
      await withChangeLog(
        ctx({ bulkJobId, source: 'BULK_EDIT' }),
        { type: 'LINE_ITEM', id: li.id, chain: { ...chain(), lineItemId: li.id } },
        (tx) => tx.lineItem.update({ where: { id: li.id }, data: { status: 'PAUSED' } }),
        { registry: lineItemTestRegistry },
      );
    }
    const groups = await prisma.changeGroup.findMany({
      where: { sandboxId: w.sandboxId, bulkJobId },
    });
    expect(groups).toHaveLength(3);
    expect(new Set(groups.map((g) => g.source))).toEqual(new Set(['BULK_EDIT']));
    const onLi = await prisma.changeGroup.findMany({
      where: historyWhere({ sandboxId: w.sandboxId, scope: { lineItemId: items[0]!.id } }),
    });
    expect(onLi).toHaveLength(1);
    const onAdvertiser = await prisma.changeGroup.findMany({
      where: {
        ...historyWhere({ sandboxId: w.sandboxId, scope: { advertiserId: w.advertiserId } }),
        bulkJobId,
      },
    });
    expect(onAdvertiser).toHaveLength(3);
  });

  it('a hard delete writes one DELETE entry and the group survives the row', async () => {
    const ag = await prisma.adGroup.create({
      data: {
        sandboxId: w.sandboxId,
        lineItemId: w.lineItemId,
        advertiserId: w.advertiserId,
        name: 'Doomed',
      },
    });
    await withChangeLog(
      ctx(),
      { type: 'AD_GROUP', id: ag.id, chain: { ...chain(), lineItemId: w.lineItemId } },
      (tx) => tx.adGroup.delete({ where: { id: ag.id } }),
      { registry: adGroupTestRegistry },
    );
    expect(await prisma.adGroup.findUnique({ where: { id: ag.id } })).toBeNull();
    const [g] = await groupsFor(ag.id);
    expect(g!.summary).toBe('1 ad group deleted');
    expect(g!.entries[0]).toMatchObject({ kind: 'DELETE', oldValue: 'Doomed' });
  });

  it('rolls the mutation back when it throws, and writes no group', async () => {
    const before = (await groupsFor(w.ioId)).length;
    await expect(
      withChangeLog(
        ctx(),
        { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
        async (tx) => {
          await tx.insertionOrder.update({
            where: { id: w.ioId },
            data: { name: 'Should not stick' },
          });
          throw new Error('boom');
        },
        { registry: ioTestRegistry },
      ),
    ).rejects.toThrow('boom');
    expect((await groupsFor(w.ioId)).length).toBe(before);
    const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
    expect(io.name).not.toBe('Should not stick');
  });

  it('idempotency: the same key within 10 minutes writes no second group', async () => {
    const key = `idem-${w.tag}`;
    const run = (name: string, onDuplicate?: () => string) =>
      withChangeLog(
        ctx({ idempotencyKey: key }),
        { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
        async (tx) => {
          await tx.insertionOrder.update({ where: { id: w.ioId }, data: { name } });
          return 'applied';
        },
        { registry: ioTestRegistry, ...(onDuplicate ? { onDuplicate } : {}) },
      );
    expect(await run('Idempotent name')).toBe('applied');
    const count = (await groupsFor(w.ioId)).length;
    await expect(run('Retried name')).rejects.toBeInstanceOf(DuplicateChangeError);
    expect(await run('Retried name', () => 'prior')).toBe('prior');
    expect((await groupsFor(w.ioId)).length).toBe(count);
    const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
    expect(io.name).toBe('Idempotent name'); // the retried mutation did not run
  });

  it('joins a transaction the caller opened, and refuses a different sandbox', async () => {
    await withSandbox(w.sandboxId, async (tx) => {
      await withChangeLog(
        ctx({ tx }),
        { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
        (t) => t.insertionOrder.update({ where: { id: w.ioId }, data: { name: 'Joined' } }),
        { registry: ioTestRegistry },
      );
    });
    expect((await groupsFor(w.ioId)).at(-1)!.entries[0]!.newValue).toBe('Joined');
    await expect(
      withSandbox(w.sandboxId, (tx) =>
        withChangeLog(
          ctx({ tx, sandboxId: 'some-other-sandbox' }),
          { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
          (t) => t.insertionOrder.update({ where: { id: w.ioId }, data: { name: 'Nope' } }),
          { registry: ioTestRegistry },
        ),
      ),
    ).rejects.toThrow(/differs from the sandbox/);
  });

  it('system actors: seed writes are hidden, engine writes need the include-system toggle', async () => {
    await withChangeLog(
      ctx({ actor: { type: 'SYSTEM', systemActor: 'SIM_SEED' }, bypass: true, source: 'SEED' }),
      { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
      (tx) => tx.insertionOrder.update({ where: { id: w.ioId }, data: { name: 'Seeded name' } }),
      { registry: ioTestRegistry },
    );
    await withChangeLog(
      ctx({ actor: { type: 'SYSTEM', systemActor: 'SIM_ENGINE' }, bypass: true, source: 'ENGINE' }),
      { type: 'INSERTION_ORDER', id: w.ioId, chain: chain() },
      (tx) => tx.insertionOrder.update({ where: { id: w.ioId }, data: { name: 'Engine name' } }),
      { registry: ioTestRegistry, summary: 'Budget allocated automatically' },
    );
    const base = { sandboxId: w.sandboxId, scope: { ioId: w.ioId } } as const;
    const userOnly = await prisma.changeGroup.findMany({ where: historyWhere(base) });
    const withSystem = await prisma.changeGroup.findMany({
      where: historyWhere({ ...base, includeSystem: true }),
    });
    const everything = await prisma.changeGroup.findMany({
      where: historyWhere({ ...base, includeSystem: true, includeHidden: true }),
    });
    expect(userOnly.every((g) => g.actorType === 'USER')).toBe(true);
    expect(withSystem.some((g) => g.systemActor === 'SIM_ENGINE')).toBe(true);
    expect(withSystem.some((g) => g.systemActor === 'SIM_SEED')).toBe(false);
    expect(everything.some((g) => g.systemActor === 'SIM_SEED' && g.isHidden)).toBe(true);
    expect(withSystem.find((g) => g.systemActor === 'SIM_ENGINE')!.summary).toBe(
      'Budget allocated automatically',
    );
  });

  it('throws when no registry exists for the entity type', async () => {
    await expect(
      withChangeLog(ctx(), { type: 'DEAL', id: 'x', chain: {} }, () =>
        Promise.resolve('unreachable'),
      ),
    ).rejects.toBeInstanceOf(MissingRegistryError);
  });
});
