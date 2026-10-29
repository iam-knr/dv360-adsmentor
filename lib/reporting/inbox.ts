import 'server-only';
// In-app delivery of scheduled report runs (module 16 Δ16-5): the bell lists the viewer's `InboxMessage` rows.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';

export interface InboxEntry {
  id: string;
  title: string;
  body: string;
  /** Link to the report's file list, when the run still exists. */
  href: string | null;
  read: boolean;
  at: string;
}

export async function loadInbox(user: SessionUser): Promise<InboxEntry[]> {
  const sandboxId = user.sandboxId;
  if (!sandboxId) return [];
  return withSandbox(sandboxId, async (tx) => {
    const rows = await tx.inboxMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAtSim: 'desc' },
      take: 10,
    });
    const runIds = rows.map((r) => r.reportRunId).filter((x): x is string => !!x);
    const runs = runIds.length
      ? await tx.reportRun.findMany({
          where: { id: { in: runIds } },
          select: { id: true, report: { select: { id: true, kind: true, partner: { select: { publicId: true } } } } },
        })
      : [];
    const hrefOf = new Map(
      runs.map((r) => [
        r.id,
        `/p/${r.report.partner.publicId}/reporting/${r.report.kind === 'INSTANT' ? 'instant' : 'offline'}/${r.report.id}/runs`,
      ]),
    );
    return rows.map((m) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      href: m.reportRunId ? (hrefOf.get(m.reportRunId) ?? null) : null,
      read: !!m.readAt,
      at: m.createdAtSim.toISOString(),
    }));
  });
}

export async function markInboxRead(user: SessionUser): Promise<void> {
  if (!user.sandboxId) return;
  await withSandbox(user.sandboxId, (tx) =>
    tx.inboxMessage.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    }),
  );
}
