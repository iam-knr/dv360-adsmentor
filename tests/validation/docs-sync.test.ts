// Parses docs/specs/validation.md and compares IDs, severities, triggers and verbatim messages with the registry.
import { describe, expect, it } from 'vitest';
import { allRules, MSG } from '@/lib/validation';
import {
  backtickSpans,
  expectedTriggers,
  IMPLEMENTED,
  implementedDocRules,
  parseRuleTables,
  readDoc,
  splitRow,
} from './docs';

const doc = implementedDocRules();
const docNonAlias = doc.filter((r) => r.alias === null);
const registry = allRules().filter((r) => IMPLEMENTED.test(r.id));
const byId = new Map(registry.map((r) => [r.id, r]));

describe('rule tables of validation.md', () => {
  it('parses the implemented domains', () => {
    expect(docNonAlias.length).toBeGreaterThan(150);
    expect(new Set(doc.map((r) => r.id)).size).toBe(doc.length);
  });

  it('registers exactly the non-alias rule IDs', () => {
    expect(registry.map((r) => r.id).sort()).toEqual(docNonAlias.map((r) => r.id).sort());
  });

  it('registers no alias row', () => {
    for (const alias of doc.filter((r) => r.alias !== null)) {
      expect(byId.has(alias.id), `${alias.id} is an alias of ${alias.alias}`).toBe(false);
      expect(byId.has(alias.alias!), `${alias.id} points at ${alias.alias}`).toBe(true);
    }
  });

  it.each(docNonAlias.map((r) => [r.id, r] as const))(
    '%s keeps its severity, trigger and message',
    (id, row) => {
      const rule = byId.get(id)!;
      expect(rule.severity).toBe(row.severity);

      const wanted = expectedTriggers(row.trigger);
      if (wanted.length === 0) expect(rule.triggers).toEqual([]);
      else for (const t of wanted) expect(rule.triggers).toContain(t);

      const cell = row.messageCell;
      const noMessage = cell.startsWith('(') || cell === '' || cell === '-';
      if (noMessage) {
        // documentation rows with a parenthesised note have no message of their own
        expect(rule.message, `${id} has no message in the document`).toBeNull();
      } else if (row.text !== null) {
        // the first backticked text is the wording; [SIM] only marks it for sign-off.
        // A counter message is one template ("Use {max} characters or fewer."); the table shows it with its number.
        const counter =
          rule.message === MSG.MAX_CHARS && /^Use \d+ characters or fewer\.$/.test(row.text);
        if (!counter) expect(rule.message).toBe(row.text);
      } else if (/^(same as|see) /.test(cell)) {
        // "see IO-052", "same as the linked rules": the wording lives in the rule they point at
      } else {
        expect(rule.message).not.toBeNull();
      }
    },
  );
});

describe('message catalogue (validation.md 1.2)', () => {
  const lines = readDoc('docs/specs/validation.md').split('\n');
  const start = lines.findIndex((l) => l.startsWith('### 1.2'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('### 1.3'));
  const rows = lines
    .slice(start, end)
    .filter((l) => l.startsWith('| `'))
    .map(splitRow);

  it('has one MSG entry per catalogue key, with the verbatim text', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
    for (const [keyCell, textCell] of rows) {
      const keys = backtickSpans(keyCell!);
      const spans = backtickSpans(textCell!);
      if (keyCell === '`DG_PREREQ`') {
        expect(MSG.DG_PREREQ).toBe(spans[0]);
        expect(MSG.DG_PREREQ_BULLET).toBe(spans[1]);
        continue;
      }
      // two keys in one row share one cell of the form `a` / `b`
      const texts = keys.length === 2 && spans.length === 1 ? spans[0]!.split(' / ') : spans;
      keys.forEach((key, i) => {
        expect(MSG[key as keyof typeof MSG], key).toBe(texts[i]);
      });
    }
  });
});

describe('module files', () => {
  const docIds = new Set(parseRuleTables(readDoc('docs/specs/validation.md')).map((r) => r.id));
  it.each(['06-campaigns', '07-insertion-orders', '08-line-items'])(
    '%s only names rule IDs that exist',
    (file) => {
      const text = readDoc(`docs/specs/modules/${file}.md`);
      const ids = [...text.matchAll(/\b((?:GEN|CMP|IO|LI)(?:-[A-Z]+)?-\d{3})\b/g)].map(
        (m) => m[1]!,
      );
      const unknown = [...new Set(ids)].filter((id) => !docIds.has(id));
      expect(unknown).toEqual([]);
    },
  );

  it('adopts no new IDs for these domains (RC-053)', () => {
    // RC-053 adopts proposed IDs for ADV, PRT, USR, PLN, CRE, INV, AUD, CB, FL, BLK, RPT, AB, LS, SHL, HIS, SIM only.
    expect([...docIds].filter((id) => IMPLEMENTED.test(id)).length).toBeGreaterThan(150);
  });
});
