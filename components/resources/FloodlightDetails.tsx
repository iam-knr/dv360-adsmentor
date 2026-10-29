'use client';

// Floodlight group "Basic details" (module 15 S3): cards, each with an edit pencil that opens a slide-over editor.
// Windows 1 to 90 (FL-020), viewable % 0 to 100 (FL-021), variable slots u1..u100 (FL-022). Saves write History and
// the engine uses the new windows from the next tick.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import {
  DvSectionCard,
  DvSelect,
  DvSlideOver,
  DvTextField,
  DvCheckboxGroup,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import { updateFloodlightGroupAction } from '@/lib/resources/actions';
import type { FloodlightGroupInput, FloodlightGroupView, WireIssue } from '@/lib/resources/wire';
import { FloodlightShell } from './FloodlightConversions';

type Section =
  | 'name'
  | 'web'
  | 'exclusions'
  | 'attribution'
  | 'viewable'
  | 'partners'
  | 'groups'
  | 'variables'
  | 'metrics'
  | 'enhanced';

const TITLES: Record<Section, string> = {
  name: 'Name and ID',
  web: 'Web tag settings',
  exclusions: 'Personalized ad exclusions',
  attribution: 'Attribution',
  viewable: 'Viewable impressions',
  partners: 'Partner integrations',
  groups: 'Conversion groups',
  variables: 'Custom variables',
  metrics: 'Engaged View and Active View custom metrics',
  enhanced: 'Enhanced conversions',
};

