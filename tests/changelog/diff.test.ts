import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  canonical,
  createEntries,
  diffImages,
  renderLine,
  summarise,
  type EntityRegistry,
  type FieldDef,
} from '@/lib/changelog';
import { ioTestRegistry } from './fixtures';

const reg = (fields: FieldDef[], over: Partial<EntityRegistry> = {}): EntityRegistry => ({
  entityType: 'CAMPAIGN',
  model: 'Campaign',
  noun: 'campaign',
  version: 1,
  fields,
  ...over,
});

describe('canonical values', () => {
  it('turns every kind into one stable string', () => {
    expect(canonical(null, 'text')).toBeNull();
    expect(canonical(undefined, 'text')).toBeNull();
    expect(canonical(true, 'bool')).toBe('true');
    expect(canonical(new Date('2026-03-26T00:00:00.000Z'), 'date')).toBe('2026-03-26');
    expect(canonical(new Date('2026-03-26T10:55:08.000Z'), 'date')).toBe(
      '2026-03-26T10:55:08.000Z',
    );
    expect(canonical(new Prisma.Decimal('5000'), 'money')).toBe('5000.00');
    expect(canonical(new Prisma.Decimal('5000.5'), 'money', { moneyScale: 3 })).toBe('5000.500');
    expect(canonical(new Prisma.Decimal('1.50'), 'scalar')).toBe('1.5');
    expect(canonical(12n, 'scalar')).toBe('12');
    expect(canonical(['b', 'a'], 'list')).toBe('["b","a"]');
  });

  it('does not depend on json key order', () => {
    expect(canonical({ b: 1, a: { d: 1, c: 2 } }, 'json')).toBe(
      canonical({ a: { c: 2, d: 1 }, b: 1 }, 'json'),
    );
  });
});

