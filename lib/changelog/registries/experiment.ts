// Experiment and lift study registries (module 17 4.7): header fields plus arms (with the entities they hold) and
// search term groups. Arm membership is logged on the test only, not on the IOs and line items (Q3).
import type { Tx } from '@/lib/db';
import type { EntityRegistry, FieldDef, Image } from '../registry-types';

const scalar = (path: string, label: string, kind: FieldDef['kind'] = 'scalar'): FieldDef => ({ path, label, kind });
const ignored = (path: string, label: string): FieldDef => ({ path, label, kind: 'scalar', ignore: true });

const experimentFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('publicId', 'Test ID'),
  ignored('advertiserId', 'Advertiser'),
  scalar('name', 'Name', 'text'),
  scalar('hypothesis', 'Hypothesis', 'text'),
  scalar('startDate', 'Start date', 'date'),
  scalar('endDate', 'End date', 'date'),
  scalar('target', 'Comparing', 'enum'),
  scalar('goal', 'Measurement goal', 'enum'),
  scalar('confidence', 'Confidence level', 'enum'),
  scalar('excludeUnidentifiedUsers', 'Exclude unidentified users', 'bool'),
  ignored('channelScope', 'Channel scope'),
  scalar('status', 'Status', 'enum'),
  ignored('controlArmId', 'Control arm'),
  ignored('liftStudyId', 'Lift study'),
  ignored('endedAt', 'Ended'),
  ignored('endedById', 'Ended by'),
  ignored('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

const armFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('experimentId', 'Test'),
  ignored('ordinal', 'Position'),
  scalar('name', 'Name', 'text'),
  scalar('splitPct', 'Audience split'),
  scalar('isControl', 'Control', 'bool'),
  { path: 'entityIds', label: 'Items', kind: 'json' },
];

export async function loadExperimentImage(tx: Tx, id: string): Promise<Image | null> {
  const row = await tx.experiment.findUnique({
    where: { id },
    include: { arms: { orderBy: { ordinal: 'asc' }, include: { entities: true } } },
  });
  if (!row) return null;
  return {
    ...row,
    arms: row.arms.map((a) => {
      const { entities, ...rest } = a;
      return { ...rest, entityIds: entities.map((e) => e.ioId ?? e.lineItemId ?? '').sort() };
    }),
  };
}

export const experimentRegistry: EntityRegistry = {
  entityType: 'EXPERIMENT',
  model: 'Experiment',
  noun: 'A/B test',
  version: 1,
  fields: [
    ...experimentFields,
    {
      path: 'arms',
      label: 'Arms',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => `Arm ${Number(el.ordinal) + 1}`,
      elementNoun: 'arm',
      childFields: armFields,
    },
  ],
  load: loadExperimentImage,
};

const studyFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('publicId', 'Study ID'),
  ignored('advertiserId', 'Advertiser'),
  scalar('name', 'Name', 'text'),
  { path: 'types', label: 'Lift types', kind: 'json' },
  { path: 'brandLiftMetrics', label: 'Brand lift metrics', kind: 'json' },
  scalar('brandName', 'Brand or product name', 'text'),
  { path: 'competitors', label: 'Competitors', kind: 'json' },
  scalar('language', 'Language'),
  scalar('objectType', 'Object type'),
  scalar('intendedAction', 'Intended action', 'enum'),
  scalar('strength', 'Study strength', 'enum'),
  scalar('status', 'Status', 'enum'),
  { path: 'ioIds', label: 'Insertion orders', kind: 'json' },
  ignored('originExperimentId', 'Origin test'),
  ignored('endedAt', 'Ended'),
  ignored('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

const groupFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('studyId', 'Study'),
  ignored('ordinal', 'Position'),
  { path: 'terms', label: 'Search terms', kind: 'json' },
];

export async function loadLiftStudyImage(tx: Tx, id: string): Promise<Image | null> {
  const row = await tx.liftStudy.findUnique({
    where: { id },
    include: { entities: true, searchTerms: { orderBy: { ordinal: 'asc' } } },
  });
  if (!row) return null;
  const { entities, ...rest } = row;
  return { ...rest, ioIds: entities.map((e) => e.ioId).sort() };
}

export const liftStudyRegistry: EntityRegistry = {
  entityType: 'LIFT_STUDY',
  model: 'LiftStudy',
  noun: 'lift study',
  version: 1,
  fields: [
    ...studyFields,
    {
      path: 'searchTerms',
      label: 'Search term groups',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => `Search term group ${Number(el.ordinal) + 1}`,
      elementNoun: 'search term group',
      childFields: groupFields,
    },
  ],
  load: loadLiftStudyImage,
};
