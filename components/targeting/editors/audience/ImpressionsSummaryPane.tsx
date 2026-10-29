'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  AUDIENCE_MESSAGES,
  formatImpressions,
  type AudienceLists,
  type ImpressionsSummary,
} from '@/lib/targeting/audience';
import type { TargetingCriteria } from '@/lib/targeting/types';

const DEBOUNCE_MS = 300;

type State =
  { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; data: ImpressionsSummary };

export interface SummaryPaneProps {
  lists: AudienceLists;
  lineItemType: string;
  criteria: TargetingCriteria;
  advertiserId?: string;
  flightDays?: number;
}

/** Impressions summary (module 10 2.5): refreshes shortly after each change, through the estimate route. */
export function ImpressionsSummaryPane({
  lists,
  lineItemType,
  criteria,
  advertiserId,
  flightDays,
}: SummaryPaneProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const key = JSON.stringify([lists, lineItemType, criteria.environment, criteria.device]);

  useEffect(() => {
    const ctl = new AbortController();
    setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }));
    const timer = setTimeout(() => {
      fetch('/api/dv/audiences/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          audienceLists: lists,
          lineItemType,
          criteria: { environment: criteria.environment, device: criteria.device },
          ...(advertiserId ? { advertiserId } : {}),
          ...(flightDays ? { flightDays } : {}),
        }),
      })
        .then(async (r) => {
          if (!r.ok) return setState({ kind: 'unavailable' });
          setState({ kind: 'ready', data: (await r.json()) as ImpressionsSummary });
        })
        .catch((e: unknown) => {
          if ((e as { name?: string }).name !== 'AbortError') setState({ kind: 'unavailable' });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the serialised dependency list
  }, [key, advertiserId, flightDays]);

  return (
    <Box
      component="aside"
      aria-label="Impressions summary"
      data-testid="impressions-summary"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        alignSelf: 'start',
      }}
    >
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', p: 1.5 }}>
        <Typography variant="subtitle1" component="h4">
          Impressions summary
        </Typography>
        <Typography variant="caption">
          Based only on flight dates and targeting (without expansion)
        </Typography>
      </Box>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {state.kind === 'loading' ? (
          <Typography role="status" variant="body2" color="text.secondary">
            Loading impressions summary…
          </Typography>
        ) : null}
        {state.kind === 'unavailable' ? (
          <Typography role="status" variant="body2" color="text.secondary">
            {AUDIENCE_MESSAGES.UNAVAILABLE}
          </Typography>
        ) : null}
        {state.kind === 'ready' ? <Numbers s={state.data} /> : null}
      </Box>
    </Box>
  );
}

function Stat({ label, value, id }: { label: string; value: number; id: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" component="p" data-testid={id} sx={{ m: 0 }}>
        {formatImpressions(value)}
      </Typography>
    </Box>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Numbers({ s }: { s: ImpressionsSummary }) {
  const donut = 2 * Math.PI * 15.9;
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <Stat id="sum-overall" label="Overall impressions" value={s.overall} />
        <Stat id="sum-included" label="Included impressions" value={s.included} />
        <Stat id="sum-excluded" label="Excluded impressions" value={s.excluded} />
        <Stat id="sum-other" label="Other targeting" value={s.otherTargeting} />
      </Box>

      <Box>
        <svg
          viewBox="0 0 120 70"
          role="img"
          aria-label="Included and excluded audiences"
          style={{ width: '100%', maxHeight: 120 }}
        >
          <circle cx="45" cy="35" r="28" fill="#1a73e8" fillOpacity={0.35} />
          <circle
            cx="75"
            cy="35"
            r={Math.max(6, 28 * Math.sqrt(Math.max(s.venn.excludedPct, 4) / 100))}
            fill="#d93025"
            fillOpacity={0.35}
          />
        </svg>
        <Typography variant="caption" color="text.secondary">
          (Diagram not to scale)
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2">Gender</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <svg viewBox="0 0 36 36" width={72} height={72} role="img" aria-label="Gender split">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e8710a" strokeWidth="6" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="#1a73e8"
              strokeWidth="6"
              strokeDasharray={`${s.gender.male * donut} ${donut}`}
              transform="rotate(-90 18 18)"
            />
          </svg>
          <Box>
            <Typography variant="body2">Male {pct(s.gender.male)}</Typography>
            <Typography variant="body2">Female {pct(s.gender.female)}</Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Data available for {s.gender.coveragePct}% of impressions
        </Typography>
      </Box>

      <Bars title="Age" rows={Object.entries(s.age).map(([k, v]) => [k, v])} />
      <Bars
        title="Desktop vs. Mobile"
        rows={[
          ['Desktop', s.device.desktop],
          ['Mobile', s.device.mobile],
          ['Tablet', s.device.tablet],
          ['CTV', s.device.ctv],
        ]}
      />
    </>
  );
}

function Bars({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      {rows.map(([label, v]) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          <Typography variant="caption" sx={{ width: 64 }}>
            {label}
          </Typography>
          <Box sx={{ flex: 1, bgcolor: 'action.hover', height: 8, borderRadius: 1 }}>
            <Box
              sx={{
                width: `${Math.round(v * 100)}%`,
                height: 8,
                borderRadius: 1,
                bgcolor: 'primary.main',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right' }}>
            {pct(v)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
