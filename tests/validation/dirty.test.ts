// Unsaved Changes dirty rules (validation.md 5.1, D-01..D-05) and the dialog catalogue (5.2).
import { describe, expect, it } from 'vitest';
import {
  archiveCascadeNote,
  commitSlideOver,
  DIALOGS,
  isDirty,
  MSG,
  normalizeForDirty,
  renderDialog,
} from '@/lib/validation';
import { validIo } from '@/lib/validation/testing/fixtures';

describe('isDirty', () => {
  const initial = { name: 'Fixture IO', budget: { segments: [{ amount: 100 }] }, changeNote: '' };

  it('D-01 editing the name and restoring it is clean', () => {
    const edited = { ...initial, name: 'Other' };
    expect(isDirty(edited, initial)).toBe(true);
    expect(isDirty({ ...edited, name: 'Fixture IO' }, initial)).toBe(false);
  });

  it('D-02 empty trailing budget rows do not count', () => {
    const rows = {
      ...initial,
      budget: { segments: [{ amount: 100 }, { amount: '' }, { amount: null }] },
    };
    expect(isDirty(rows, initial)).toBe(false);
    const campaign = {
      budgets: [
        { name: 'Q4', amount: 5 },
        { name: '', amount: null },
      ],
    };
    expect(isDirty(campaign, { budgets: [{ name: 'Q4', amount: 5 }] })).toBe(false);
  });

  it('an empty row in the middle still counts', () => {
    const middle = { ...initial, budget: { segments: [{ amount: '' }, { amount: 100 }] } };
    expect(isDirty(middle, initial)).toBe(true);
  });

  it('D-03 a change note alone does not make the form dirty', () => {
    expect(isDirty({ ...initial, changeNote: 'because' }, initial)).toBe(false);
  });

  it('D-04 changing the IO name is dirty, and the dialog is DLG-01', () => {
    const io = validIo();
    expect(isDirty({ ...io, name: 'Renamed' }, io)).toBe(true);
    expect(DIALOGS['DLG-01'].title).toBe('Unsaved Changes');
  });

  it('D-05 cancelling a slide-over leaves the parent clean, applying makes it dirty', () => {
    const parent = { targeting: { dimensions: ['GEOGRAPHY'] } };
    const edits = { targeting: { dimensions: ['GEOGRAPHY', 'LANGUAGE'] } };
    expect(isDirty(commitSlideOver(parent, edits, 'cancel'), parent)).toBe(false);
    expect(isDirty(commitSlideOver(parent, edits, 'apply'), parent)).toBe(true);
  });

  it('trims strings and ignores the order of unordered lists', () => {
    expect(isDirty({ name: ' a ' }, { name: 'a' })).toBe(false);
    expect(isDirty({ creatives: ['b', 'a'] }, { creatives: ['a', 'b'] })).toBe(false);
    expect(
      isDirty(
        { budget: { segments: [{ amount: 1 }, { amount: 2 }] } },
        { budget: { segments: [{ amount: 2 }, { amount: 1 }] } },
      ),
    ).toBe(true);
  });

  it('skips locked fields and counters when asked', () => {
    expect(isDirty({ a: 1, locked: 'x' }, { a: 1, locked: 'y' }, { ignore: ['locked'] })).toBe(
      false,
    );
    expect(normalizeForDirty({ b: undefined, a: 1 })).toEqual({ a: 1 });
  });

  it('treats a missing key and an undefined value the same', () => {
    expect(isDirty({ a: 1, b: undefined }, { a: 1 })).toBe(false);
  });
});

describe('dialogs', () => {
  it('DLG-01 is the Unsaved Changes modal with the safe button focused', () => {
    const d = DIALOGS['DLG-01'];
    expect(d.body).toBe(MSG.UNSAVED_BODY);
    expect(d.buttons).toEqual(['Discard changes', 'Continue editing']);
    expect(d.initialFocus).toBe('Continue editing');
    expect(d.safeButton).toBe('Continue editing');
  });

  it('fills placeholders and keeps unknown ones visible', () => {
    expect(renderDialog('DLG-03', { n: 2, entity: 'campaigns' }).title).toBe(
      'Archive 2 campaigns?',
    );
    expect(renderDialog('DLG-05', { name: 'Acme', date: '4 Nov' }).body).toContain('until 4 Nov.');
    expect(renderDialog('DLG-05', { name: 'Acme' }).body).toContain('{date}');
  });

  it('DLG-12 carries the Demand Gen prerequisite', () => {
    expect(DIALOGS['DLG-12'].body).toBe(MSG.DG_PREREQ);
    expect(DIALOGS['DLG-12'].bullets).toEqual([MSG.DG_PREREQ_BULLET]);
  });

  it('DLG-03 names the cascade for campaigns and IOs only', () => {
    expect(archiveCascadeNote('campaign')).toBe(
      'Their insertion orders and line items will also be archived.',
    );
    expect(archiveCascadeNote('insertionOrder')).toBe('Their line items will also be archived.');
    expect(archiveCascadeNote('lineItem')).toBeNull();
  });
});
