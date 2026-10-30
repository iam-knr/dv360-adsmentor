import { describe, expect, it } from 'vitest';
import { actorText, entityNoun, entryLines, fieldDefFor, registryOrNull } from '@/lib/history/lines';
import { ageLabel } from '@/lib/history/age';

describe('history lines', () => {
  const io = registryOrNull('INSERTION_ORDER');
  it('finds top level and nested list fields in a registry', () => {
    expect(io).not.toBeNull();
    expect(fieldDefFor(io, 'name')?.label).toBeTruthy();
    expect(fieldDefFor(io, 'nope')).toBeUndefined();
    expect(fieldDefFor(null, 'name')).toBeUndefined();
  });
  it('renders update, status and list lines through the shared renderer', () => {
    const lines = entryLines(io, [
      { kind: 'UPDATE', fieldPath: 'name', label: 'Name', oldValue: 'A', newValue: 'B' },
      { kind: 'STATUS_CHANGE', fieldPath: 'status', label: 'Status', oldValue: 'ACTIVE', newValue: 'PAUSED' },
      { kind: 'UPDATE', fieldPath: 'segments[s1].amount', label: 'Budget', oldValue: '5000.00', newValue: '7000.00', parentPath: 'Budget segment 1' },
    ]);
    expect(lines[0]).toBe('Name changed from "A" to "B"');
    expect(lines[1]).toBe('Status changed from "Active" to "Paused"');
    expect(lines[2]).toBe('Budget segment 1: Budget changed from "5000.00" to "7000.00"');
  });
  it('labels actors: users by email, system actors by their label', () => {
    expect(actorText({ actorType: 'USER', actorLabel: 'a@example.test', systemActor: null })).toBe('a@example.test');
    expect(actorText({ actorType: 'SYSTEM', actorLabel: null, systemActor: 'SIM_ENGINE' })).toBe('Simulator engine');
    expect(actorText({ actorType: 'SYSTEM', actorLabel: null, systemActor: 'CREATIVE_APPROVAL_SYNC' })).toBe('CREATIVE_APPROVAL_SYNC');
    expect(actorText({ actorType: 'SYSTEM', actorLabel: null, systemActor: 'SIM_INSTRUCTOR' })).toBe('Instructor');
  });
  it('names entity types in lower case singular', () => {
    expect(entityNoun('INSERTION_ORDER')).toBe('insertion order');
    expect(entityNoun('LINE_ITEM')).toBe('line item');
  });
});

describe('ageLabel (AC-05-25)', () => {
  const now = new Date('2026-03-26T12:00:00Z');
  it('formats minutes, hours and days', () => {
    expect(ageLabel(new Date('2026-03-26T11:55:00Z'), now)).toBe('5 m');
    expect(ageLabel(new Date('2026-03-26T09:00:00Z'), now)).toBe('3 h');
    expect(ageLabel(new Date('2026-03-17T12:00:00Z'), now)).toBe('9 d');
    expect(ageLabel(new Date('2026-03-26T12:00:30Z'), now)).toBe('0 m');
  });
});
