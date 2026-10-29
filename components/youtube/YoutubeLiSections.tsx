'use client';

// The YouTube sections of the line item form (module 09 2.2): subtype line, ad format ticks, budget and pacing, locked
// bid strategy, exposure / view / target frequency, product feed, related videos and inventory sources. Rendered by
// `LiForm` for YT_VIDEO and YT_AUDIO; the shared form keeps name, status, flight, conversions, EU ads and targeting.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import type { LiFormValue } from '@/lib/line-items/form';
import { BID_STRATEGY_LABEL } from '@/lib/line-items/type-config';
import { FREQ_PERIODS } from '@/lib/validation/constants/frequency';
import {
  subtypeLine,
  YT_INVENTORY_LABEL,
  YT_INVENTORY_SOURCES,
  YT_SUBTYPE_INFO,
  YT_SURFACE_LABEL,
  type YtInventorySource,
  type YtSurface,
} from '@/lib/validation/constants/youtube';
import { MSG } from '@/lib/validation/messages';
import { lookupVideosAction } from '@/lib/youtube/actions';
import type { FrequencyCapInput, YoutubeLiInput } from '@/lib/validation/types';
import type { YoutubeVideoHit } from '@/lib/youtube/types';

export interface YtSectionProps {
  value: LiFormValue;
  yt: YoutubeLiInput;
  set: (patch: Partial<LiFormValue>) => void;
  setYt: (patch: Partial<YoutubeLiInput>) => void;
  ro: boolean;
  currency: string;
  mode: 'create' | 'edit';
  err: (path: string) => string | undefined;
}

const SURFACE_KEY: Record<YtSurface, 'inStream' | 'inFeed' | 'shorts'> = {
  IN_STREAM: 'inStream',
  IN_FEED: 'inFeed',
  SHORTS: 'shorts',
};

