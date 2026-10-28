import { buildHistory } from '@/lib/seed/history-stub';
import type { SeedKnobs, TemplateKey } from '@/lib/seed/knobs';
import { buildSandboxPlan } from '@/lib/seed/plan';

export const TODAY = '2026-10-28';

export function planFor(
  template: TemplateKey,
  seedValue = 7,
  knobs?: Partial<SeedKnobs>,
  sandboxId = 'sbx-test',
) {
  return buildSandboxPlan({
    template,
    seedValue,
    sandboxId,
    classroomId: 'cls-test',
    today: TODAY,
    partnerName: 'Sandbox DEMO-1',
    knobs,
  });
}

const cache = new Map<string, ReturnType<typeof buildHistory>>();
export function historyFor(template: TemplateKey, seedValue = 7) {
  const key = `${template}:${seedValue}`;
  let h = cache.get(key);
  if (!h) cache.set(key, (h = buildHistory(planFor(template, seedValue))));
  return h;
}

export function num(v: unknown): number {
  return Number(v ?? 0);
}
