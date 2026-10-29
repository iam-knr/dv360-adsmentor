'use client';

// Custom affinity and custom intent lists (module 14 S11, S12): chip inputs plus the Impressions Estimator panel,
// which shows AUD_FORECAST_NA until the list has an entry (AUD-051).
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvSectionCard, DvSelect, DvTextField } from '@/components/dv';
import { estimateAudienceAction } from '@/lib/audiences/actions';
import { MSG } from '@/lib/validation/messages';
import type { AudienceLookups, SizeCell } from '@/lib/audiences/wire';
import { AudienceFormShell } from './FormShell';
import { ChipInput, SizeBar } from './shared';
import { useAudienceSave } from './useAudienceSave';

type Surface = 'affinity' | 'display' | 'youtube';
type Estimate = Record<'display' | 'youtube' | 'mobileApp' | 'ctv', SizeCell> | 'na' | null;

const looksLikeUrl = (v: string): string | null =>
  /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(v) ? null : 'Enter a valid URL.';

export function CustomListForm({
  partnerId,
  advertiserId,
  surface,
  lookups,
}: {
  partnerId: string;
  advertiserId: string;
  surface: Surface;
  lookups: AudienceLookups;
}) {
  const kind =
    surface === 'affinity'
      ? ('CUSTOM_AFFINITY' as const)
      : surface === 'display'
        ? ('CUSTOM_INTENT_DISPLAY_VIDEO' as const)
        : ('CUSTOM_INTENT_YOUTUBE' as const);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<Estimate>(null);
  const dirty = name !== '' || interests.length + urls.length + keywords.length + apps.length > 0;
  const s = useAudienceSave(partnerId, advertiserId, kind, dirty);
  const showInterests = surface === 'affinity';
  const showApps = surface !== 'youtube';
  const title =
    surface === 'affinity' ? 'Custom affinity' : surface === 'display' ? 'Custom intent (Display, Video)' : 'Custom intent (YouTube)';

  useEffect(() => {
    let live = true;
    void estimateAudienceAction(advertiserId, { kind: 'CUSTOM', interests, urls, apps, keywords }).then((r) => {
      if (live) setEstimate('unavailable' in r ? 'na' : r.sizes);
    });
    return () => {
      live = false;
    };
  }, [advertiserId, interests, urls, apps, keywords]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 4, alignItems: 'start' }}>
      <AudienceFormShell
        primaryLabel="Create"
        dirty={dirty}
        pending={s.pending}
        warnings={s.warn}
        onCancel={s.cancel}
        onSave={() => s.save({ kind, name, description, interests, urls, apps, keywords })}
      >
        <DvSectionCard title={title} layout="settings">
          <DvTextField id="audience-name" label="Name" required maxLength={255} value={name} onChange={setName} error={s.err('name')} />
          <DvTextField id="audience-description" label="Description" value={description} onChange={setDescription} />
        </DvSectionCard>
        <DvSectionCard title="Entries" layout="settings">
          {showInterests ? (
            <ChipInput
              id="audience-interests"
              label="Interests"
              values={interests}
              onChange={setInterests}
              error={s.err('interests')}
              placeholder="Type an interest and press Enter"
            />
          ) : (
            <ChipInput
              id="audience-keywords"
              label="Keywords"
              values={keywords}
              onChange={setKeywords}
              error={s.err('keywords')}
              placeholder="Type a keyword and press Enter"
            />
          )}
          <ChipInput
            id="audience-urls"
            label="URLs"
            values={urls}
            onChange={setUrls}
            validate={looksLikeUrl}
            placeholder="Type a URL and press Enter"
          />
          {showApps ? (
            <DvSelect
              id="audience-apps"
              label="Apps"
              searchable
              value=""
              placeholder="Search for an app"
              onChange={(v) => v && setApps(apps.includes(v) ? apps : [...apps, v])}
              options={lookups.apps.filter((a) => !apps.includes(a.id)).map((a) => ({ value: a.id, label: a.label }))}
            />
          ) : null}
          {apps.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {apps.map((id) => (
                <Box
                  key={id}
                  component="button"
                  type="button"
                  onClick={() => setApps(apps.filter((a) => a !== id))}
                  aria-label={`Remove ${lookups.apps.find((a) => a.id === id)?.label ?? id}`}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, px: 2, py: 0.5, bgcolor: 'transparent', cursor: 'pointer' }}
                >
                  {lookups.apps.find((a) => a.id === id)?.label ?? id} ×
                </Box>
              ))}
            </Box>
          ) : null}
        </DvSectionCard>
      </AudienceFormShell>
      <Box component="aside" aria-label="Impressions Estimator" data-testid="estimator">
        <DvSectionCard title="Impressions Estimator" layout="stacked">
          {estimate && estimate !== 'na' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">Estimated audience size</Typography>
              <SizeBar cell={estimate.display} label="Display" />
              <SizeBar cell={estimate.youtube} label="YouTube" />
            </Box>
          ) : (
            <Typography variant="body2">{MSG.AUD_FORECAST_NA}</Typography>
          )}
        </DvSectionCard>
      </Box>
    </Box>
  );
}
