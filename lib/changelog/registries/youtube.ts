// Registries of the YouTube entities (module 09 4.5): ad group and ad. Review fields are engine-style state, so they
// are logged (a rejected ad shows in History) but the planned verdict and decide time are internal.
import type { EntityRegistry, FieldDef } from '../registry-types';

const ignore = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});
const scalar = (path: string, label: string, kind: FieldDef['kind'] = 'scalar'): FieldDef => ({
  path,
  label,
  kind,
});

export const adGroupRegistry: EntityRegistry = {
  entityType: 'AD_GROUP',
  model: 'AdGroup',
  noun: 'ad group',
  version: 1,
  fields: [
    ignore('id', 'ID'),
    ignore('sandboxId', 'Sandbox'),
    ignore('publicId', 'Ad group ID'),
    ignore('lineItemId', 'Line item'),
    ignore('advertiserId', 'Advertiser'),
    scalar('name', 'Ad group name', 'text'),
    scalar('status', 'Status', 'enum'),
    ignore('adSourceLabel', 'Ad source'),
    scalar('bidValue', 'Bid', 'money'),
    ignore('cm360Id', 'CM360 ID'),
    ignore('version', 'Version'),
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
  ],
};

export const adRegistry: EntityRegistry = {
  entityType: 'AD',
  model: 'Ad',
  noun: 'ad',
  version: 1,
  fields: [
    ignore('id', 'ID'),
    ignore('sandboxId', 'Sandbox'),
    ignore('publicId', 'Ad ID'),
    ignore('adGroupId', 'Ad group'),
    ignore('advertiserId', 'Advertiser'),
    scalar('name', 'Ad name', 'text'),
    scalar('status', 'Status', 'enum'),
    scalar('format', 'Ad format', 'enum'),
    scalar('reviewStatus', 'Review status', 'enum'),
    scalar('reviewFeedback', 'Review feedback', 'text'),
    scalar('youtubeVideoId', 'Video'),
    { path: 'imageAssetIds', label: 'Images', kind: 'json' },
    scalar('logoAssetId', 'Logo'),
    scalar('companionAssetId', 'Companion banner'),
    scalar('headline', 'Headline', 'text'),
    scalar('longHeadline', 'Long headline', 'text'),
    scalar('description', 'Description', 'text'),
    scalar('callToAction', 'Call to action', 'text'),
    scalar('businessName', 'Business name', 'text'),
    scalar('displayUrl', 'Display URL', 'text'),
    scalar('path1', 'Path 1', 'text'),
    scalar('path2', 'Path 2', 'text'),
    scalar('landingPageUrl', 'Landing page URL', 'text'),
    scalar('clickTrackerUrl', 'Click tracker URL', 'text'),
    scalar('impressionTrackerUrl', 'Impression tracker URL', 'text'),
    scalar('urlSuffix', 'URL suffix', 'text'),
    ignore('reviewDecideAt', 'Review decision time'),
    ignore('plannedVerdict', 'Planned verdict'),
    ignore('version', 'Version'),
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
  ],
};
