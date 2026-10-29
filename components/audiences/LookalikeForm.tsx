'use client';

// Lookalike (module 14 S10): up to 10 first-party seeds of at least 1,000 users, reach 2.5 to 10% and geography.
// Save stays disabled until name, seeds, seed sizes and geography pass (AUD-044).
import { useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { DvSectionCard, DvTextField } from '@/components/dv';
import { LOOKALIKE_REACH_STOPS } from '@/lib/audiences/sizes';
import { MSG } from '@/lib/validation/messages';
import type { AudienceLookups } from '@/lib/audiences/wire';
import { AudienceFormShell } from './FormShell';
import { useAudienceSave } from './useAudienceSave';

export function LookalikeForm({
  partnerId,
  advertiserId,
  lookups,
}: {
  partnerId: string;
  advertiserId: string;
  lookups: AudienceLookups;
}) {
  const [name, setName] = useState('');
  const [seeds, setSeeds] = useState<string[]>([]);
  const [reach, setReach] = useState<number>(5);
  const [countries, setCountries] = useState<string[]>([]);
  const dirty = name !== '' || seeds.length > 0 || countries.length > 0 || reach !== 5;
  const s = useAudienceSave(partnerId, advertiserId, 'LOOKALIKE', dirty);
  const chosen = lookups.firstParty.filter((f) => seeds.includes(f.id));
  const small = chosen.filter((c) => c.users < 1000);
  const valid = name.trim() !== '' && seeds.length >= 1 && seeds.length <= 10 && small.length === 0 && countries.length > 0;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <AudienceFormShell
      dirty={dirty}
      saveDisabled={!valid}
      pending={s.pending}
      warnings={s.warn}
      onCancel={s.cancel}
      onSave={() => s.save({ kind: 'LOOKALIKE', name, seedIds: seeds, reachPct: reach, countries })}
    >
      <DvSectionCard title="Audience name" layout="settings">
        <DvTextField id="audience-name" label="Audience name" required maxLength={255} value={name} onChange={setName} error={s.err('name')} />
      </DvSectionCard>
      <DvSectionCard
        title="Seed audience lists"
        description="Choose up to 10 first-party lists. Each needs at least 1,000 active users."
        layout="stacked"
      >
        <Box role="group" aria-label="Seed audience lists" sx={{ display: 'flex', flexDirection: 'column' }}>
          {lookups.firstParty.length === 0 ? <Typography variant="body2">No first-party lists yet.</Typography> : null}
          {lookups.firstParty.map((f) => (
            <FormControlLabel
              key={f.id}
              control={<Checkbox checked={seeds.includes(f.id)} onChange={() => setSeeds(toggle(seeds, f.id))} />}
              label={
                <Box component="span" sx={{ color: seeds.includes(f.id) && f.users < 1000 ? 'statusText.error' : undefined }}>
                  {f.name} · {f.users.toLocaleString('en-US')} users
                  {seeds.includes(f.id) && f.users < 1000 ? ` · ${MSG.LOOKALIKE_MIN}` : ''}
                </Box>
              }
            />
          ))}
        </Box>
        {s.err('seeds') ? (
          <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
            {s.err('seeds')}
          </Typography>
        ) : null}
        {seeds.length > 10 ? (
          <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
            Select between 1 and 10 first-party lists.
          </Typography>
        ) : null}
      </DvSectionCard>
      <DvSectionCard title="Audience reach" layout="stacked">
        <Box sx={{ px: 2, maxWidth: 480 }}>
          <Slider
            aria-label="Audience reach"
            value={reach}
            min={2.5}
            max={10}
            step={null}
            marks={LOOKALIKE_REACH_STOPS.map((v) => ({ value: v, label: `${v}%` }))}
            onChange={(_e, v) => setReach(v)}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Least reach (2.5%)</Typography>
            <Typography variant="caption">Most reach (10%)</Typography>
          </Box>
        </Box>
      </DvSectionCard>
      <DvSectionCard title="Geography" layout="stacked">
        <Box role="group" aria-label="Geography" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {lookups.countries.map((c) => (
            <FormControlLabel
              key={c.code}
              control={<Checkbox checked={countries.includes(c.code)} onChange={() => setCountries(toggle(countries, c.code))} />}
              label={c.name}
            />
          ))}
        </Box>
        {s.err('countries') ? (
          <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
            {s.err('countries')}
          </Typography>
        ) : null}
      </DvSectionCard>
    </AudienceFormShell>
  );
}
