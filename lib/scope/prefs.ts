import 'server-only';
// Per-user UI preferences (module 01 4.1, DELTA-01-5, routes.md 8.1 `UserPrefs`). Key value rows in UserPreference,
// one set per sandbox. Unknown keys are dropped; a value over 4 KB is refused with SHL-010. UI state: no change log.
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';

export const PREF_MAX_BYTES = 4096;
/** SHL-010 (proposed in module 01 4.1, RC-053). */
export const SHL_010 = 'Each preference can be at most 4 KB.';

const railPanel = z.enum(['advisor', 'help', 'intelligence', 'exercise']).nullable();

/** Allowed keys and their shapes. `navCollapsed` is added for the hamburger state (PR deviation note). */
export const PREF_SCHEMA = {
  pinnedCampaignTab: z.enum(['combined', 'ios', 'lis']),
  navOpen: z.record(z.string().max(64), z.boolean()),
  navCollapsed: z.boolean(),
  railLastPanel: railPanel,
  dateDefaults: z.record(z.string().max(64), z.string().max(40)),
  pinnedColumnView: z.record(z.string().max(64), z.string().max(80)),
  lastWorkspaceId: z.string().max(40),
  tutorialSectionCollapsed: z.boolean(),
} as const;

export type PrefKey = keyof typeof PREF_SCHEMA;
export type UserPrefs = { [K in PrefKey]?: z.infer<(typeof PREF_SCHEMA)[K]> };

export type PrefsResult =
  | { ok: true; prefs: UserPrefs }
  | {
      ok: false;
      issues: { code: 'SHL-010' | 'INVALID' | 'NO_SANDBOX'; key?: string; message: string }[];
    };

const KEYS = Object.keys(PREF_SCHEMA) as PrefKey[];

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value) ?? '').length;
}

/** Drop unknown keys, check size and shape. Pure, so it is unit tested without a database. */
export function cleanPrefsPatch(
  patch: Record<string, unknown>,
):
  | { ok: true; patch: UserPrefs }
  | { ok: false; issues: Extract<PrefsResult, { ok: false }>['issues'] } {
  const out: Record<string, unknown> = {};
  const issues: Extract<PrefsResult, { ok: false }>['issues'] = [];
  for (const key of Object.keys(patch)) {
    if (!(KEYS as string[]).includes(key)) continue;
    const value = patch[key];
    if (byteLength(value) > PREF_MAX_BYTES) {
      issues.push({ code: 'SHL-010', key, message: SHL_010 });
      continue;
    }
    const parsed = PREF_SCHEMA[key as PrefKey].safeParse(value);
    if (!parsed.success) {
      issues.push({ code: 'INVALID', key, message: 'Enter a valid value.' });
      continue;
    }
    out[key] = parsed.data;
  }
  return issues.length ? { ok: false, issues } : { ok: true, patch: out };
}

export async function getPrefs(user: Pick<SessionUser, 'id' | 'sandboxId'>): Promise<UserPrefs> {
  if (!user.sandboxId) return {};
  const rows = await withSandbox(user.sandboxId, (tx) =>
    tx.userPreference.findMany({
      where: { userId: user.id },
      select: { key: true, value: true },
    }),
  );
  const prefs: Record<string, unknown> = {};
  for (const r of rows) {
    const schema = PREF_SCHEMA[r.key as PrefKey];
    const parsed = schema?.safeParse(r.value);
    if (parsed?.success) prefs[r.key] = parsed.data;
  }
  return prefs;
}

/** Save a partial set of preferences (module 01 4.1 `savePrefs`). Returns the full set after the write. */
export async function savePrefs(
  user: Pick<SessionUser, 'id' | 'sandboxId' | 'viewAs'>,
  patch: Record<string, unknown>,
): Promise<PrefsResult> {
  if (!user.sandboxId) {
    return { ok: false, issues: [{ code: 'NO_SANDBOX', message: 'No practice account.' }] };
  }
  const clean = cleanPrefsPatch(patch);
  if (!clean.ok) return clean;
  // View-as never changes the student's own settings.
  if (!user.viewAs) {
    const sandboxId = user.sandboxId;
    await withSandbox(sandboxId, async (tx) => {
      for (const [key, value] of Object.entries(clean.patch)) {
        // a pref set to null means "no choice"; Prisma stores it as JSON null
        const json = value === null || value === undefined ? Prisma.JsonNull : value;
        await tx.userPreference.upsert({
          where: { userId_sandboxId_key: { userId: user.id, sandboxId, key } },
          create: { userId: user.id, sandboxId, key, value: json },
          update: { value: json },
        });
      }
    });
  }
  return { ok: true, prefs: await getPrefs(user) };
}
