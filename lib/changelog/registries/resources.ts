// Registries of the resource entities (module 15 4.7): channel, negative keyword list, location list, Floodlight group
// and Floodlight activity. Entry tables (up to 10,000 rows) are logged as a count, not row by row, so a save of a big
// list leaves one readable line ("Number of sites changed from 200 to 210").
import type { EntityRegistry, FieldDef } from '../registry-types';

const ignore = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

const common = (publicLabel: string): FieldDef[] => [
  ignore('id', 'ID'),
  ignore('sandboxId', 'Sandbox'),
  ignore('publicId', publicLabel),
  ignore('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

export const channelRegistry: EntityRegistry = {
  entityType: 'CHANNEL',
  model: 'Channel',
  noun: 'channel',
  version: 1,
  load: async (tx, id) => {
    const row = await tx.channel.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!row) return null;
    const { _count, ...rest } = row;
    return { ...rest, entryCount: _count.entries };
  },
  fields: [
    ...common('Channel ID'),
    ignore('partnerId', 'Partner'),
    ignore('advertiserId', 'Advertiser'),
    { path: 'name', label: 'Channel name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'entryCount', label: 'Number of sites', kind: 'scalar' },
  ],
};

export const keywordListRegistry: EntityRegistry = {
  entityType: 'KEYWORD_LIST',
  model: 'KeywordList',
  noun: 'negative keyword list',
  version: 1,
  load: async (tx, id) => {
    const row = await tx.keywordList.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!row) return null;
    const { _count, ...rest } = row;
    return { ...rest, entryCount: _count.entries };
  },
  fields: [
    ...common('Keyword list ID'),
    ignore('advertiserId', 'Advertiser'),
    ignore('partnerId', 'Partner'),
    { path: 'name', label: 'Keyword list name', kind: 'text' },
    { path: 'entryCount', label: 'Number of keywords', kind: 'scalar' },
  ],
};

export const locationListRegistry: EntityRegistry = {
  entityType: 'LOCATION_LIST',
  model: 'LocationList',
  noun: 'location list',
  version: 1,
  load: async (tx, id) => {
    const row = await tx.locationList.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!row) return null;
    const { _count, ...rest } = row;
    return { ...rest, entryCount: _count.entries };
  },
  fields: [
    ...common('Location list ID'),
    ignore('advertiserId', 'Advertiser'),
    { path: 'name', label: 'Location list name', kind: 'text' },
    { path: 'type', label: 'Location list type', kind: 'enum' },
    { path: 'entryCount', label: 'Number of locations', kind: 'scalar' },
  ],
};

