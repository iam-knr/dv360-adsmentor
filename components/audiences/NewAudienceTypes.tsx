'use client';

// New audience (module 14 S5): three groups of radio cards. Choosing a card opens its form; "Learn more" opens the
// Adsmetor help slide-over (Q6), never Google.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvRadioGroup, DvSectionCard, DvSlideOver } from '@/components/dv';
import { advertiserPath } from '@/lib/routes/paths';

interface TypeDef {
  value: string;
  label: string;
  description: string;
  path: string[];
  help: string;
}

const GROUPS: { title: string; options: TypeDef[] }[] = [
  {
    title: 'First-party data',
    options: [
      {
        value: 'customermatch',
        label: 'Customer match',
        description: 'Reach your customers with identifiers you have collected, such as email addresses.',
        path: ['audience', 'customermatch', 'new'],
        help: 'Upload a CSV of customer identifiers or choose a connected data product. Identifiers are hashed in your browser. Lists with fewer than 1,000 matched users may not deliver.',
      },
      {
        value: 'tagbased',
        label: 'Tag-based audiences',
        description: 'Build a list from people who triggered a Floodlight activity with remarketing turned on.',
        path: ['audience', 'tagbased', 'new'],
        help: 'Pick a Floodlight activity that has remarketing on and, if you like, narrow it with custom variable rules.',
      },
      {
        value: 'youtubeusers',
        label: 'YouTube users',
        description: 'Reach people who interacted with your linked YouTube channel.',
        path: ['audience', 'youtubeusers', 'new'],
        help: 'Link a YouTube channel first, then choose which user action puts people on the list.',
      },
    ],
  },
  {
    title: 'Mixed audience types',
    options: [
      {
        value: 'combined',
        label: 'Combined audience',
        description: 'Combine lists with and, or and exclude to reach exactly the people you want.',
        path: ['combinedaudience', 'new'],
        help: 'Combined audiences are available immediately. Audiences in one group are combined with or; groups narrow with and.',
      },
    ],
  },
  {
    title: 'Lookalike audience',
    options: [
      {
        value: 'lookalike',
        label: 'Lookalike',
        description: 'Find new people similar to your seed lists. Only for Google and partners line items.',
        path: ['audience', 'lookalike', 'new'],
        help: 'Choose up to 10 first-party seed lists of at least 1,000 users, a reach from 2.5% to 10%, and the countries to cover.',
      },
    ],
  },
];

export function NewAudienceTypes({ partnerId, advertiserId }: { partnerId: string; advertiserId: string }) {
  const router = useRouter();
  const [help, setHelp] = useState<TypeDef | null>(null);
  const go = (def: TypeDef) => router.push(advertiserPath(partnerId, advertiserId, ...def.path));
  const all = GROUPS.flatMap((g) => g.options);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {GROUPS.map((g) => (
        <DvSectionCard key={g.title} title={g.title} layout="stacked">
          <DvRadioGroup
            label={g.title}
            variant="cards"
            value=""
            options={g.options.map((o) => ({ value: o.value, label: o.label, description: o.description }))}
            onChange={(v) => {
              const def = all.find((o) => o.value === v);
              if (def) go(def);
            }}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            {g.options.map((o) => (
              <Button key={o.value} size="small" onClick={() => setHelp(o)}>
                Learn more: {o.label}
              </Button>
            ))}
          </Box>
        </DvSectionCard>
      ))}
      <Box>
        <Button onClick={() => router.push(advertiserPath(partnerId, advertiserId, 'first-party-audiences'))}>Cancel</Button>
      </Box>
      <DvSlideOver open={help !== null} title={help?.label ?? ''} onCancel={() => setHelp(null)}>
        <Typography variant="body1">{help?.help}</Typography>
      </DvSlideOver>
    </Box>
  );
}
