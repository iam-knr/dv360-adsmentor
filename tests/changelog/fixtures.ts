// Test-only registries. The real IO, line item and partner registries belong to their module sessions.
import type { EntityRegistry } from '@/lib/changelog';

const str = (s: unknown) => String(s);

export const ioTestRegistry: EntityRegistry = {
  entityType: 'INSERTION_ORDER',
  model: 'InsertionOrder',
  noun: 'insertion order',
  version: 1,
  include: { segments: true },
  fields: [
    { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
    { path: 'name', label: 'Name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'objective', label: 'Objective', kind: 'enum' },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    { path: 'version', label: 'Version', kind: 'scalar', ignore: true },
    {
      path: 'segments',
      label: 'Budget segments',
      kind: 'list',
      elementNoun: 'budget segment',
      elementKey: (el) => str(el.id),
      elementLabel: (el) =>
        `Budget segment ${el.startDate instanceof Date ? el.startDate.toISOString().slice(0, 10) : str(el.startDate)}`,
      childFields: [
        { path: 'amount', label: 'Budget', kind: 'money' },
        { path: 'startDate', label: 'Start date', kind: 'date' },
      ],
    },
  ],
};

export const lineItemTestRegistry: EntityRegistry = {
  entityType: 'LINE_ITEM',
  model: 'LineItem',
  noun: 'line item',
  version: 1,
  fields: [
    { path: 'name', label: 'Name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    { path: 'version', label: 'Version', kind: 'scalar', ignore: true },
  ],
};

export const adGroupTestRegistry: EntityRegistry = {
  entityType: 'AD_GROUP',
  model: 'AdGroup',
  noun: 'ad group',
  version: 1,
  fields: [{ path: 'name', label: 'Name', kind: 'text' }],
};

export const partnerTestRegistry: EntityRegistry = {
  entityType: 'PARTNER',
  model: 'Partner',
  noun: 'partner',
  version: 1,
  include: { exchanges: true },
  fields: [
    { path: 'name', label: 'Name', kind: 'text' },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    {
      path: 'exchanges',
      label: 'Ad exchanges',
      kind: 'list',
      elementNoun: 'ad exchange',
      elementKey: (el) => str(el.exchangeId),
      elementLabel: (el) => `Exchange ${str(el.exchangeId).slice(-6)}`,
      childFields: [{ path: 'enabled', label: 'Enabled', kind: 'bool' }],
    },
  ],
};
