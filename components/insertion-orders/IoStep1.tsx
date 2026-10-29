'use client';

// New insertion order, step 1 (module 07 2.1, AC-07-02, AC-07-03): type cards, then the objective list with a
// preview of the KPIs, bid strategies and line item types the objective allows. Next adds `?type=&objective=`.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { KPI_LABEL } from '@/lib/campaigns/kpi';
import { campaignPath } from '@/lib/routes/paths';
import {
  IO_OBJECTIVE_LABEL,
  type IoObjective,
  type IoType,
} from '@/lib/validation/constants/io-matrix';
import { LI_TYPE_LABEL } from '@/lib/validation/constants/li-compat';
import type { IoObjectiveMatrix } from '@/lib/insertion-orders/matrix';
import { BID_STRATEGY_LABEL, IO_TYPE_CHOICES } from '@/lib/insertion-orders/wire';

export function IoStep1({
  partnerId,
  advertiserId,
  campaignId,
  matrices,
}: {
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  matrices: Record<IoType, IoObjectiveMatrix>;
}) {
  const router = useRouter();
  const [type, setType] = useState<IoType | ''>('');
  const [objective, setObjective] = useState<IoObjective | ''>('');
  const matrix = type ? matrices[type] : null;
  const entry = matrix?.objectives.find((o) => o.key === objective) ?? null;
  const next = () =>
    router.push(
      `${campaignPath(partnerId, advertiserId, campaignId, 'ios', 'new')}?type=${type}&objective=${objective}`,
    );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DvRadioGroup
          label="Insertion order type"
          value={type}
          onChange={(v) => {
            setType(v as IoType);
            setObjective('');
          }}
          options={IO_TYPE_CHOICES.map((t) => ({
            value: t.value,
            label: t.label,
            description: t.description,
          }))}
        />
        {matrix ? (
          <DvRadioGroup
            label="Objective"
            value={objective}
            onChange={(v) => setObjective(v as IoObjective)}
            options={matrix.objectives.map((o) => ({
              value: o.key,
              label: o.label,
              description: o.description,
              disabled: !o.enabled,
              ...(o.disabledReason ? { disabledReason: o.disabledReason } : {}),
            }))}
          />
        ) : null}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" disabled={!type || !objective} onClick={next}>
            Next
          </Button>
          <Button onClick={() => router.back()}>Cancel</Button>
        </Box>
      </Box>
      <Box aria-label="Objective preview" role="region">
        {entry ? (
          <>
            <Typography variant="h6">{IO_OBJECTIVE_LABEL[entry.key]}</Typography>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              KPIs
            </Typography>
            <Typography variant="body2">
              {entry.kpis.length ? entry.kpis.map((k) => KPI_LABEL[k]).join(', ') : 'Any'}
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Bid strategies
            </Typography>
            <Typography variant="body2">
              {entry.bidStrategies.map((b) => BID_STRATEGY_LABEL[b]).join(', ')}
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Line item types
            </Typography>
            <Typography variant="body2">
              {entry.lineItemTypes.map((t) => LI_TYPE_LABEL[t]).join(', ')}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Choose a type and an objective to see what it allows.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
