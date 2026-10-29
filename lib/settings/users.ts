import 'server-only';
// DV360 Users page (module 02 4.9; S8 to S11). These are the roles *inside a sandbox* and a different system from the
// account levels of /manage (module 19). Colleagues added here are sandbox-local contacts: no password, no sign in.
import { withChangeLog } from '@/lib/changelog';
import { prisma, withSandbox, type Tx } from '@/lib/db';
import type { DvRole, SessionUser } from '@/lib/auth/types';
import { DV_ROLE_LABEL, DV_ROLE_ORDER } from './constants';
import {
  lastAdmin,
  ownAccess,
  roleSummary,
  userExists,
  validateUser,
  type SettingsIssue,
  type UserAccessInput,
} from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  failIf,
  forbidden,
  mayDo,
  notFound,
  serviceCtx,
  type Result,
  type ServiceCtx,
} from './kit';

export interface UserAccessRow {
  partnerId: string | null; // row ids
  advertiserId: string | null;
  role: DvRole;
}

export interface UserRow {
  id: string; // "u:<userId>" (a login user holding a grant here) or "c:<contactId>" (sandbox contact)
  name: string;
  email: string;
  simulated: boolean;
  access: UserAccessRow[];
  roles: string; // "Standard, Read only"
  partners: string; // comma list of public ids
  advertisers: string;
}

export interface UsersPage {
  profile: UserRow;
  rows: UserRow[];
  canManage: boolean;
  limitedAccess: boolean;
  partners: { id: string; publicId: string; name: string }[];
  advertisers: { id: string; publicId: string; name: string; partnerId: string }[];
}

const isDvRole = (v: unknown): v is DvRole => DV_ROLE_ORDER.includes(v as DvRole);

