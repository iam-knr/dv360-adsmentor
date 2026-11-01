'use client';

// Chart cards of the campaign and IO pages (module 06 2.4, AC-06-17, fidelity audit CAM-063): five FIXED built-in
// cards in a row (Total cost, Avg. performance, Impressions lost, Added impression reach, Explore budget options),
// no carousel arrows, a spinner while the cards load and no captions in the empty cards. Card data belongs to
// module 11, so the cards stay empty after loading. Saved custom charts follow the built-in cards.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { DvChartCard } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useCustomCharts } from '@/components/charts/CustomCharts';
import { useViewer } from '@/components/shell/ViewerProvider';

const LOAD_MS = 600;

function Spinner() {
  return <CircularProgress size={24} aria-label="Loading" role="progressbar" sx={{ alignSelf: 'center' }} />;
}

export function CampaignChartStrip({
  scope = 'CAMPAIGN',
  scopeId,
}: {
  scope?: 'CAMPAIGN' | 'IO' | 'LI';
  scopeId: string;
}) {
  const custom = useCustomCharts(scope, scopeId);
  const { clock } = useViewer().chrome;
  // The sim date of yesterday: the card covers the last full day.
  const lostPeriod = clock
    ? `(${new Intl.DateTimeFormat('en-US', { timeZone: clock.timeZone, month: 'short', day: 'numeric' }).format(new Date(new Date(clock.simNow).getTime() - 86_400_000))})`
    : undefined;
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), LOAD_MS);
    return () => clearTimeout(t);
  }, []);
  const body = loading ? <Spinner /> : null;
  return (
    <>
      {custom.panel}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={custom.onCustomize}>
            Customize charts
          </Button>
          {custom.suggestions.map((s) => (
            <Chip
              key={s}
              variant="outlined"
              icon={<DvIcon name="auto_awesome" size={16} />}
              label={s}
              onClick={() => custom.onSuggestion(s)}
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            onClick={custom.onTour}
            startIcon={<DvIcon name="tour" size={18} />}
          >
            Tour custom charts
          </Button>
          <Button size="small" onClick={custom.onShare} startIcon={<DvIcon name="share" size={18} />}>
            Share
          </Button>
        </Box>
        <Box
          role="region"
          aria-label="Charts"
          data-testid="chart-cards"
          aria-busy={loading || undefined}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
        >
          <DvChartCard title="Total cost" locked>
            {body}
          </DvChartCard>
          <DvChartCard title="Avg. performance" locked>
            {body}
          </DvChartCard>
          <DvChartCard
            title="Impressions lost"
            {...(lostPeriod ? { period: lostPeriod } : {})}
            help="Impressions that were lost to budget, pacing, minimum bid or external bids."
            locked
          >
            {body}
          </DvChartCard>
          <DvChartCard
            title="Added impression reach"
            help="Extra reach a looser frequency cap or more audience data would add."
            locked
          >
            {body}
          </DvChartCard>
          <DvChartCard title="Explore budget options" locked>
            {body}
          </DvChartCard>
          {custom.cards}
        </Box>
      </Box>
    </>
  );
}