export function YtSubtypeCard({ yt, setYt, ro, err }: YtSectionProps) {
  const info = YT_SUBTYPE_INFO[yt.subtype!];
  return (
    <DvSectionCard title="Line item subtype" layout="settings">
      <Typography variant="body2" data-testid="yt-subtype">
        {subtypeLine(yt.subtype!)}
      </Typography>
      {info.pickable ? (
        <Box role="group" aria-label="Ad format">
          <Typography variant="subtitle2">Ad format</Typography>
          <Typography variant="body2" color="text.secondary">
            Your video ad will be shown using as many ad formats as possible.
          </Typography>
          {info.surfaces.map((s) => (
            <FormControlLabel
              key={s}
              disabled={ro}
              control={
                <Checkbox
                  checked={yt.adFormats[SURFACE_KEY[s]]}
                  onChange={(e) =>
                    setYt({ adFormats: { ...yt.adFormats, [SURFACE_KEY[s]]: e.target.checked } })
                  }
                />
              }
              label={YT_SURFACE_LABEL[s]}
            />
          ))}
          {err('youtube.adFormats') ? (
            <Typography role="alert" color="error" variant="body2">
              {err('youtube.adFormats')}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </DvSectionCard>
  );
}

export function YtBudgetPacingCard({ value, set, ro, currency, err }: YtSectionProps) {
  const daily = (value.pacing.period ?? 'DAILY') === 'DAILY';
  return (
    <DvSectionCard title="Budget and pacing" layout="settings">
      <DvSelect
        label="Budget period"
        value={daily ? 'DAILY' : 'FLIGHT'}
        disabled={ro}
        options={[
          { value: 'DAILY', label: 'Daily' },
          { value: 'FLIGHT', label: 'Flight' },
        ]}
        onChange={(period) =>
          set(
            period === 'DAILY'
              ? {
                  pacing: { ...value.pacing, period: 'DAILY' },
                  budget: { mode: 'UNLIMITED', amount: null },
                }
              : {
                  pacing: { ...value.pacing, period: 'FLIGHT', dailyAmount: null },
                  budget: { mode: 'AMOUNT', amount: value.budget.amount ?? '' },
                },
          )
        }
      />
      <DvSelect
        label="Pacing"
        value={value.pacing.type ?? 'EVEN'}
        disabled={ro}
        options={[
          { value: 'EVEN', label: 'Even' },
          { value: 'ASAP', label: 'ASAP' },
        ]}
        onChange={(t) => set({ pacing: { ...value.pacing, type: t as 'EVEN' | 'ASAP' } })}
      />
      {daily ? (
        <DvTextField
          label="Daily amount"
          required
          numeric
          id="yt-daily-amount"
          prefix={currency}
          value={String(value.pacing.dailyAmount ?? '')}
          readOnly={ro}
          error={err('pacing.dailyAmount')}
          onChange={(dailyAmount) => set({ pacing: { ...value.pacing, dailyAmount } })}
        />
      ) : (
        <DvTextField
          label="Flight budget"
          required
          numeric
          id="yt-flight-budget"
          prefix={currency}
          value={String(value.budget.amount ?? '')}
          readOnly={ro}
          error={err('budget.amount')}
          onChange={(amount) => set({ budget: { mode: 'AMOUNT', amount } })}
        />
      )}
      <Typography variant="body2" color="text.secondary">
        {MSG.YT_PACING_NOTE}
      </Typography>
    </DvSectionCard>
  );
}

export function YtBidCard({ yt }: YtSectionProps) {
  const strategy = YT_SUBTYPE_INFO[yt.subtype!].liBid;
  return (
    <DvSectionCard title="Bid strategy" layout="settings">
      <Typography variant="body2" data-testid="yt-bid">
        Automated bidding, optimized towards {BID_STRATEGY_LABEL[strategy]}. The bid value is set on
        each ad group.
      </Typography>
    </DvSectionCard>
  );
}

function CapBlock({
  title,
  cap,
  unit,
  ro,
  errorPath,
  err,
  onChange,
  idPrefix,
}: {
  title: string;
  cap: FrequencyCapInput;
  unit: 'exposures' | 'views';
  ro: boolean;
  errorPath: string;
  err: (p: string) => string | undefined;
  onChange: (cap: FrequencyCapInput) => void;
  idPrefix: string;
}) {
  return (
    <Box role="group" aria-label={title}>
      <Typography variant="subtitle2">{title}</Typography>
      <DvRadioGroup
        value={cap.mode === 'LIMITED' ? 'LIMITED' : 'UNLIMITED'}
        readOnly={ro}
        onChange={(m) => onChange({ ...cap, mode: m as FrequencyCapInput['mode'] })}
        options={[
          { value: 'UNLIMITED', label: 'No limit' },
          {
            value: 'LIMITED',
            label: `Limit frequency to`,
            inline: (selected) => (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <DvTextField
                  ariaLabel={`${title} ${unit}`}
                  id={`${idPrefix}-max`}
                  numeric
                  disabled={!selected}
                  value={String(cap.maxImpressions ?? '')}
                  error={err(errorPath)}
                  onChange={(maxImpressions) => onChange({ ...cap, maxImpressions })}
                />
                <span>{unit} per</span>
                <DvSelect
                  ariaLabel={`${title} period`}
                  value={cap.period ?? 'WEEK'}
                  disabled={!selected}
                  options={FREQ_PERIODS.map((p) => ({ value: p, label: p.toLowerCase() }))}
                  onChange={(p) => onChange({ ...cap, period: p as typeof cap.period })}
                />
              </Box>
            ),
          },
        ]}
      />
    </Box>
  );
}

export function YtFrequencyCard(props: YtSectionProps) {
  const { value, yt, set, setYt, ro, err } = props;
  const info = YT_SUBTYPE_INFO[yt.subtype!];
  const tf = yt.targetFrequency ?? {
    mode: 'LIMITED' as const,
    maxImpressions: '',
    periodCount: 1,
    period: 'WEEK' as const,
  };
  return (
    <DvSectionCard title="Frequency cap" layout="stacked">
      <CapBlock
        title="Exposure Frequency"
        unit="exposures"
        cap={value.frequencyCap}
        ro={ro}
        err={err}
        errorPath="frequencyCap.maxImpressions"
        idPrefix="yt-exposure"
        onChange={(frequencyCap) => set({ frequencyCap })}
      />
      {info.viewCap ? (
        <CapBlock
          title="View Frequency"
          unit="views"
          cap={yt.viewCap}
          ro={ro}
          err={err}
          errorPath="youtube.viewCap.maxImpressions"
          idPrefix="yt-view"
          onChange={(viewCap) => setYt({ viewCap })}
        />
      ) : null}
      {info.targetFrequency ? (
        <Box
          role="group"
          aria-label="Target frequency"
          sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}
        >
          <DvTextField
            label="Target frequency"
            required
            numeric
            id="yt-target-frequency"
            value={String(tf.maxImpressions ?? '')}
            readOnly={ro}
            error={err('youtube.targetFrequency.maxImpressions')}
            onChange={(maxImpressions) => setYt({ targetFrequency: { ...tf, maxImpressions } })}
          />
          <Box sx={{ pt: 6 }}>exposures per</Box>
          <Box sx={{ pt: 4 }}>
            <DvSelect
              ariaLabel="Target frequency period"
              value={tf.period ?? 'WEEK'}
              disabled={ro}
              options={FREQ_PERIODS.map((p) => ({ value: p, label: p.toLowerCase() }))}
              onChange={(p) => setYt({ targetFrequency: { ...tf, period: p as typeof tf.period } })}
            />
          </Box>
        </Box>
      ) : null}
    </DvSectionCard>
  );
}

export function YtExtrasCard({ yt, setYt, ro, err }: YtSectionProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<YoutubeVideoHit[]>([]);
  const find = () => void lookupVideosAction(q).then(setHits);
  const toggleSource = (s: YtInventorySource, on: boolean) =>
    setYt({
      inventorySources: on
        ? YT_INVENTORY_SOURCES.filter((x) => x === s || yt.inventorySources.includes(x))
        : yt.inventorySources.filter((x) => x !== s),
    });
  return (
    <>
      <DvSectionCard title="Inventory sources" layout="settings">
        {YT_INVENTORY_SOURCES.map((s) => (
          <FormControlLabel
            key={s}
            disabled={ro}
            control={
              <Checkbox
                checked={yt.inventorySources.includes(s)}
                onChange={(e) => toggleSource(s, e.target.checked)}
              />
            }
            label={YT_INVENTORY_LABEL[s]}
          />
        ))}
        {err('youtube.inventorySources') ? (
          <Typography role="alert" color="error" variant="body2">
            {err('youtube.inventorySources')}
          </Typography>
        ) : null}
      </DvSectionCard>
      <DvSectionCard title="Product feed" layout="settings">
        <FormControlLabel
          disabled={ro}
          control={
            <Checkbox
              checked={yt.productFeed}
              onChange={(e) => setYt({ productFeed: e.target.checked })}
            />
          }
          label="Use a Google Merchant Center product feed to show relevant products in your ads"
        />
        {err('youtube.productFeed') ? (
          <Typography role="alert" color="error" variant="body2">
            {err('youtube.productFeed')}
          </Typography>
        ) : null}
      </DvSectionCard>
      <DvSectionCard title="Related videos" layout="settings">
        <Typography variant="body2">
          Add videos related to your video ads to increase engagement
        </Typography>
        <Typography variant="body2" data-testid="related-videos">
          {yt.relatedVideoIds.length === 0 ? 'No related videos' : yt.relatedVideoIds.join(', ')}
        </Typography>
        {!ro ? (
          <Box>
            <Button variant="outlined" size="small" onClick={() => setOpen(!open)}>
              Edit related videos
            </Button>
          </Box>
        ) : null}
        {open ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DvTextField
              label="Search for a video"
              id="yt-related-q"
              value={q}
              onChange={setQ}
              onBlur={find}
            />
            {hits.map((h) => (
              <FormControlLabel
                key={h.videoId}
                control={
                  <Checkbox
                    checked={yt.relatedVideoIds.includes(h.videoId)}
                    onChange={(e) =>
                      setYt({
                        relatedVideoIds: e.target.checked
                          ? [...yt.relatedVideoIds, h.videoId]
                          : yt.relatedVideoIds.filter((x) => x !== h.videoId),
                      })
                    }
                  />
                }
                label={`${h.title} · ${h.channelName} · ${h.durationSec}s`}
              />
            ))}
          </Box>
        ) : null}
      </DvSectionCard>
    </>
  );
}
