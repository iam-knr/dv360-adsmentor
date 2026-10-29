'use client';

// Line item create and edit (module 08 2.3 to 2.5). The form holds a `LiFormValue`; the server runs every rule and
// returns issues by path, so the messages are the catalogue's. Locks from the IO automation and from creation come
// in `locked` and make the field read-only (AC-08-10, AC-08-27).
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvFormFooter, focusFirstInvalid } from '@/components/dv/DvFormPage';
import { DvPickerDialog } from '@/components/dv/DvPickerDialog';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { TargetingCard } from '@/components/targeting';
import {
  YtBidCard,
  YtBudgetPacingCard,
  YtExtrasCard,
  YtFrequencyCard,
  YtSubtypeCard,
  type YtSectionProps,
} from '@/components/youtube/YoutubeLiSections';
import { isYoutubeType } from '@/lib/youtube/li';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import {
  createLineItemAction,
  getCopyCandidatesAction,
  getCopySourceAction,
  updateLineItemAction,
  validateLineItemAction,
} from '@/lib/line-items/actions';
import {
  mergeCopySettings,
  type FieldLock,
  type FormIo,
  type LiFormValue,
} from '@/lib/line-items/form';
import {
  BID_STRATEGY_LABEL,
  LI_TYPE_LABEL,
  TYPE_CONFIG,
  bidOptions,
  exchangesText,
} from '@/lib/line-items/type-config';
import type {
  AppSearchRow,
  ConversionPickerRow,
  CopyCandidate,
  CreativePickerRow,
} from '@/lib/line-items/types';
import { lineItemLanding, liPath } from '@/lib/routes/paths';
import { LI_COUNTING_MODES } from '@/lib/validation/constants/conversions';
import { FREQ_PERIODS } from '@/lib/validation/constants/frequency';
import { CUSTOM_VALUE_STRATEGIES } from '@/lib/validation/constants/bids';
import type { CbOption } from '@/lib/resources/wire';
import type { Issue } from '@/lib/validation/types';

export interface LiFormProps {
  mode: 'create' | 'edit';
  partnerId: string;
  advertiserId: string;
  /** Row id of the advertiser (the service key), for the copy settings dialog. */
  advertiserRowId?: string;
  campaignId: string;
  ioPublicId: string;
  /** Row id of the parent IO (the service key). */
  ioId: string;
  liId?: string;
  version?: number;
  currency: string;
  initial: LiFormValue;
  io: FormIo;
  locked: FieldLock[];
  creatives: CreativePickerRow[];
  conversions?: ConversionPickerRow[];
  /** Custom bidding algorithms for the Maximize / Target custom value strategies (module 15). */
  algorithms?: CbOption[];
  /** The chosen app of a Mobile app install line item (read-only, LI-APP-008). */
  app?: AppSearchRow | null;
  higherCapText: string | null;
  readOnly?: boolean;
}