async function scopeLists(tx: Tx) {
  const [partners, advertisers] = await Promise.all([
    tx.partner.findMany({
      select: { id: true, publicId: true, name: true },
      orderBy: { name: 'asc' },
    }),
    tx.advertiser.findMany({
      select: { id: true, publicId: true, name: true, partnerId: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { partners, advertisers };
}

function toRow(
  base: { id: string; name: string; email: string; simulated: boolean },
  grants: { partnerId: string | null; advertiserId: string | null; role: string }[],
  lists: Awaited<ReturnType<typeof scopeLists>>,
): UserRow {
  const access: UserAccessRow[] = grants
    .filter((g) => isDvRole(g.role))
    .map((g) => ({ partnerId: g.partnerId, advertiserId: g.advertiserId, role: g.role as DvRole }));
  const pub = (id: string | null, list: { id: string; publicId: bigint }[]) =>
    list.find((x) => x.id === id)?.publicId.toString();
  return {
    ...base,
    access,
    roles: roleSummary(
      access.map((a) => a.role),
      DV_ROLE_LABEL,
    ),
    partners: [
      ...new Set(access.map((a) => pub(a.partnerId, lists.partners)).filter(Boolean)),
    ].join(', '),
    advertisers: [
      ...new Set(access.map((a) => pub(a.advertiserId, lists.advertisers)).filter(Boolean)),
    ].join(', '),
  };
}

export async function listUsers(
  user: SessionUser,
  query: { q?: string; role?: DvRole[] } = {},
): Promise<Result<UsersPage>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const lists = await scopeLists(tx);
      const selfId = (user.actor ?? user).id;
      const [contacts, grants] = await Promise.all([
        tx.sandboxContact.findMany({
          where: { sandboxId: ctx.sandboxId },
          include: { grants: true },
          orderBy: { email: 'asc' },
        }),
        tx.userAccessGrant.findMany({ where: { sandboxId: ctx.sandboxId } }),
      ]);
      // The tenant role cannot read the global User table: names come from the plain client (reads only).
      const people = await prisma.user.findMany({
        where: { id: { in: [...new Set(grants.map((g) => g.userId))] } },
        select: { id: true, name: true, email: true },
      });
      const byUser = new Map<
        string,
        { user: { id: string; name: string; email: string }; grants: typeof grants }
      >();
      for (const g of grants) {
        const e = byUser.get(g.userId) ?? {
          user: people.find((p) => p.id === g.userId) ?? {
            id: g.userId,
            name: 'User',
            email: g.userId,
          },
          grants: [],
        };
        e.grants.push(g);
        byUser.set(g.userId, e);
      }
      const realRows = [...byUser.values()].map((e) =>
        toRow(
          { id: `u:${e.user.id}`, name: e.user.name, email: e.user.email, simulated: false },
          e.grants,
          lists,
        ),
      );
      const profile =
        realRows.find((r) => r.id === `u:${selfId}`) ??
        toRow(
          { id: `u:${selfId}`, name: user.name, email: user.email, simulated: false },
          [{ partnerId: user.partnerId ?? null, advertiserId: null, role: user.dvRole }],
          lists,
        );
      let rows = [
        ...realRows.filter((r) => r.id !== profile.id),
        ...contacts.map((c) =>
          toRow(
            { id: `c:${c.id}`, name: c.name, email: c.email, simulated: true },
            c.grants,
            lists,
          ),
        ),
      ];
      const q = query.q?.trim().toLowerCase();
      if (q)
        rows = rows.filter(
          (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
        );
      if (query.role?.length)
        rows = rows.filter((r) => r.access.some((a) => query.role?.includes(a.role)));
      rows.sort((a, b) => a.email.localeCompare(b.email));
      return {
        data: {
          profile,
          rows,
          canManage: mayDo(ctx, 'user.manage'),
          limitedAccess: user.dvRole === 'READ_ONLY' || user.dvRole === 'PARTNER_CLIENT',
          partners: lists.partners.map((p) => ({
            id: p.id,
            publicId: p.publicId.toString(),
            name: p.name,
          })),
          advertisers: lists.advertisers.map((a) => ({
            id: a.id,
            publicId: a.publicId.toString(),
            name: a.name,
            partnerId: a.partnerId,
          })),
        },
      };
    });
  });
}

export async function getUser(
  user: SessionUser,
  id: string,
): Promise<Result<{ user: UserRow; page: Omit<UsersPage, 'rows' | 'profile'> }>> {
  return asResult(async () => {
    const res = await listUsers(user);
    if (!res.ok) throw notFound();
    const found =
      res.data.rows.find((r) => r.id === id) ??
      (res.data.profile.id === id ? res.data.profile : null);
    if (!found) throw notFound();
    const { rows: _rows, profile: _profile, ...page } = res.data;
    void _rows;
    void _profile;
    return { data: { user: found, page } };
  });
}

/** Counts the partner's Admin grants across contacts and login users, optionally leaving one holder out. */
async function adminCount(
  tx: Tx,
  sandboxId: string,
  partnerId: string,
  without?: string,
): Promise<number> {
  const [c, u] = await Promise.all([
    tx.sandboxContactGrant.findMany({
      where: { sandboxId, partnerId, role: 'ADMIN' },
      select: { contactId: true },
    }),
    tx.userAccessGrant.findMany({
      where: { sandboxId, partnerId, role: 'ADMIN' },
      select: { userId: true },
    }),
  ]);
  const holders = [...c.map((x) => `c:${x.contactId}`), ...u.map((x) => `u:${x.userId}`)];
  return holders.filter((h) => h !== without).length;
}

function checkAccessRows(access: UserAccessInput[]): void {
  failIf(
    validateUser({ name: 'x', email: 'x@example.test', access }).filter((i) =>
      i.path.startsWith('access'),
    ),
  );
}

async function validAccess(
  tx: Tx,
  access: UserAccessInput[],
): Promise<{ partnerId: string | null; advertiserId: string | null; role: DvRole }[]> {
  const out: { partnerId: string | null; advertiserId: string | null; role: DvRole }[] = [];
  for (const a of access) {
    if (!isDvRole(a.role))
      failIf([
        { path: 'access', severity: 'error', code: 'USR-003', message: 'A selection is required' },
      ]);
    if (a.advertiserId) {
      const adv = await tx.advertiser.findFirst({
        where: { id: a.advertiserId },
        select: { id: true, partnerId: true },
      });
      if (!adv) throw notFound();
      out.push({ partnerId: null, advertiserId: adv.id, role: a.role as DvRole });
    } else if (a.partnerId) {
      const p = await tx.partner.findFirst({ where: { id: a.partnerId }, select: { id: true } });
      if (!p) throw notFound();
      out.push({ partnerId: p.id, advertiserId: null, role: a.role as DvRole });
    } else throw notFound();
  }
  return out;
}

/** Bump the partner version inside withChangeLog so the user list diff is logged ("User added"). */
async function logOnPartner<T>(
  ctx: ServiceCtx,
  tx: Tx,
  partnerId: string,
  note: string | undefined,
  mutate: (t: Tx) => Promise<T>,
): Promise<T> {
  let out!: T;
  await withChangeLog(
    changeCtx(ctx, tx, { ...(note ? { note } : {}) }),
    { type: 'PARTNER', id: partnerId, chain: {} },
    async (t) => {
      out = await mutate(t);
      return t.partner.update({
        where: { id: partnerId },
        data: { version: { increment: 1 } },
        select: { id: true },
      });
    },
  );
  return out;
}

async function firstPartnerId(tx: Tx): Promise<string> {
  const p = await tx.partner.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!p) throw notFound();
  return p.id;
}

