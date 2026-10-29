'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvTextField } from '@/components/dv/DvTextField';
import { createCohortAction } from '@/lib/actions/accounts';

export function CohortForm({ defaultCapacity }: { defaultCapacity: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(String(defaultCapacity));
  const [error, setError] = useState<string | undefined>();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480 }}>
      <Typography variant="pageTitle" component="h1">
        New cohort
      </Typography>
      {error ? (
        <div role="alert">
          <DvBanner kind="error">{error}</DvBanner>
        </div>
      ) : null}
      <DvTextField label="Name" required value={name} onChange={setName} />
      <DvTextField
        label="Capacity"
        type="number"
        value={capacity}
        onChange={setCapacity}
        hint="1 to 60 users."
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button onClick={() => router.push('/manage/cohorts')}>Cancel</Button>
        <Button
          variant="contained"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createCohortAction({ name, capacity: Number(capacity) });
              if (!r.ok) setError(r.error);
              else {
                router.push('/manage/cohorts');
                router.refresh();
              }
            })
          }
        >
          Create cohort
        </Button>
      </Box>
    </Box>
  );
}
