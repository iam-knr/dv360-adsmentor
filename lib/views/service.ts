import 'server-only';
// Saved column views (module 11 K15): SavedView rows per person and advertiser, pin in the user prefs.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import { assertRead, assertWrite, asResult, serviceCtx, ServiceFailure, type Result } from '@/lib/campaigns/service-kit';
import { savePrefs } from '@/lib/scope/prefs';
import { customKey, GRID_COLUMNS, validateView, type CustomView, type ViewGrid } from './columns';

const invalid = (message: string) =>
  new ServiceFailure('INVALID', [{ path: 'name', severity: 'error', code: 'VIEW', message }]);

const owner = (user: SessionUser) => (user.actor ?? user).id;

export async function listViews(user: SessionUser, grid: ViewGrid, advertiserId: string): Promise<CustomView[]> {
  const ctx = await serviceCtx(user);
  assertRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const rows = await tx.savedView.findMany({
      where: { advertiserId, grid, OR: [{ ownerUserId: owner(user) }, { sharedWithSandbox: true }] },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      columns: ((r.columns as { order?: string[] })?.order ?? []) as string[],
      isPinned: r.isPinned,
    }));
  });
}

export async function saveView(
  user: SessionUser,
  grid: ViewGrid,
  advertiserId: string,
  input: { id?: string; name: string; columns: string[] },
): Promise<Result<CustomView>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    const known = new Set(GRID_COLUMNS[grid].map((c) => c.id));
    const columns = input.columns.filter((c, i, a) => known.has(c) && a.indexOf(c) === i);
    const existing = await listViews(user, grid, advertiserId);
    const problem = validateView(input.name, columns, existing, input.id);
    if (problem) throw invalid(problem);
    const row = await withSandbox(ctx.sandboxId, async (tx) => {
      if (input.id) {
        const mine = await tx.savedView.findFirst({ where: { id: input.id, ownerUserId: owner(user) } });
        if (!mine) throw new ServiceFailure('NOT_FOUND');
        return tx.savedView.update({
          where: { id: input.id },
          data: { name: input.name.trim(), columns: { order: columns }, version: { increment: 1 } },
        });
      }
      return tx.savedView.create({
        data: { sandboxId: ctx.sandboxId, advertiserId, ownerUserId: owner(user), grid, name: input.name.trim(), columns: { order: columns } },
      });
    });
    return { data: { id: row.id, name: row.name, columns, isPinned: row.isPinned } };
  });
}

export async function deleteView(user: SessionUser, id: string): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertWrite(ctx);
    await withSandbox(ctx.sandboxId, async (tx) => {
      const n = await tx.savedView.deleteMany({ where: { id, ownerUserId: owner(user) } });
      if (n.count === 0) throw new ServiceFailure('NOT_FOUND');
    });
    return { data: null };
  });
}

/** Pin a predefined key or `custom:{id}` for a grid; the choice lives in the user prefs (RT 6.2). */
export async function pinView(user: SessionUser, grid: ViewGrid, key: string, current: Record<string, string> = {}) {
  const next = { ...current, [grid]: key };
  return savePrefs(user, { pinnedColumnView: next });
}

export { customKey };
