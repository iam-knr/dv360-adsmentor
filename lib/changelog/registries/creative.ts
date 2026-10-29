// Creative registry (module 05 4.1, module 12 4.7). Columns of Creative plus the CreativeExt row and the assets, in
// form order. The History tab reads these labels back: "Name is …", "Creative type is …", "Archived is false",
// "{Field} changed from … to …". Review state fields are written by the engine and the review settler.
import type { Tx } from '@/lib/db';
import type { EntityRegistry, FieldDef, Image } from '../registry-types';

const scalar = (path: string, label: string, kind: FieldDef['kind'] = 'scalar'): FieldDef => ({
  path,
  label,
  kind,
});
const ignored = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

const SOURCE_TEXT: Record<string, string> = {
  DV360: 'Display & Video 360',
  CM360: 'Campaign Manager 360',
  THIRD_PARTY: 'Third party',
};

const AI_LABEL_TEXT: Record<string, string> = {
  UNSET: 'Not set',
  AI_GENERATED: 'Label this creative as created or edited with AI',
  NOT_AI_GENERATED: "Don't label this creative",
};

export const creativeColumnFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('publicId', 'Creative ID'),
  ignored('advertiserId', 'Advertiser'),
  scalar('name', 'Name', 'text'),
  scalar('kind', 'Creative type', 'enum'),
  scalar('formatKey', 'Format'),
  scalar('status', 'Status', 'enum'),
  scalar('archived', 'Archived'),
  {
    path: 'source',
    label: 'Source',
    kind: 'enum',
    format: (v) => (v ? (SOURCE_TEXT[v] ?? v) : '(none)'),
  },
  ignored('cm360Id', 'CM360 ID'),
  scalar('width', 'Width'),
  scalar('height', 'Height'),
  scalar('durationSeconds', 'Duration'),
  scalar('landingPageUrl', 'Landing page URL', 'text'),
  scalar('dontScaleToFit', "Don't scale to fit device width", 'bool'),
  scalar('requiresMraid', 'Requires MRAID', 'bool'),
  scalar('requiresHtml5', 'Requires HTML5', 'bool'),
  scalar('expandDirection', 'Expanding direction', 'enum'),
  scalar('expandsOnHover', 'Expands on hover', 'bool'),
  scalar('thirdPartyTag', 'Third-party tag', 'text'),
  scalar('vastTagUrl', 'VAST tag', 'text'),
  scalar('appendTrackingTag', 'Append HTML tracking tag', 'bool'),
  scalar('requiresPing', 'Requires ping for attribution', 'bool'),
  {
    path: 'aiLabel',
    label: 'AI label',
    kind: 'enum',
    format: (v) => (v ? (AI_LABEL_TEXT[v] ?? v) : '(none)'),
  },
  scalar('integrationCode', 'Integration code', 'text'),
  scalar('notes', 'Notes', 'text'),
  ignored('companionOfCreativeId', 'Companion of'),
  scalar('cmAuditFeedback', 'CM Audit feedback', 'text'),
  // Stored at submit from the review plan, shown as Pending until it is due (module 12 review plan): not logged.
  ignored('dv360Review', 'Display & Video 360 review'),
  ignored('dv360Feedback', 'Review feedback'),
  { path: 'reviewCompletedAt', label: 'Review completed', kind: 'date', ignore: true },
  ignored('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

/** CreativeExt columns (migration 0004), merged into the image by `load`. */
export const creativeExtFields: FieldDef[] = [
  scalar('skippable', 'Skippable', 'bool'),
  scalar('skipOffsetSec', 'Skip offset (seconds)'),
  { path: 'nativeFields', label: 'Native text assets', kind: 'json' },
  scalar('youtubeVideoId', 'YouTube video'),
  ignored('thumbnailAssetId', 'Thumbnail'),
  { path: 'reviewRequestedAt', label: 'Review requested', kind: 'date', ignore: true },
  { path: 'dv360DecideAt', label: 'DV360 decision due', kind: 'date', ignore: true },
  ignored('plannedVerdict', 'Planned verdict'),
  ignored('plannedReason', 'Planned reason'),
];

const assetFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('role', 'Role'),
  scalar('fileName', 'File name'),
  ignored('mimeType', 'Type'),
  ignored('sizeBytes', 'Size'),
  ignored('storageKey', 'Storage key'),
];

export const creativeListFields: FieldDef[] = [
  {
    path: 'assets',
    label: 'Assets',
    kind: 'list',
    elementKey: (el) => `${String(el.role)}:${String(el.fileName)}`,
    elementLabel: (el) => `${String(el.fileName)}`,
    elementNoun: 'asset',
    childFields: assetFields.filter((f) => !f.ignore),
  },
  {
    path: 'creativeUrls',
    label: 'Tracking URLs',
    kind: 'list',
    elementKey: (el) => `${String(el.type)}:${String(el.url)}`,
    elementLabel: (el) => `${String(el.type).replace('_', ' ').toLowerCase()} ${String(el.url)}`,
    elementNoun: 'tracking URL',
  },
];

/** The creative with its assets, tracking URLs and extension columns as one image. */
export async function loadCreativeImage(tx: Tx, id: string): Promise<Image | null> {
  const row = await tx.creative.findUnique({
    where: { id },
    include: {
      assets: { orderBy: [{ role: 'asc' }, { fileName: 'asc' }] },
      creativeUrls: { orderBy: [{ type: 'asc' }, { ordinal: 'asc' }] },
    },
  });
  if (!row) return null;
  const ext = await tx.creativeExt.findUnique({ where: { creativeId: id } });
  const {
    creativeId: _c,
    id: _i,
    sandboxId: _s,
    ...extColumns
  } = ext ?? ({} as Record<string, unknown>);
  void _c;
  void _i;
  void _s;
  return { ...row, archived: row.status === 'ARCHIVED', ...extColumns };
}

export const creativeRegistry: EntityRegistry = {
  entityType: 'CREATIVE',
  model: 'Creative',
  noun: 'creative',
  version: 1,
  fields: [...creativeColumnFields, ...creativeExtFields, ...creativeListFields],
  load: loadCreativeImage,
};