/** AC-02-21, AC-02-22, AC-02-23. Permission ADMIN (`user.manage`). */
export async function createUser(
  user: SessionUser,
  input: { name: string; email: string; access: UserAccessInput[] },
  note?: string,
): Promise<Result<{ id: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'user.manage');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const email = input.email.trim().toLowerCase();
      const issues: SettingsIssue[] = validateUser({ ...input, email });
      if (issues.length === 0) {
        const contact = await tx.sandboxContact.findFirst({
          where: { sandboxId: ctx.sandboxId, email },
        });
        const grantIds = (
          await tx.userAccessGrant.findMany({
            where: { sandboxId: ctx.sandboxId },
            select: { userId: true },
          })
        ).map((g) => g.userId);
        const login = grantIds.length
          ? await prisma.user.findFirst({
              where: { id: { in: grantIds }, email },
              select: { id: true },
            })
          : null;
        if (contact || login) issues.push(userExists());
      }
      failIf(issues);
      const access = await validAccess(tx, input.access);
      const partnerId = await firstPartnerId(tx);
      const created = await logOnPartner(ctx, tx, partnerId, note, (t) =>
        t.sandboxContact.create({
          data: {
            sandboxId: ctx.sandboxId,
            email,
            name: input.name.trim(),
            grants: { create: access.map((a) => ({ sandboxId: ctx.sandboxId, ...a })) },
          },
          select: { id: true },
        }),
      );
      return { data: { id: `c:${created.id}` } };
    });
  });
}

/** Replace a user's access rows and name. USR-010 last admin, USR-011 own access. */
export async function updateUser(
  user: SessionUser,
  id: string,
  input: { name?: string; access: UserAccessInput[] },
  note?: string,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'user.manage');
    const [kind, rowId] = id.split(':');
    if ((kind !== 'u' && kind !== 'c') || !rowId) throw notFound();
    return withSandbox(ctx.sandboxId, async (tx) => {
      checkAccessRows(input.access);
      const next = await validAccess(tx, input.access);
      const current =
        kind === 'c'
          ? await tx.sandboxContactGrant.findMany({ where: { contactId: rowId } })
          : await tx.userAccessGrant.findMany({
              where: { userId: rowId, sandboxId: ctx.sandboxId },
            });
      if (kind === 'c' && !(await tx.sandboxContact.findUnique({ where: { id: rowId } })))
        throw notFound();
      if (kind === 'u' && current.length === 0) throw notFound();
      const issues: SettingsIssue[] = [];
      if (kind === 'u' && rowId === (user.actor ?? user).id) {
        const rank = (r: string) => DV_ROLE_ORDER.indexOf(r as DvRole);
        const best = (rows: { role: string }[]) => Math.min(...rows.map((g) => rank(g.role)));
        if (next.length === 0 || best(next) > best(current)) issues.push(ownAccess());
      }
      const partnerIds = new Set(
        current.filter((g) => g.role === 'ADMIN' && g.partnerId).map((g) => g.partnerId as string),
      );
      for (const pid of partnerIds) {
        const stillAdmin = next.some((g) => g.partnerId === pid && g.role === 'ADMIN');
        if (!stillAdmin && (await adminCount(tx, ctx.sandboxId, pid, id)) === 0)
          issues.push(lastAdmin());
      }
      failIf(issues);
      const partnerId = await firstPartnerId(tx);
      await logOnPartner(ctx, tx, partnerId, note, async (t) => {
        if (kind === 'c') {
          await t.sandboxContactGrant.deleteMany({ where: { contactId: rowId } });
          await t.sandboxContactGrant.createMany({
            data: next.map((a) => ({ sandboxId: ctx.sandboxId, contactId: rowId, ...a })),
          });
          if (input.name?.trim())
            await t.sandboxContact.update({
              where: { id: rowId },
              data: { name: input.name.trim() },
            });
        } else {
          await t.userAccessGrant.deleteMany({
            where: { userId: rowId, sandboxId: ctx.sandboxId },
          });
          await t.userAccessGrant.createMany({
            data: next.map((a) => ({ sandboxId: ctx.sandboxId, userId: rowId, ...a })),
          });
        }
        return null;
      });
      return { data: null };
    });
  });
}

