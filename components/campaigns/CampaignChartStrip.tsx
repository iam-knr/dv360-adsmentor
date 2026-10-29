'use client';

// Chart strip of the campaign page (module 06 2.4, AC-06-17): the five built-in cards in their empty state. Card data
// belongs to module 11 (T06-06), so with no selection the cards show the explore 03 empty-state texts.
import Typography from '@mui/material/Typography';
import { DvChartCard, DvChartStrip } from '@/components/dv';

const Hint = ({ children }: { children: string }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

export function CampaignChartStrip() {
  return (
    <DvChartStrip>
      <DvChartCard title="Total cost" period="(flight start - Today)" locked>
        <Hint>No spend yet for this period.</Hint>
      </DvChartCard>
      <DvChartCard title="Avg. performance" locked>
        <Hint>No delivery yet to compare with the goal.</Hint>
      </DvChartCard>
      <DvChartCard
        title="Impressions lost"
        help="Impressions that were lost to budget, pacing, minimum bid or external bids."
        locked
        empty={
          <Hint>
            To see impressions lost, check the box next to an insertion order, or line items within
            the same insertion order.
          </Hint>
        }
      />
      <DvChartCard
        title="Added impression reach"
        help="Extra reach a looser frequency cap or more audience data would add."
        locked
        empty={
          <Hint>
            Added reach appears here once a frequency cap or audience data limits the delivery of
            the selected items.
          </Hint>
        }
      />
      <DvChartCard
        title="Explore budget options"
        locked
        empty={<Hint>To explore budget options, select a single insertion order.</Hint>}
      />
    </DvChartStrip>
  );
}
