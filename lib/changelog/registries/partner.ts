// Partner settings registry (module 02 4.4 to 4.7, P4-09). Every Partner column is registered or ignored; the lists are
// the enabled exchanges, the data protection contacts and the feature flags, so one save logs "1 ad exchange added".
import type { Prisma } from '@prisma/client';
import { peopleByIds } from '@/lib/accounts/directory';
import type { Tx } from '@/lib/db';
import type { EntityRegistry, FieldDef, Image } from '../registry-types';

const scalar = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

const exchangeChildren: FieldDef[] = [
  { path: 'networkId', label: 'Network ID', kind: 'text' },
  { path: 'agencyId', label: 'Agency ID', kind: 'text' },
  { path: 'seatId', label: 'Seat ID', kind: 'text' },
];

const contactChildren: FieldDef[] = [
  { path: 'name', label: 'Name', kind: 'text' },
  { path: 'email', label: 'Email', kind: 'text' },
  { path: 'address', label: 'Address', kind: 'text' },
  { path: 'phone', label: 'Phone number', kind: 'text' },
  { path: 'isContactPerson', label: 'Person to be contacted', kind: 'bool' },
];

const flagChildren: FieldDef[] = [
  { path: 'enabled', label: 'Enabled', kind: 'bool' },
  { path: 'scope', label: 'Enabled advertisers', kind: 'enum' },
  { path: 'advertiserKey', label: 'Selected advertisers', kind: 'text' },
];

const ROLE_LABEL: Record<string, string> = {
  PRIMARY: 'Primary contact',
  DATA_PROTECTION_OFFICER: 'Data protection officer',
  EU_REPRESENTATIVE: 'EU representative',
};

const partnerInclude = {
  exchanges: { where: { enabled: true }, include: { exchange: { select: { name: true } } } },
  partnerContacts: true,
  partnerFeatureFlags: { include: { advertisers: { select: { advertiserId: true } } } },
  advertisers: { select: { id: true, name: true } },
} satisfies Prisma.PartnerInclude;

const DV_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  STANDARD: 'Standard',
  READ_ONLY: 'Read only',
  REPORTING_ONLY: 'Reporting only',
  PARTNER_CLIENT: 'Partner client',
  CREATIVE: 'Creative',
};

/** Users of the sandbox as a list: sandbox contacts and real accounts that hold a grant here (module 02 4.9). */
async function loadUsers(
  tx: Tx,
  sandboxId: string,
  partnerId: string,
  advertisers: { id: string; name: string }[],
) {
  const scope = (g: { partnerId: string | null; advertiserId: string | null }) =>
    g.advertiserId
      ? (advertisers.find((a) => a.id === g.advertiserId)?.name ?? g.advertiserId)
      : g.partnerId === partnerId
        ? 'Partner'
        : String(g.partnerId);
  const access = (
    grants: { partnerId: string | null; advertiserId: string | null; role: string }[],
  ) =>
    grants
      .map((g) => `${scope(g)}: ${DV_LABEL[g.role] ?? g.role}`)
      .sort()
      .join('; ');
  const [contacts, grants] = await Promise.all([
    tx.sandboxContact.findMany({ where: { sandboxId }, include: { grants: true } }),
    tx.userAccessGrant.findMany({ where: { sandboxId } }),
  ]);
  // The tenant role cannot read the global User table, so names come from the plain client (reads only).
  const people = await peopleByIds(grants.map((g) => g.userId));
  const real = new Map<
    string,
    { id: string; name: string; email: string; grants: typeof grants }
  >();
  for (const g of grants) {
    const person = people.find((x) => x.id === g.userId);
    const row = real.get(g.userId) ?? {
      id: `u:${g.userId}`,
      name: person?.name ?? 'User',
      email: person?.email ?? g.userId,
      grants: [],
    };
    row.grants.push(g);
    real.set(g.userId, row);
  }
  return [
    ...contacts.map((c) => ({
      id: `c:${c.id}`,
      name: c.name,
      email: c.email,
      access: access(c.grants),
    })),
    ...[...real.values()].map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      access: access(r.grants),
    })),
  ].sort((a, b) => a.email.localeCompare(b.email));
}

async function loadPartner(tx: Tx, id: string): Promise<Image | null> {
  const p = await tx.partner.findUnique({ where: { id }, include: partnerInclude });
  if (!p) return null;
  const { exchanges, partnerContacts, partnerFeatureFlags, advertisers, ...rest } = p;
  return {
    ...rest,
    users: await loadUsers(tx, p.sandboxId, p.id, advertisers),
    exchanges: exchanges
      .map((e) => ({
        id: e.exchangeId,
        name: e.exchange.name,
        networkId: e.networkId,
        agencyId: e.agencyId,
        seatId: e.seatId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    contacts: partnerContacts
      .map((c) => ({
        id: c.role,
        name: c.name,
        email: c.email,
        address: c.address,
        phone: c.phone,
        isContactPerson: c.isContactPerson,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    featureFlags: partnerFeatureFlags
      .map((f) => ({
        id: f.key,
        enabled: f.enabled,
        scope: f.scope,
        advertiserKey: f.advertisers
          .map((a) => a.advertiserId)
          .sort()
          .join(','),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export const partnerRegistry: EntityRegistry = {
  entityType: 'PARTNER',
  model: 'Partner',
  noun: 'partner',
  version: 1,
  load: loadPartner,
  fields: [
    scalar('id', 'ID'),
    scalar('sandboxId', 'Sandbox'),
    scalar('publicId', 'Partner ID'),
    { path: 'name', label: 'Partner name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'timeZone', label: 'Time zone', kind: 'scalar' },
    { path: 'currencyCode', label: 'Currency', kind: 'scalar' },
    { path: 'nielsenContractCountry', label: 'Nielsen contract country', kind: 'text' },
    {
      path: 'includeDataInCmTransfer',
      label: 'Include data in CM360 Data Transfer reports',
      kind: 'bool',
    },
    { path: 'reportCostToCm', label: 'Report cost to CM360', kind: 'bool' },
    { path: 'autoEnableNewExchanges', label: 'Automatically enable new exchanges', kind: 'bool' },
    { path: 'sdfVersion', label: 'SDF version', kind: 'enum' },
    { path: 'sdfAdminEmail', label: 'SDF administrator email', kind: 'text' },
    { path: 'dataTermsAcceptedAt', label: 'Data protection terms accepted', kind: 'date' },
    { path: 'version', label: 'Version', kind: 'scalar', ignore: true },
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    {
      path: 'exchanges',
      label: 'Exchanges',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => String(el.name),
      elementNoun: 'ad exchange',
      childFields: exchangeChildren,
    },
    {
      path: 'contacts',
      label: 'Data protection contacts',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => ROLE_LABEL[String(el.id)] ?? String(el.id),
      elementNoun: 'contact',
      childFields: contactChildren,
    },
    {
      path: 'users',
      label: 'Users',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => String(el.email),
      elementNoun: 'user',
      childFields: [
        { path: 'name', label: 'Name', kind: 'text' },
        { path: 'access', label: 'Access', kind: 'text' },
      ],
    },
    {
      path: 'featureFlags',
      label: 'Advertiser configurations',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => String(el.id),
      elementNoun: 'configuration',
      childFields: flagChildren,
    },
  ],
};
