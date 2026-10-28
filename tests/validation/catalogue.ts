// Case tables and the runner shared by the catalogue and coverage tests.
import { validate } from '@/lib/validation';
import { applyPatch, makeCtx } from '@/lib/validation/testing/fixtures';
import { campaignCases } from './cases.campaign';
import { genCases } from './cases.gen';
import { ioCases } from './cases.io';
import { lineItemCases } from './cases.li';
import type { Case } from './cases.types';

export const allCases: Case[] = [...genCases, ...campaignCases, ...ioCases, ...lineItemCases];

export function run(c: Case) {
  const entity = applyPatch(c.base(), c.patch);
  const ctx = makeCtx(c.ctx, c.lineItemType);
  const listed = new Set(c.expect);
  return validate(c.kind, entity, ctx, { includeInfo: true, ...c.opts }).filter(
    (i) => i.severity !== 'info' || listed.has(`${i.ruleId}:info`),
  );
}
