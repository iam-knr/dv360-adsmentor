// Registry of audiences (module 14 4.5): create writes "{Field} is {value}" per field, updates per field, archive a
// status change. Sizes, availability and the engine's counters are never logged.
import type { EntityRegistry, FieldDef } from '../registry-types';

const ignore = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

export const audienceRegistry: EntityRegistry = {
  entityType: 'AUDIENCE',
  model: 'Audience',
  noun: 'audience',
  version: 1,
  fields: [
    ignore('id', 'ID'),
    ignore('sandboxId', 'Sandbox'),
    ignore('publicId', 'Audience ID'),
    ignore('advertiserId', 'Advertiser'),
    ignore('version', 'Version'),
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    { path: 'availableAt', label: 'Available at', kind: 'date', ignore: true },
    ignore('sizeDisplay', 'Display size'),
    ignore('sizeYoutube', 'YouTube size'),
    ignore('sizeMobileApp', 'Mobile app size'),
    ignore('sizeCtv', 'CTV size'),
    ignore('floodlightActivityId', 'Floodlight activity'),
    ignore('source', 'Source'),
    ignore('config', 'Configuration'),
    ignore('connectedProductKey', 'Connected product'),
    ignore('sourceExternalId', 'External source'),
    ignore('reachExpansion', 'Reach expansion'),
    ignore('consentAck', 'Consent'),
    { path: 'name', label: 'Audience name', kind: 'text' },
    { path: 'description', label: 'Description', kind: 'text' },
    { path: 'type', label: 'Audience type', kind: 'enum' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'membershipDays', label: 'Membership duration (days)', kind: 'scalar' },
    { path: 'lookalikeReachPct', label: 'Audience reach (%)', kind: 'scalar' },
    { path: 'dataSource', label: 'Data source', kind: 'enum' },
  ],
};