export function LiForm({
  mode,
  partnerId,
  advertiserId,
  advertiserRowId,
  campaignId,
  ioPublicId,
  ioId,
  liId,
  version,
  currency,
  initial,
  io,
  locked,
  creatives,
  conversions = [],
  algorithms = [],
  app = null,
  higherCapText,
  readOnly,
}: LiFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<LiFormValue>(initial);
  const [saved, setSaved] = useState<LiFormValue>(initial);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'all' | 'eligible' | 'assigned'>('all');
  const [busy, startTransition] = useTransition();
  const [picker, setPicker] = useState<'conversions' | 'copy' | null>(null);
  const [copyCandidates, setCopyCandidates] = useState<CopyCandidate[]>([]);
  const [copyError, setCopyError] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedGuard(dirty);

  const type = value.type!;
  const config = TYPE_CONFIG[type];
  const set = (patch: Partial<LiFormValue>) => setValue((v) => ({ ...v, ...patch }));
  const isLocked = (path: string) => locked.some((l) => l.path === path);
  const known = new Set<string>();
  const err = (path: string) => {
    known.add(path);
    return issues.find((i) => i.path === path && i.blocking)?.message;
  };
  const warn = (path: string) => issues.find((i) => i.path === path && !i.blocking)?.message;
  const ro = !!readOnly;
  const yt = isYoutubeType(type) ? (value.youtube ?? null) : null;
  const ytProps: YtSectionProps | null = yt
    ? {
        value,
        yt,
        set,
        setYt: (patch) => set({ youtube: { ...yt, ...patch } }),
        ro,
        currency,
        mode,
        err,
      }
    : null;

  const automated = value.bid.mode === 'AUTOMATED';
  const strategies = bidOptions(io, type);
  const sameAsIo = value.flight.mode !== 'CUSTOM';

  const submit = () => {
    if (ro) return;
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createLineItemAction(ioId, value, note)
          : await updateLineItemAction(liId!, value, {
              note,
              ...(version !== undefined ? { expectedVersion: version } : {}),
            });
      if (!res.ok) {
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setIssues(res.warnings ?? []);
      setSaved(value);
      setNote('');
      if (mode === 'create' && 'publicId' in res.data)
        router.push(
          liPath(
            partnerId,
            advertiserId,
            campaignId,
            ioPublicId,
            res.data.publicId,
            lineItemLanding(type),
          ),
        );
      else router.refresh();
    });
  };
  const revalidate = (next: LiFormValue) =>
    void validateLineItemAction(ioId, next, liId).then((all) =>
      setIssues((cur) => [
        ...cur.filter((i) => i.blocking && i.path !== 'conversions.activities'),
        ...all.filter((i) => !i.blocking || i.path === 'conversions.activities'),
      ]),
    );

  const shownCreatives = creatives.filter((c) =>
    tab === 'eligible' ? c.eligible : tab === 'assigned' ? value.creatives.includes(c.id) : true,
  );
  const toggleCreative = (id: string) =>
    set({
      creatives: value.creatives.includes(id)
        ? value.creatives.filter((x) => x !== id)
        : [...value.creatives, id],
    });

  const openCopy = () => {
    setCopyError(null);
    void getCopyCandidatesAction(advertiserRowId!, type, liId).then((rows) => {
      setCopyCandidates(rows);
      setPicker('copy');
    });
  };
  const applyCopy = (ids: string[]) => {
    setPicker(null);
    const id = ids[0];
    if (!id) return;
    void getCopySourceAction(id).then((res) => {
      if (!res.ok) return setCopyError(res.issues[0]?.message ?? "Couldn't copy these settings.");
      setValue((v) => mergeCopySettings(v, res.data, io));
    });
  };
  const counting = value.conversions.countingMode ?? 'ALL';
  const chosenConversions = conversions.filter((c) => value.conversions.activities.includes(c.id));
  const cap = value.frequencyCap;
  // The YouTube sections are child components, so their paths are known up front.
  if (yt)
    for (const p of [
      'youtube.adFormats',
      'youtube.viewCap.maxImpressions',
      'youtube.targetFrequency.maxImpressions',
      'youtube.productFeed',
      'youtube.inventorySources',
      'frequencyCap.maxImpressions',
      'pacing.dailyAmount',
      'budget.amount',
    ])
      known.add(p);
  const unmatched = issues.filter((i) => i.blocking && !known.has(i.path));

  return (
    <Box component="form" noValidate onSubmit={(e) => e.preventDefault()}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Typography variant="body2">
          {LI_TYPE_LABEL[type]} · {io.name}
        </Typography>

        <DvSectionCard title="Basic details" layout="settings">
          {app ? (
            <Box data-testid="li-app">
              <Typography variant="subtitle2">Mobile app</Typography>
              <Typography variant="body2">
                {app.name} · {app.publisher}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {app.storeLine}
              </Typography>
            </Box>
          ) : null}
          {value.adType ? (
            <Typography variant="body2">
              Ad type: {value.adType === 'VIDEO' ? 'Video' : 'Display'}
            </Typography>
          ) : null}
          <DvTextField
            label="Line item name"
            required
            id="name"
            value={value.name}
            readOnly={ro}
            error={err('name')}
            onChange={(name) => set({ name })}
          />
          <DvSelect
            label="Status"
            value={value.status ?? 'DRAFT'}
            disabled={ro}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ACTIVE', label: 'Active' },
              ...(mode === 'edit' ? [{ value: 'PAUSED', label: 'Paused' }] : []),
            ]}
            onChange={(status) => set({ status: status as LiFormValue['status'] })}
          />
          {!ro && advertiserRowId && !yt ? (
            <Box>
              <Button variant="text" size="small" onClick={openCopy}>
                Copy settings from an existing line item
              </Button>
              {copyError ? (
                <Typography role="alert" color="error" variant="body2">
                  {copyError}
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </DvSectionCard>

        {ytProps ? <YtSubtypeCard {...ytProps} /> : null}

        {type === 'DEMAND_GEN' ? (
          <Typography variant="body2" role="note">
            Demand Gen line items use Google inventory. Create ad groups and ads on the Ad groups
            tab after you create the line item.
          </Typography>
        ) : null}

        {config.exchanges ? (
          <DvSectionCard title="Inventory" layout="settings">
            <Typography variant="body2">
              {value.inventory.quality ? 'Authorized Direct Sellers And Resellers · ' : ''}
              {exchangesText(value.inventory.exchanges.length)}
            </Typography>
            {config.inventoryNote ? (
              <Typography variant="body2" color="text.secondary">
                {config.inventoryNote}
              </Typography>
            ) : null}
          </DvSectionCard>
        ) : null}

        <DvSectionCard title="Flight dates" layout="settings">
          <DvRadioGroup
            value={sameAsIo ? 'SAME' : 'CUSTOM'}
            readOnly={ro}
            onChange={(m) =>
              set({ flight: { ...value.flight, mode: m === 'SAME' ? 'SAME_AS_IO' : 'CUSTOM' } })
            }
            options={[
              {
                value: 'SAME',
                label: io.flight
                  ? `Use same dates as insertion order (${io.flight.start} to ${io.flight.end})`
                  : 'Use same dates as insertion order',
              },
              { value: 'CUSTOM', label: 'Custom dates' },
            ]}
          />
          {!sameAsIo ? (
            <>
              <DvTextField
                label="Start date"
                placeholder="YYYY-MM-DD"
                value={value.flight.startDate ?? ''}
                locked={isLocked('flight.startDate')}
                readOnly={ro}
                error={err('flight.startDate')}
                onChange={(startDate) => set({ flight: { ...value.flight, startDate } })}
              />
              <DvTextField
                label="End date"
                placeholder="YYYY-MM-DD"
                value={value.flight.endDate ?? ''}
                readOnly={ro}
                error={err('flight.endDate')}
                onChange={(endDate) => set({ flight: { ...value.flight, endDate } })}
              />
            </>
          ) : null}
        </DvSectionCard>

        {ytProps ? <YtBudgetPacingCard {...ytProps} /> : null}

        {!yt ? (
          <DvSectionCard title="Budget" layout="settings">
            <DvRadioGroup
              value={value.budget.mode}
              readOnly={ro}
              onChange={(m) =>
                set({ budget: { ...value.budget, mode: m as 'UNLIMITED' | 'AMOUNT' } })
              }
              options={[
                { value: 'UNLIMITED', label: 'Unlimited' },
                { value: 'AMOUNT', label: 'Amount' },
              ]}
            />
            {value.budget.mode === 'AMOUNT' ? (
              <DvTextField
                label="Budget"
                numeric
                prefix={currency}
                value={String(value.budget.amount ?? '')}
                readOnly={ro}
                error={err('budget.amount')}
                onChange={(amount) => set({ budget: { ...value.budget, amount } })}
              />
            ) : null}
          </DvSectionCard>
        ) : null}

        {!yt ? (
          <DvSectionCard title="Pacing" layout="settings">
            {isLocked('pacing') ? (
              <Typography variant="body2">
                Pacing is set by the insertion order&apos;s optimization (Flight, ASAP).
              </Typography>
            ) : (
              <>
                <DvSelect
                  label="Pacing period"
                  value={value.pacing.period ?? 'FLIGHT'}
                  disabled={ro}
                  options={[
                    { value: 'FLIGHT', label: 'Flight' },
                    { value: 'DAILY', label: 'Daily' },
                  ]}
                  onChange={(period) =>
                    set({ pacing: { ...value.pacing, period: period as 'FLIGHT' | 'DAILY' } })
                  }
                />
                <DvSelect
                  label="Pacing type"
                  value={value.pacing.type ?? 'EVEN'}
                  disabled={ro}
                  options={[
                    { value: 'EVEN', label: 'Even' },
                    { value: 'ASAP', label: 'ASAP' },
                    ...(value.pacing.period === 'FLIGHT'
                      ? [{ value: 'AHEAD', label: 'Ahead' }]
                      : []),
                  ]}
                  onChange={(t) => set({ pacing: { ...value.pacing, type: t as 'EVEN' } })}
                />
                {value.pacing.period === 'DAILY' ? (
                  <DvTextField
                    label="Daily amount"
                    numeric
                    prefix={currency}
                    value={String(value.pacing.dailyAmount ?? '')}
                    readOnly={ro}
                    error={err('pacing.dailyAmount')}
                    onChange={(dailyAmount) => set({ pacing: { ...value.pacing, dailyAmount } })}
                  />
                ) : null}
              </>
            )}
          </DvSectionCard>
        ) : null}

        {ytProps ? <YtBidCard {...ytProps} /> : null}

        {!yt ? (
          <DvSectionCard title="Bid strategy" layout="settings">
            {isLocked('bid') ? (
              <Typography variant="body2">
                Bid strategy comes from the insertion order:{' '}
                {io.optimizedTowards ? BID_STRATEGY_LABEL[io.optimizedTowards] : 'Automated'}.
              </Typography>
            ) : (
              <>
                {config.bidModes.length > 1 ? (
                  <DvRadioGroup
                    value={value.bid.mode ?? 'FIXED'}
                    readOnly={ro}
                    onChange={(m) =>
                      set({ bid: { ...value.bid, mode: m as 'FIXED' | 'AUTOMATED' } })
                    }
                    options={[
                      { value: 'FIXED', label: 'Fixed bid' },
                      { value: 'AUTOMATED', label: 'Optimize bids automatically' },
                    ]}
                  />
                ) : null}
                {automated ? (
                  <>
                    <DvSelect
                      label="Optimized towards"
                      value={value.bid.optimizedTowards ?? ''}
                      disabled={ro}
                      error={err('bid.optimizedTowards')}
                      options={strategies.map((s) => ({ value: s, label: BID_STRATEGY_LABEL[s] }))}
                      onChange={(s) =>
                        set({
                          bid: {
                            ...value.bid,
                            optimizedTowards: s as never,
                            ...(CUSTOM_VALUE_STRATEGIES.includes(s as never)
                              ? {}
                              : { customBiddingAlgorithmId: null }),
                          },
                        })
                      }
                    />
                    {value.bid.optimizedTowards &&
                    CUSTOM_VALUE_STRATEGIES.includes(value.bid.optimizedTowards) ? (
                      <DvSelect
                        label="Custom bidding algorithm"
                        required
                        value={value.bid.customBiddingAlgorithmId ?? ''}
                        disabled={ro}
                        placeholder="Select an algorithm"
                        error={err('bid.customBiddingAlgorithmId')}
                        warning={
                          algorithms.find((a) => a.id === value.bid.customBiddingAlgorithmId)
                            ?.status === 'TRAINING'
                            ? 'This algorithm is still training, so bids use a fallback until it is ready.'
                            : undefined
                        }
                        options={algorithms.map((a) => ({
                          value: a.id,
                          label: `${a.name} (${a.status === 'ACTIVE' ? 'Active' : a.status === 'TRAINING' ? `Training ${a.readinessPct}%` : 'Suspended'})`,
                        }))}
                        onChange={(id) =>
                          set({ bid: { ...value.bid, customBiddingAlgorithmId: id || null } })
                        }
                      />
                    ) : null}
                  </>
                ) : (
                  <DvTextField
                    label="Fixed bid (CPM)"
                    numeric
                    prefix={currency}
                    value={String(value.bid.fixedCpm ?? '')}
                    readOnly={ro}
                    error={err('bid.fixedCpm')}
                    onChange={(fixedCpm) => set({ bid: { ...value.bid, fixedCpm } })}
                  />
                )}
              </>
            )}
          </DvSectionCard>
        ) : null}

        {ytProps ? <YtFrequencyCard {...ytProps} /> : null}

        {config.frequency && !yt ? (
          <DvSectionCard title="Frequency cap" layout="settings">
            {higherCapText ? <Typography variant="body2">{higherCapText}</Typography> : null}
            <DvRadioGroup
              value={cap.mode}
              readOnly={ro}
              onChange={(m) => set({ frequencyCap: { ...cap, mode: m as typeof cap.mode } })}
              options={[
                { value: 'INHERIT', label: 'Unlimited' },
                {
                  value: 'LIMITED',
                  label: 'Limit frequency to',
                  inline: (selected) => (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <DvTextField
                        ariaLabel="Exposures"
                        numeric
                        disabled={!selected}
                        value={String(cap.maxImpressions ?? '')}
                        error={err('frequencyCap.maxImpressions')}
                        onChange={(maxImpressions) =>
                          set({ frequencyCap: { ...cap, maxImpressions } })
                        }
                      />
                      <span>exposures per</span>
                      <DvSelect
                        value={cap.period ?? 'MONTH'}
                        disabled={!selected}
                        options={FREQ_PERIODS.map((p) => ({ value: p, label: p.toLowerCase() }))}
                        onChange={(p) => set({ frequencyCap: { ...cap, period: p as 'MONTH' } })}
                      />
                    </Box>
                  ),
                },
              ]}
            />
          </DvSectionCard>
        ) : null}

        {ytProps ? <YtExtrasCard {...ytProps} /> : null}

        {config.creatives ? (
          <DvSectionCard title="Creatives" layout="stacked">
            <Box sx={{ display: 'flex', gap: 2 }} role="tablist" aria-label="Creative filter">
              {(['all', 'eligible', 'assigned'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t === 'all' ? 'All' : t === 'eligible' ? 'Eligible' : 'Assigned'}
                </button>
              ))}
            </Box>
            {shownCreatives.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No creatives
              </Typography>
            ) : null}
            {shownCreatives.map((c) => (
              <FormControlLabel
                key={c.id}
                disabled={ro || (!c.eligible && !value.creatives.includes(c.id))}
                control={
                  <Checkbox
                    checked={value.creatives.includes(c.id)}
                    onChange={() => toggleCreative(c.id)}
                  />
                }
                label={`${c.name} (${c.format}${c.dimensions ? `, ${c.dimensions}` : ''})${c.eligible ? '' : ` — ${c.reason ?? 'not eligible'}`}`}
              />
            ))}
            {err('creatives') ? (
              <Typography role="alert" color="error" variant="body2">
                {err('creatives')}
              </Typography>
            ) : null}
          </DvSectionCard>
        ) : null}

        {config.conversions ? (
          <DvSectionCard title="Conversions" layout="settings">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">
                {chosenConversions.length === 0
                  ? 'No conversions selected'
                  : `${chosenConversions.length} selected: ${chosenConversions.map((c) => c.name).join(', ')}`}
              </Typography>
              {!ro ? (
                <Box>
                  <Button variant="outlined" size="small" onClick={() => setPicker('conversions')}>
                    Select conversions
                  </Button>
                </Box>
              ) : null}
              {err('conversions.activities') ? (
                <Typography role="alert" color="error" variant="body2">
                  {err('conversions.activities')}
                </Typography>
              ) : null}
            </Box>
            <DvSelect
              label="Conversion counting"
              value={counting}
              disabled={ro}
              options={LI_COUNTING_MODES.map((m) => ({
                value: m,
                label:
                  m === 'ALL'
                    ? 'Count all conversions'
                    : m === 'POST_CLICK_ONLY'
                      ? 'Count only post-click conversions'
                      : 'Count a percentage of conversions',
              }))}
              onChange={(m) =>
                set({ conversions: { ...value.conversions, countingMode: m as typeof counting } })
              }
            />
            {counting === 'PERCENTAGE' ? (
              <DvTextField
                label="Count % of post-views and all post-clicks"
                numeric
                value={String(value.conversions.postViewPct ?? '')}
                readOnly={ro}
                error={err('conversions.postViewPct')}
                onChange={(postViewPct) =>
                  set({ conversions: { ...value.conversions, postViewPct } })
                }
              />
            ) : null}
            <Typography variant="body2">Attribution model: Primary model</Typography>
          </DvSectionCard>
        ) : null}

        <DvSectionCard title="Political ads in the European Union" layout="settings">
          <DvRadioGroup
            value={value.euPoliticalAds ?? ''}
            readOnly={ro}
            error={err('euPoliticalAds')}
            onChange={(v) => {
              const next = { ...value, euPoliticalAds: v as 'YES' | 'NO' };
              setValue(next);
              revalidate(next);
            }}
            options={[
              { value: 'NO', label: 'Does not contain EU political ads' },
              { value: 'YES', label: 'Contains EU political ads' },
            ]}
          />
          {warn('euPoliticalAds') ? (
            <Typography variant="body2">{warn('euPoliticalAds')}</Typography>
          ) : null}
        </DvSectionCard>

        <DvSectionCard title="Targeting" layout="stacked">
          {config.targetingNote ? (
            <Typography variant="body2" color="text.secondary">
              {config.targetingNote}
            </Typography>
          ) : null}
          <TargetingCard
            lineItemType={type}
            value={value.targetingState}
            onChange={(targetingState) => set({ targetingState })}
            readOnly={ro}
          />
        </DvSectionCard>

        <DvSectionCard title="Integration details" layout="settings">
          <DvTextField
            label="Integration code"
            value={value.integrationCode ?? ''}
            readOnly={ro}
            error={err('integrationCode')}
            onChange={(integrationCode) => set({ integrationCode })}
          />
        </DvSectionCard>

        {unmatched.length > 0 ? (
          <Box role="alert">
            {unmatched.map((i, k) => (
              <Typography key={k} color="error" variant="body2">
                {i.message}
              </Typography>
            ))}
          </Box>
        ) : null}
      </Box>
      <DvPickerDialog
        open={picker === 'conversions'}
        title="Add Floodlight activities or Google Analytics conversions"
        items={conversions.map((c) => ({
          id: c.id,
          label: c.name,
          secondLine: `ID ${c.publicId} · ${c.source} · ${c.type === 'SALE' ? 'Sale' : 'Counter'} · ${c.countingMethod}`,
        }))}
        value={value.conversions.activities}
        onApply={(ids) => {
          const next = { ...value, conversions: { ...value.conversions, activities: ids } };
          setValue(next);
          setPicker(null);
          revalidate(next);
        }}
        onCancel={() => setPicker(null)}
      />
      <DvPickerDialog
        open={picker === 'copy'}
        title="Copy settings from an existing line item"
        single
        applyLabel="Copy settings"
        items={copyCandidates.map((c) => ({
          id: c.id,
          label: c.name,
          secondLine: `ID ${c.publicId} · ${c.ioName}`,
        }))}
        value={[]}
        onApply={applyCopy}
        onCancel={() => setPicker(null)}
      />
      {!ro ? (
        <DvFormFooter
          mode={mode}
          dirty={dirty || mode === 'create'}
          primaryLabel={busy ? 'Saving…' : undefined}
          onPrimary={submit}
          onSecondary={() => router.back()}
          onReset={() => {
            setValue(saved);
            setIssues([]);
          }}
          {...(mode === 'edit' ? { note, onNoteChange: setNote } : {})}
        />
      ) : null}
    </Box>
  );
}
