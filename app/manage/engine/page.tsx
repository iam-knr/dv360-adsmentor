import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { pageActor } from '@/lib/accounts/session-actor';
import { readEngineParams } from '@/lib/manage/engine';

export const metadata: Metadata = { title: 'Engine | DV360 Simulator by Adsmetor' };
export const dynamic = 'force-dynamic';

// Read only in this release: the parameter file ships with the code, so a change is a code change (docs/gaps/p5-01.md).
export default async function AdminEnginePage() {
  const actor = await pageActor();
  if (actor.role !== 'SUPER_ADMIN') notFound();
  const p = readEngineParams();
  return (
    <Box>
      <DvPageHeader title="Engine parameters" />
      <Typography sx={{ mb: 4 }} data-testid="engine-version">
        Version {p.hash} · {p.bytes.toLocaleString('en-US')} bytes · read only
      </Typography>
      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        {p.top.map(([key, value]) => (
          <DvSectionCard key={key} title={key}>
            <Box component="pre" sx={{ m: 0, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
              {JSON.stringify(value, null, 2)}
            </Box>
          </DvSectionCard>
        ))}
      </Box>
    </Box>
  );
}
