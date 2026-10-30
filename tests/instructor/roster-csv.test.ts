import { describe, expect, it } from 'vitest';
import { parseRosterCsv, sandboxLabel } from '@/lib/instructor/roster';
import { confirmsClassName, windowWarnings, checkClassName } from '@/lib/instructor/rules';

describe('roster CSV (SIM-008)', () => {
  it('reads name,email with a header, in any column order, and lower-cases emails', () => {
    const r = parseRosterCsv('email,name\nAsha@Example.Test,Asha Rao\nbo@example.test,"Bo, Jr."\n');
    expect(r.errors).toEqual([]);
    expect(r.students).toEqual([
      { name: 'Asha Rao', email: 'asha@example.test' },
      { name: 'Bo, Jr.', email: 'bo@example.test' },
    ]);
  });
  it('reports each bad row with its line number and still returns the good rows', () => {
    const r = parseRosterCsv('name,email\nA,a@example.test\n,b@example.test\nC,not-an-email\nD,a@example.test\nE,e@example.test');
    expect(r.students.map((s) => s.email)).toEqual(['a@example.test', 'e@example.test']);
    expect(r.errors).toEqual([
      { row: 3, message: 'Enter a name.' },
      { row: 4, message: 'Enter a valid email address.' },
      { row: 5, message: 'This email is already in the file.' },
    ]);
  });
  it('needs the name and email columns', () => {
    expect(parseRosterCsv('a,b\n1,2').errors[0]?.message).toBe('Columns needed: name,email.');
    expect(parseRosterCsv('').errors[0]?.message).toBe('The file is empty.');
  });
  it('caps the file at 200 rows', () => {
    const rows = Array.from({ length: 201 }, (_, i) => `S${i},s${i}@example.test`).join('\n');
    const r = parseRosterCsv(`name,email\n${rows}`);
    expect(r.students).toHaveLength(200);
    expect(r.errors.some((e) => e.message === 'Use 200 rows or fewer.')).toBe(true);
  });
  it('strips a byte order mark and blank lines', () => {
    const r = parseRosterCsv('﻿name,email\n\nA,a@example.test\n\n');
    expect(r.students).toHaveLength(1);
  });
});

describe('sandbox label', () => {
  it.each([
    [null, 'NOT CREATED'],
    [{ status: 'ARCHIVED', provisionState: 'READY' }, 'NOT CREATED'],
    [{ status: 'ACTIVE', provisionState: 'FAILED' }, 'FAILED'],
    [{ status: 'RESETTING', provisionState: 'READY' }, 'RESETTING'],
    [{ status: 'ACTIVE', provisionState: 'SEEDING' }, 'PREPARING'],
    [{ status: 'FROZEN', provisionState: 'READY' }, 'FROZEN'],
    [{ status: 'ACTIVE', provisionState: 'READY' }, 'READY'],
  ] as const)('%j is %s', (sb, label) => {
    expect(sandboxLabel(sb)).toBe(label);
  });
});

describe('console rules', () => {
  it('SIM-006 warns under 15 minutes only', () => {
    const t = new Date('2026-11-02T04:30:00Z');
    expect(windowWarnings(t, new Date(t.getTime() + 14 * 60_000))).toEqual(['This window is very short.']);
    expect(windowWarnings(t, new Date(t.getTime() + 15 * 60_000))).toEqual([]);
  });
  it('SIM-009 matches the class name ignoring case and outer spaces', () => {
    expect(confirmsClassName('  spring batch ', 'Spring Batch')).toBe(true);
    expect(confirmsClassName('Spring', 'Spring Batch')).toBe(false);
    expect(confirmsClassName(undefined, 'Spring Batch')).toBe(false);
  });
  it('SIM-004 checks the class name', () => {
    expect(checkClassName('  ')).toBe('Enter a value');
    expect(checkClassName('x'.repeat(101))).toBe('Use 100 characters or fewer.');
    expect(checkClassName('ok')).toBeNull();
  });
});