/** "Remove user": a contact is deleted; a login user loses the grants of this sandbox. USR-010 applies. */
export async function deleteUser(
  user: SessionUser,
  id: string,
  note?: string,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'user.manage');
    const [kind, rowId] = id.split(':');
    if ((kind !== 'u' && kind !== 'c') || !rowId) throw notFound();
    if (kind === 'u' && rowId === (user.actor ?? user).id) throw forbidden();
    return withSandbox(ctx.sandboxId, async (tx) => {
      const grants =
        kind === 'c'
          ? await tx.sandboxContactGrant.findMany({ where: { contactId: rowId } })
          : await tx.userAccessGrant.findMany({
              where: { userId: rowId, sandboxId: ctx.sandboxId },
            });
      if (kind === 'c' && !(await tx.sandboxContact.findUnique({ where: { id: rowId } })))
        throw notFound();
      const issues: SettingsIssue[] = [];
      for (const pid of new Set(
        grants.filter((g) => g.role === 'ADMIN' && g.partnerId).map((g) => g.partnerId as string),
      ))
        if ((await adminCount(tx, ctx.sandboxId, pid, id)) === 0) issues.push(lastAdmin());
      failIf(issues);
      const partnerId = await firstPartnerId(tx);
      await logOnPartner(ctx, tx, partnerId, note, async (t) => {
        if (kind === 'c') await t.sandboxContact.delete({ where: { id: rowId } });
        else
          await t.userAccessGrant.deleteMany({
            where: { userId: rowId, sandboxId: ctx.sandboxId },
          });
        return null;
      });
      return { data: null };
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Email preferences (S11): a user preference, exempt from the change log like module 01 C-01-1. No email is sent.
// ---------------------------------------------------------------------------------------------

export interface EmailPrefs {
  alerts: boolean;
  news: boolean;
}

export async function getEmailPreferences(user: SessionUser): Promise<Result<EmailPrefs>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const row = await tx.userEmailPreference.findUnique({
        where: { userId_sandboxId: { userId: (user.actor ?? user).id, sandboxId: ctx.sandboxId } },
      });
      return { data: { alerts: row?.alerts ?? true, news: row?.news ?? true } };
    });
  });
}

export async function saveEmailPreferences(
  user: SessionUser,
  input: EmailPrefs,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    // Anyone signed in may change their own toggles (access code ANY), but not while an admin only views as them.
    if (user.viewAs && !user.viewAs.actAs) throw forbidden();
    const userId = (user.actor ?? user).id;
    return withSandbox(ctx.sandboxId, async (tx) => {
      await tx.userEmailPreference.upsert({
        where: { userId_sandboxId: { userId, sandboxId: ctx.sandboxId } },
        create: { userId, sandboxId: ctx.sandboxId, alerts: input.alerts, news: input.news },
        update: { alerts: input.alerts, news: input.news },
      });
      return { data: null };
    });
  });
}