describe('diffImages', () => {
  const r = reg([
    { path: 'name', label: 'Name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'budget', label: 'Budget', kind: 'money' },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    { path: 'version', label: 'Version', kind: 'scalar', ignore: true },
  ]);

  it('returns nothing for identical values with different object identity', () => {
    const a = { name: 'x', status: 'ACTIVE', budget: new Prisma.Decimal('10') };
    const b = { name: 'x', status: 'ACTIVE', budget: new Prisma.Decimal('10.00') };
    expect(diffImages(r, a, b)).toEqual([]);
  });

  it('skips ignore fields', () => {
    const entries = diffImages(
      r,
      { name: 'a', updatedAt: new Date(0), version: 1 },
      { name: 'b', updatedAt: new Date(1), version: 2 },
    );
    expect(entries.map((e) => e.fieldPath)).toEqual(['name']);
  });

  it('writes registry order, canonical old and new values, and sort order', () => {
    const entries = diffImages(
      r,
      { name: 'a', status: 'ACTIVE', budget: new Prisma.Decimal('5000') },
      { name: 'b', status: 'PAUSED', budget: new Prisma.Decimal('7000') },
    );
    expect(entries.map((e) => [e.kind, e.fieldPath, e.oldValue, e.newValue, e.sortOrder])).toEqual([
      ['UPDATE', 'name', 'a', 'b', 0],
      ['STATUS_CHANGE', 'status', 'ACTIVE', 'PAUSED', 1],
      ['UPDATE', 'budget', '5000.00', '7000.00', 2],
    ]);
    expect(entries[1]!.label).toBe('Status');
  });

  it('logs a value cleared to null', () => {
    const [e] = diffImages(r, { name: 'a' }, { name: null });
    expect(e).toMatchObject({ oldValue: 'a', newValue: null });
    expect(renderLine(e!)).toBe('Name changed from "a" to "(none)"');
  });
});

describe('diffImages: lists', () => {
  const seg = (id: string, amount: string, n: number) => ({
    id,
    amount: new Prisma.Decimal(amount),
    startDate: new Date(Date.UTC(2026, 0, n)),
  });

  it('logs added and removed elements and changed element fields under a parent path', () => {
    const before = { segments: [seg('s1', '5000', 1), seg('s2', '100', 2)] };
    const after = { segments: [seg('s1', '7000', 1), seg('s3', '1', 3)] };
    const entries = diffImages(ioTestRegistry, before, after);
    expect(entries.map((e) => [e.kind, e.fieldPath, e.label, e.parentPath])).toEqual([
      ['UPDATE', 'segments[s1].amount', 'Budget', 'Budget segment 2026-01-01'],
      ['CREATE', 'segments[s3]', 'Budget segment 2026-01-03', null],
      ['DELETE', 'segments[s2]', 'Budget segment 2026-01-02', null],
    ]);
    const update = entries[0]!;
    expect(update.oldValue).toBe('5000.00');
    expect(renderLine(update, ioTestRegistry.fields.at(-1)!.childFields![0])).toBe(
      'Budget segment 2026-01-01: Budget changed from "5000.00" to "7000.00"',
    );
  });
});

describe('createEntries', () => {
  it('writes one entry per non-null field in registry order', () => {
    const r = reg([
      { path: 'name', label: 'Name', kind: 'text' },
      { path: 'notes', label: 'Notes', kind: 'text' },
      { path: 'active', label: 'Active', kind: 'bool' },
      { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
    ]);
    const entries = createEntries(r, { id: 'x', name: 'N', notes: null, active: false });
    expect(entries.map((e) => [e.kind, e.fieldPath, e.newValue])).toEqual([
      ['CREATE', 'name', 'N'],
      ['CREATE', 'active', 'false'],
    ]);
    expect(renderLine(entries[0]!)).toBe('Name is N');
  });

  it('caps at 60 entries', () => {
    const fields: FieldDef[] = Array.from({ length: 75 }, (_, i) => ({
      path: `f${i}`,
      label: `F${i}`,
      kind: 'scalar',
    }));
    const image = Object.fromEntries(fields.map((f) => [f.path, 'v']));
    const entries = createEntries(reg(fields), image);
    expect(entries).toHaveLength(60);
    expect(entries.at(-1)!.fieldPath).toBe('f59');
    expect(summarise({ kind: 'CREATE', entries, noun: 'campaign' })).toBe('60 changes made.');
  });
});

describe('summarise', () => {
  const upd = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      kind: 'UPDATE' as const,
      fieldPath: `f${i}`,
      label: 'L',
      oldValue: 'a',
      newValue: 'b',
      parentPath: null,
      sortOrder: i,
    }));

  it('counts scalar changes', () => {
    expect(summarise({ kind: 'UPDATE', entries: upd(1), noun: 'insertion order' })).toBe(
      '1 change to insertion order',
    );
    expect(summarise({ kind: 'UPDATE', entries: upd(3), noun: 'line item' })).toBe(
      '3 changes to line item',
    );
  });

  it('names a lone status change', () => {
    const entries = [
      {
        ...upd(1)[0]!,
        kind: 'STATUS_CHANGE' as const,
        fieldPath: 'status',
        newValue: 'SCHEDULED_FOR_DELETION',
      },
    ];
    expect(summarise({ kind: 'UPDATE', entries, noun: 'campaign' })).toBe(
      'Status changed to Scheduled for deletion',
    );
  });

  it('describes list additions and removals with the plural noun', () => {
    const list = { path: 'exchanges', noun: 'ad exchange', nounPlural: null };
    const mk = (kind: 'CREATE' | 'DELETE', n: number) =>
      Array.from({ length: n }, (_, i) => ({
        kind,
        fieldPath: `exchanges[${i}]`,
        label: 'E',
        oldValue: null,
        newValue: null,
        parentPath: null,
        sortOrder: i,
        list,
      }));
    expect(summarise({ kind: 'UPDATE', entries: mk('CREATE', 1), noun: 'partner' })).toBe(
      '1 ad exchange added',
    );
    expect(summarise({ kind: 'UPDATE', entries: mk('DELETE', 2), noun: 'partner' })).toBe(
      '2 ad exchanges removed',
    );
    expect(
      summarise({
        kind: 'UPDATE',
        entries: [...mk('CREATE', 2), ...mk('DELETE', 1)],
        noun: 'partner',
      }),
    ).toBe('3 changes to partner');
  });

  it('summarises a delete', () => {
    expect(summarise({ kind: 'DELETE', entries: [], noun: 'ad group' })).toBe('1 ad group deleted');
  });
});

describe('renderLine', () => {
  it('shows booleans and enum keys with display text', () => {
    const base = { kind: 'UPDATE' as const, fieldPath: 'x', label: 'Ad badging', parentPath: null };
    expect(
      renderLine(
        { ...base, oldValue: 'true', newValue: 'false' },
        { path: 'x', label: 'Ad badging', kind: 'bool' },
      ),
    ).toBe('Ad badging changed from "Checked" to "Unchecked"');
    expect(
      renderLine(
        { ...base, oldValue: 'THIRD_PARTY_ONLY', newValue: 'CM360_HYBRID' },
        { path: 'x', label: 'Ad badging', kind: 'enum' },
      ),
    ).toBe('Ad badging changed from "Third party only" to "Cm360 hybrid"');
  });
});
