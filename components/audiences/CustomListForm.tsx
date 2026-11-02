'use client';

// Standalone custom affinity and custom intent pages of the Audiences module (module 14 S11, S12). The fields are the
// shared `CustomListFields`; the Impressions Estimator aside (AUD-051) stays on these pages only, the stacked panel of
// the line item targeting has none (fidelity audit CIL-008).
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvSectionCard } from '@/components/dv';
import { estimateAudienceAction } from '@/lib/audiences/actions';
import { MSG } from '@/lib/validation/messages';
import type { AudienceLookups, SizeCell } from '@/lib/audiences/wire';
import { CustomListFields, useCustomListState, visibleErrors, CUSTOM_KIND, type CustomSurface } from './CustomListFields';
import { AudienceFormShell } from './FormShell';
import { SizeBar } from './shared';
import { useAudienceSave } from './useAudienceSave';

type Estimate = Record<'display' | 'youtube' | 'mobileApp' | 'ctv', SizeCell> | 'na' | null;

export function CustomListForm({
  partnerId,
  advertiserId,
  surface,
  lookups,
}: {
  partnerId: string;
  advertiserId: string;
  surface: CustomSurface;
  lookups: AudienceLookups;
}) {
  const form = useCustomListState(surface);
  const { state: s } = form;
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [blank, setBlank] = useState(false);
  const save = useAudienceSave(partnerId, advertiserId, CUSTOM_KIND[surface], form.dirty);

  useEffect(() => {
    let live = true;
    void estimateAudienceAction(advertiserId, {
      kind: 'CUSTOM',
      interests: s.interests,
      urls: s.urls,
      apps: s.apps,
      keywords: s.keywords,
    }).then((r) => {
      if (live) setEstimate('unavailable' in r ? 'na' : r.sizes);
    });
    return () => {
      live = false;
    };
  }, [advertiserId, s.interests, s.urls, s.apps, s.keywords]);

  const submit = () => {
    if (s.name.trim() === '') return setBlank(true);
    setBlank(false);
    save.save(form.input);
  };
  const errors = visibleErrors(save.err, blank && s.name.trim() === '');

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 4, alignItems: 'start' }}>
      <AudienceFormShell
        primaryLabel="Create"
        dirty={form.dirty}
        pending={save.pending}
        warnings={save.warn}
        onCancel={save.cancel}
        onSave={submit}
      >
        <CustomListFields form={form} lookups={lookups} errors={errors} />
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