export const floodlightGroupRegistry: EntityRegistry = {
  entityType: 'FLOODLIGHT_GROUP',
  model: 'FloodlightGroup',
  noun: 'Floodlight group',
  version: 1,
  load: async (tx, id) => {
    const row = await tx.floodlightGroup.findUnique({
      where: { id },
      include: {
        variables: { orderBy: { ordinal: 'asc' } },
        models: { orderBy: { id: 'asc' } },
        conversionGroups: { include: { activities: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!row) return null;
    const { conversionGroups, ...rest } = row;
    return {
      ...rest,
      conversionGroups: conversionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        activityCount: g.activities.length,
      })),
    };
  },
  fields: [
    ...common('Floodlight group ID'),
    ignore('advertiserId', 'Advertiser'),
    ignore('partnerId', 'Partner'),
    ignore('ownerScope', 'Owner'),
    { path: 'name', label: 'Floodlight group name', kind: 'text' },
    { path: 'clickWindowDays', label: 'Click conversion window (days)', kind: 'scalar' },
    { path: 'impressionWindowDays', label: 'Impression conversion window (days)', kind: 'scalar' },
    { path: 'imageTagOnly', label: 'Image tag only', kind: 'bool' },
    { path: 'dynamicTag', label: 'Dynamic tag', kind: 'bool' },
    { path: 'personalizedAdExclusion', label: 'Personalized ad exclusions', kind: 'enum' },
    { path: 'defaultConsent', label: 'Default consent settings', kind: 'json' },
    { path: 'importedDataConsent', label: 'Imported data consent', kind: 'json' },
    { path: 'viewableImpressionPct', label: 'Viewable impressions (%)', kind: 'scalar' },
    { path: 'engagedViewMetricVariable', label: 'Engaged View custom metric', kind: 'text' },
    { path: 'activeViewMetricVariable', label: 'Active View custom metric', kind: 'text' },
    { path: 'enhancedConversions', label: 'Enhanced conversions', kind: 'bool' },
    { path: 'appAttributionPartners', label: 'App attribution partner links', kind: 'json' },
    { path: 'googleAnalyticsLinked', label: 'Google Analytics link', kind: 'bool' },
    ignore('googleTagId', 'Google tag ID'),
    ignore('tagStatus', 'Tag status'),
    { path: 'lastSeenAt', label: 'Tag last seen', kind: 'date', ignore: true },
    {
      path: 'variables',
      label: 'Custom variables',
      kind: 'list',
      elementKey: (el) => String(el.key),
      elementLabel: (el) => `Custom variable ${String(el.key)}`,
      elementNoun: 'custom variable',
      childFields: [
        { path: 'name', label: 'Variable name', kind: 'text' },
        { path: 'dataType', label: 'Variable type', kind: 'enum' },
      ],
    },
    {
      path: 'models',
      label: 'Attribution models',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => `Attribution model ${String(el.name)}`,
      elementNoun: 'attribution model',
      childFields: [
        { path: 'name', label: 'Model name', kind: 'text' },
        { path: 'isPrimary', label: 'Primary model', kind: 'bool' },
        { path: 'kind', label: 'Model kind', kind: 'enum' },
      ],
    },
    {
      path: 'conversionGroups',
      label: 'Conversion groups',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => `Conversion group ${String(el.name)}`,
      elementNoun: 'conversion group',
      childFields: [
        { path: 'name', label: 'Group name', kind: 'text' },
        { path: 'activityCount', label: 'Conversions in group', kind: 'scalar' },
      ],
    },
  ],
};

export const floodlightActivityRegistry: EntityRegistry = {
  entityType: 'FLOODLIGHT_ACTIVITY',
  model: 'FloodlightActivity',
  noun: 'Floodlight conversion',
  version: 1,
  fields: [
    ...common('Conversion ID'),
    ignore('groupId', 'Floodlight group'),
    ignore('lockedFieldsAt', 'Locked at'),
    { path: 'name', label: 'Conversion name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'platform', label: 'Platform', kind: 'enum' },
    { path: 'format', label: 'Format', kind: 'enum' },
    { path: 'type', label: 'Type', kind: 'enum' },
    { path: 'countingMethod', label: 'Counting method', kind: 'enum' },
    { path: 'category', label: 'Category', kind: 'enum' },
    { path: 'remarketingEnabled', label: 'Remarketing', kind: 'bool' },
    { path: 'youtubeEnabled', label: 'YouTube conversion tracking', kind: 'bool' },
    { path: 'valueBasedBidding', label: 'Value-based bidding', kind: 'bool' },
    { path: 'commercePartnerMeasurement', label: 'Commerce partner measurement', kind: 'bool' },
    { path: 'personalizedAdExclusion', label: 'Personalized ad exclusions', kind: 'enum' },
    { path: 'customVariableKeys', label: 'Custom variables', kind: 'json' },
    { path: 'appId', label: 'App', kind: 'text' },
    { path: 'ctvAppId', label: 'Connected TV app', kind: 'text' },
    { path: 'appStoreId', label: 'App store ID', kind: 'text' },
    { path: 'conversionEventName', label: 'Conversion event name', kind: 'text' },
  ],
};

export const customBiddingRegistry: EntityRegistry = {
  entityType: 'CUSTOM_BIDDING_ALGORITHM',
  model: 'CustomBiddingAlgorithm',
  noun: 'custom bidding algorithm',
  version: 1,
  load: async (tx, id) => {
    const row = await tx.customBiddingAlgorithm.findUnique({
      where: { id },
      include: {
        rules: { orderBy: { ordinal: 'asc' } },
        multipliers: { orderBy: { ordinal: 'asc' } },
      },
    });
    if (!row || row.isDraft) return null; // wizard drafts leave no History until step 3 saves them
    const { rules, multipliers, ...rest } = row;
    return {
      ...rest,
      ruleCount: rules.length,
      rules: rules.map(
        (r) => `${r.signalKey ?? r.signal} = ${r.value} (score ${r.score.toString()})`,
      ),
      multipliers: multipliers.map((m) => m.kind),
    };
  },
  fields: [
    ...common('Algorithm ID'),
    ignore('advertiserId', 'Advertiser'),
    ignore('partnerId', 'Partner'),
    ignore('source', 'Source'),
    ignore('modelReadiness', 'Model readiness'),
    ignore('readinessPct', 'Readiness'),
    ignore('trainingImpressions', 'Training impressions'),
    ignore('errorPct', 'Errors'),
    ignore('activeLineItems', 'Active line items'),
    ignore('lastTestRunId', 'Last test run'),
    ignore('isDraft', 'Draft'),
    { path: 'name', label: 'Algorithm name', kind: 'text' },
    { path: 'objective', label: 'Objective', kind: 'enum' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'ownerScope', label: 'Owner', kind: 'enum' },
    { path: 'ruleCount', label: 'Number of rules', kind: 'scalar' },
    { path: 'rules', label: 'Rules', kind: 'json' },
    { path: 'multipliers', label: 'Multipliers', kind: 'json' },
  ],
};