export function FloodlightDetails({
  partnerId,
  advertiserId,
  group,
}: {
  partnerId: string;
  advertiserId: string;
  group: FloodlightGroupView;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [open, setOpen] = useState<Section | null>(null);
  const [draft, setDraft] = useState<FloodlightGroupInput>({});
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [, start] = useTransition();
  const err = (p: string) =>
    issues.find((i) => i.severity === 'error' && i.path.startsWith(p))?.message;

  const edit = (s: Section) => {
    setIssues([]);
    setDraft({
      name: group.name,
      clickDays: group.clickDays,
      impressionDays: group.impressionDays,
      primaryModelId: group.models.find((m) => m.isPrimary)?.id,
      imageTagOnly: group.imageTagOnly,
      dynamicTag: group.dynamicTag,
      personalizedAdExclusion: group.personalizedAdExclusion,
      viewableImpressionPct: group.viewableImpressionPct,
      googleAnalyticsLinked: group.googleAnalyticsLinked,
      appAttributionPartners: group.appAttributionPartners,
      enhancedConversions: group.enhancedConversions,
      engagedViewVariable: group.engagedViewVariable,
      activeViewVariable: group.activeViewVariable,
      customVariables: group.variables,
      conversionGroups: group.conversionGroups,
    });
    setOpen(s);
  };

  const save = () =>
    start(async () => {
      const res = await updateFloodlightGroupAction(advertiserId, draft, {
        expectedVersion: group.version,
      });
      if (!res.ok) return setIssues(res.issues);
      setOpen(null);
      router.refresh();
    });

  const card = (s: Section, body: React.ReactNode) => (
    <DvSectionCard key={s} title={TITLES[s]}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>{body}</Box>
        {viewer.readOnly ? null : (
          <IconButton aria-label={`Edit ${TITLES[s]}`} onClick={() => edit(s)}>
            <DvIcon name="edit" size={20} />
          </IconButton>
        )}
      </Box>
    </DvSectionCard>
  );
  const primary = group.models.find((m) => m.isPrimary);

  return (
    <FloodlightShell partnerId={partnerId} advertiserId={advertiserId} tab="details">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 960 }}>
        {card(
          'name',
          <Typography>
            {group.name} ({group.id})
          </Typography>,
        )}
        {card(
          'web',
          <>
            <Typography>Image tag only: {group.imageTagOnly ? 'On' : 'Off'}</Typography>
            <Typography>Dynamic tag: {group.dynamicTag ? 'On' : 'Off'}</Typography>
          </>,
        )}
        {card(
          'exclusions',
          <Typography>
            {group.personalizedAdExclusion === 'DONT_EXCLUDE'
              ? "Don't exclude any locations"
              : 'Exclude all locations'}
          </Typography>,
        )}
        {card(
          'attribution',
          <>
            <Typography>
              Conversion window: Clicks {group.clickDays} Days, Impressions {group.impressionDays}{' '}
              Days
            </Typography>
            <Typography>
              Attribution models: {group.models.map((m) => m.name).join(', ') || '-'}
              {primary ? ` (primary: ${primary.name})` : ''}
            </Typography>
          </>,
        )}
        {card(
          'viewable',
          <Typography>
            {group.viewableImpressionPct}% of Active View ineligible impressions
          </Typography>,
        )}
        {card(
          'partners',
          <>
            <Typography>
              App attribution partner links: {group.appAttributionPartners.join(', ') || 'None'}
            </Typography>
            <Typography>
              Google Analytics link: {group.googleAnalyticsLinked ? 'Linked' : 'Not linked'}
            </Typography>
          </>,
        )}
        {card('groups', <Typography>{group.conversionGroups.length} groups</Typography>)}
        {card(
          'variables',
          <Typography>
            {group.variables
              .slice(0, 5)
              .map((v) => `${v.key}: ${v.name}`)
              .join(', ') || 'None'}
            {group.variables.length > 5 ? ` and ${group.variables.length - 5} more` : ''}
          </Typography>,
        )}
        {card(
          'metrics',
          <Typography>
            Engaged View: {group.engagedViewVariable ?? 'Not set'}; Active View:{' '}
            {group.activeViewVariable ?? 'Not set'}
          </Typography>,
        )}
        {card('enhanced', <Typography>{group.enhancedConversions ? 'On' : 'Off'}</Typography>)}
      </Box>

      {open ? (
        <DvSlideOver
          open
          title={TITLES[open]}
          onApply={save}
          applyLabel="Save"
          onCancel={() => setOpen(null)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {open === 'name' ? (
              <DvTextField
                label="Floodlight group name"
                required
                value={draft.name ?? ''}
                error={err('name')}
                onChange={(name) => setDraft((d) => ({ ...d, name }))}
              />
            ) : null}
            {open === 'web' ? (
              <DvCheckboxGroup
                values={[
                  ...(draft.imageTagOnly ? ['image'] : []),
                  ...(draft.dynamicTag ? ['dynamic'] : []),
                ]}
                options={[
                  { value: 'image', label: 'Image tag only' },
                  {
                    value: 'dynamic',
                    label: 'Dynamic tag',
                    description: 'Lets the tag adapt to page content.',
                  },
                ]}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    imageTagOnly: v.includes('image'),
                    dynamicTag: v.includes('dynamic'),
                  }))
                }
              />
            ) : null}
            {open === 'exclusions' ? (
              <DvSelect
                label="Personalized ad exclusions"
                value={draft.personalizedAdExclusion ?? 'DONT_EXCLUDE'}
                options={[
                  { value: 'DONT_EXCLUDE', label: "Don't exclude any locations" },
                  { value: 'EXCLUDE_ALL_LOCATIONS', label: 'Exclude all locations' },
                ]}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, personalizedAdExclusion: v as 'DONT_EXCLUDE' }))
                }
              />
            ) : null}
            {open === 'attribution' ? (
              <>
                <DvTextField
                  label="Clicks (days)"
                  type="number"
                  numeric
                  value={String(draft.clickDays ?? '')}
                  error={err('attribution.clickDays')}
                  onChange={(clickDays) => setDraft((d) => ({ ...d, clickDays }))}
                  id="click-days"
                />
                <DvTextField
                  label="Impressions (days)"
                  type="number"
                  numeric
                  value={String(draft.impressionDays ?? '')}
                  error={err('attribution.impressionDays')}
                  onChange={(impressionDays) => setDraft((d) => ({ ...d, impressionDays }))}
                  id="impression-days"
                />
                <DvSelect
                  label="Primary attribution model"
                  value={draft.primaryModelId ?? ''}
                  options={group.models.map((m) => ({ value: m.id, label: m.name }))}
                  onChange={(primaryModelId) => setDraft((d) => ({ ...d, primaryModelId }))}
                />
              </>
            ) : null}
            {open === 'viewable' ? (
              <DvTextField
                label="Percent of Active View ineligible impressions to include"
                type="number"
                numeric
                suffix="%"
                value={String(draft.viewableImpressionPct ?? '')}
                error={err('viewableImpressionPct')}
                onChange={(viewableImpressionPct) =>
                  setDraft((d) => ({ ...d, viewableImpressionPct }))
                }
                id="viewable-pct"
              />
            ) : null}
            {open === 'partners' ? (
              <DvCheckboxGroup
                values={draft.googleAnalyticsLinked ? ['ga'] : []}
                options={[{ value: 'ga', label: 'Link Google Analytics' }]}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, googleAnalyticsLinked: v.includes('ga') }))
                }
              />
            ) : null}
            {open === 'groups' ? (
              <>
                {(draft.conversionGroups ?? []).map((g, i) => (
                  <DvTextField
                    key={g.id ?? i}
                    label={`Conversion group ${i + 1}`}
                    value={g.name}
                    onChange={(name) =>
                      setDraft((d) => ({
                        ...d,
                        conversionGroups: d.conversionGroups!.map((x, j) =>
                          j === i ? { ...x, name } : x,
                        ),
                      }))
                    }
                  />
                ))}
              </>
            ) : null}
            {open === 'variables' ? (
              <>
                {(draft.customVariables ?? []).map((v, i) => (
                  <DvTextField
                    key={v.key}
                    label={v.key}
                    value={v.name}
                    error={i === 0 ? err('customVariables') : undefined}
                    onChange={(name) =>
                      setDraft((d) => ({
                        ...d,
                        customVariables: d.customVariables!.map((x, j) =>
                          j === i ? { ...x, name } : x,
                        ),
                      }))
                    }
                  />
                ))}
              </>
            ) : null}
            {open === 'metrics' ? (
              <>
                <DvTextField
                  label="Engaged View custom metric"
                  value={draft.engagedViewVariable ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, engagedViewVariable: v || null }))}
                />
                <DvTextField
                  label="Active View custom metric"
                  value={draft.activeViewVariable ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, activeViewVariable: v || null }))}
                />
              </>
            ) : null}
            {open === 'enhanced' ? (
              <DvCheckboxGroup
                values={draft.enhancedConversions ? ['on'] : []}
                options={[{ value: 'on', label: 'Turn on enhanced conversions' }]}
                onChange={(v) => setDraft((d) => ({ ...d, enhancedConversions: v.includes('on') }))}
              />
            ) : null}
          </Box>
        </DvSlideOver>
      ) : null}
    </FloodlightShell>
  );
}

export function GoogleTagCard({
  partnerId,
  advertiserId,
  group,
}: {
  partnerId: string;
  advertiserId: string;
  group: FloodlightGroupView;
}) {
  return (
    <FloodlightShell partnerId={partnerId} advertiserId={advertiserId} tab="google-tag">
      <DvSectionCard title="Google tag">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography
            component="span"
            variant="caption"
            sx={{
              alignSelf: 'flex-start',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 4,
              px: 2,
              py: 0.5,
            }}
          >
            Read-only mode
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            <Box>
              <Typography variant="subtitle2">Configuration</Typography>
              <Typography>Tag ID: {group.googleTag.tagId ?? 'Not set'}</Typography>
              <Typography>
                Status:{' '}
                {group.googleTag.status === 'broken' ? 'Tag is not firing' : 'Tag is installed'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">History</Typography>
              <Typography>
                Last seen:{' '}
                {group.googleTag.lastSeenAt ? group.googleTag.lastSeenAt.slice(0, 10) : 'Never'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">Admin</Typography>
              <Typography>Managed by the classroom. Changes are not available.</Typography>
            </Box>
          </Box>
        </Box>
      </DvSectionCard>
    </FloodlightShell>
  );
}
