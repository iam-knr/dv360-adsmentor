'use client';

// New YouTube & partners line item, step 1 (module 09 2.1): name, optimization and the ad format card. Next carries the
// choice in the URL (`optimization=REACH&format=EFFICIENT`, RT 6.1) to step 2.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvTextField } from '@/components/dv/DvTextField';
import {
  subtypeFrom,
  type YtAdFormatChoice,
  type YtOptimization,
} from '@/lib/validation/constants/youtube';
import { LIMITS } from '@/lib/validation/constants/limits';

const OPTIMIZATIONS: { value: YtOptimization; label: string; description: string }[] = [
  { value: 'REACH', label: 'Reach', description: 'Reach as many unique users as possible' },
  {
    value: 'TARGET_FREQUENCY',
    label: 'Target frequency',
    description: 'Reach the same users multiple times',
  },
  {
    value: 'TRUEVIEW_VIEWS',
    label: 'TrueView views',
    description: 'Drive as many TrueView views as possible',
  },
];
const AD_SEQUENCE = {
  value: 'AD_SEQUENCE' as const,
  label: 'Ad sequence',
  description: 'Tell a story by showing ads in a sequence (bumper, skippable, non-skippable)',
};

const FORMATS: Partial<
  Record<YtOptimization, { value: YtAdFormatChoice; label: string; description: string }[]>
> = {
  REACH: [
    {
      value: 'EFFICIENT',
      label: 'Efficient ad formats',
      description: 'Bumper, skippable, in-feed and Shorts ads',
    },
    {
      value: 'NON_SKIPPABLE',
      label: 'Non-skippable ad formats',
      description: 'A mix of non-skippable ads of 5 to 30 seconds',
    },
  ],
  TARGET_FREQUENCY: [
    {
      value: 'ALL_FORMATS',
      label: 'Bumper, skippable, in-feed or Shorts',
      description: 'Use every format to reach the same users',
    },
    {
      value: 'IN_STREAM_ONLY',
      label: 'Only in-stream ad formats',
      description: 'Skippable, bumper and non-skippable up to 15 seconds',
    },
  ],
};

export interface YtStep1Props {
  /** Absolute path of the new line item page, without query. */
  base: string;
  type: 'YT_VIDEO' | 'YT_AUDIO';
  readOnly?: boolean;
  /** Blocking message when the advertiser lacks Google & partner inventory (LI-YT-021). */
  blocked?: string | null;
}

export function YtStep1({ base, type, readOnly, blocked }: YtStep1Props) {
  const router = useRouter();
  const audio = type === 'YT_AUDIO';
  const [name, setName] = useState('');
  const [optimization, setOptimization] = useState<YtOptimization>('REACH');
  const [choice, setChoice] = useState<YtAdFormatChoice | null>('EFFICIENT');
  const [more, setMore] = useState(false);
  const formats = FORMATS[optimization];
  const valid =
    name.trim() !== '' &&
    !blocked &&
    (audio || subtypeFrom(optimization, formats ? choice : null) !== null);

  const pickOptimization = (value: YtOptimization) => {
    setOptimization(value);
    setChoice(FORMATS[value]?.[0]?.value ?? null);
  };
  const next = () => {
    if (!valid) return;
    const q = new URLSearchParams({ type, name: name.trim() });
    if (!audio) {
      q.set('optimization', optimization);
      if (formats && choice) q.set('format', choice);
    }
    router.push(`${base}?${q.toString()}`);
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e) => e.preventDefault()}
      sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 720 }}
    >
      <Typography variant="h2">
        {audio
          ? 'New YouTube & partners audio line item'
          : 'New YouTube & partners video line item'}
      </Typography>
      {blocked ? (
        <Typography role="alert" color="error">
          {blocked}
        </Typography>
      ) : null}
      <DvTextField
        label="Line item name"
        required
        showRequiredHint
        id="yt-name"
        maxLength={LIMITS.NAME_MAX_255}
        value={name}
        readOnly={readOnly}
        onChange={setName}
      />
      {audio ? (
        <DvSectionCard title="Optimization" layout="stacked">
          <Typography variant="body2">
            Audio line items optimize for Reach: reach as many unique users as possible.
          </Typography>
        </DvSectionCard>
      ) : (
        <>
          <DvSectionCard title="Optimization" layout="stacked">
            <Typography variant="body2" color="text.secondary">
              Select what your line item will optimize towards
            </Typography>
            <DvRadioGroup
              label="Optimization"
              value={optimization}
              readOnly={readOnly}
              onChange={(v) => pickOptimization(v as YtOptimization)}
              options={[...OPTIMIZATIONS, ...(more ? [AD_SEQUENCE] : [])].map((o) => ({
                value: o.value,
                label: o.label,
                description: o.description,
              }))}
            />
            {!more ? (
              <Box>
                <Button variant="text" size="small" onClick={() => setMore(true)}>
                  Show more
                </Button>
              </Box>
            ) : null}
          </DvSectionCard>
          {formats ? (
            <DvSectionCard title="Ad format" layout="stacked">
              <DvRadioGroup
                label="Ad format"
                value={choice ?? ''}
                readOnly={readOnly}
                onChange={(v) => setChoice(v as YtAdFormatChoice)}
                options={formats.map((f) => ({
                  value: f.value,
                  label: f.label,
                  description: f.description,
                }))}
              />
            </DvSectionCard>
          ) : null}
        </>
      )}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="contained" disabled={!valid || readOnly} onClick={next}>
          Next
        </Button>
        <Button variant="text" onClick={() => router.back()}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
