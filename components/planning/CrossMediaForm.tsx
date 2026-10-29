'use client';

// Create a report (module 04 S8, frame F): the cards appear one by one: location, sub-location, insertion orders,
// TV campaigns, then Create report. The two picker dialogs follow the three-column layout of explore 13.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvModal,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvTextField,
  useToast,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { createCrossMediaReportAction, crossMediaOptionsAction } from '@/lib/planning/actions';
import type { CrossMediaOptions } from '@/lib/planning/cross-media-service';
import { CROSS_MEDIA_COUNTRIES } from '@/lib/planning/countries';
import { crossMediaPath, type PlanScope } from '@/lib/planning/paths';
import { PLN_MSG, crossMediaIssues } from '@/lib/planning/rules';

type Key = NonNullable<(typeof CROSS_MEDIA_COUNTRIES)[number]['crossMedia']>;

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export function CrossMediaForm({ scope }: { scope: PlanScope }) {
  const router = useRouter();
  const toast = useToast();
  const [country, setCountry] = useState<Key | ''>('');
  const [opts, setOpts] = useState<CrossMediaOptions | null>(null);
  const [reportScope, setReportScope] = useState<'NATIONAL' | 'SUB_LOCATION'>('NATIONAL');
  const [subs, setSubs] = useState<string[]>([]);
  const [ioIds, setIoIds] = useState<string[]>([]);
  const [tvIds, setTvIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [dialog, setDialog] = useState<null | 'io' | 'tv'>(null);
  const [error, setError] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();

  const dirty = country !== '' || ioIds.length > 0 || tvIds.length > 0 || name !== '';
  useUnsavedGuard(dirty);

  useEffect(() => {
    if (!country) return setOpts(null);
    let live = true;
    void crossMediaOptionsAction(scope, country).then((o) => {
      if (!live) return;
      setOpts(o);
      setIoIds([]);
      setTvIds([]);
      setSubs([]);
    });
    return () => {
      live = false;
    };
  }, [country, scope.partnerId, scope.advertiserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const issues = crossMediaIssues({
    country: country || null,
    scope: reportScope,
    subLocationCount: subs.length,
    ioCount: ioIds.length,
    tvCount: tvIds.length,
  });
  const showCards = !!opts && (reportScope === 'NATIONAL' || subs.length > 0);
  const canCreate = !!country && issues.length === 0;

  const ioNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of opts?.tree ?? [])
      for (const c of a.campaigns) for (const io of c.ios) m.set(io.id, io.name);
    return m;
  }, [opts]);
  const tvNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of opts?.tvCompanies ?? []) for (const t of c.campaigns) m.set(t.id, t.name);
    return m;
  }, [opts]);

  const create = () =>
    start(async () => {
      setError(undefined);
      const res = await createCrossMediaReportAction({
        scope,
        country: country || null,
        reportScope,
        subLocationIds: subs,
        ioIds,
        tvCampaignIds: tvIds,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      if (!res.ok) {
        setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
        setError(res.issues[0]?.message);
        return;
      }
      // The report exists now: leave without the dirty guard asking.
      setCountry('');
      setIoIds([]);
      setTvIds([]);
      setName('');
      router.push(crossMediaPath(scope, res.data.publicId));
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="cross-media-form">
      {error ? (
        <DvBanner kind="error" level="inline">
          {error}
        </DvBanner>
      ) : null}
      <DvSectionCard title="Choose a location for your report" layout="stacked">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Reach is reported as % of the population of the country selected
        </Typography>
        <DvSelect
          label="Country"
          required
          value={country}
          placeholder="Select a country"
          options={CROSS_MEDIA_COUNTRIES.map((c) => ({
            value: c.crossMedia as string,
            label: c.name,
          }))}
          onChange={(v) => setCountry(v as Key)}
        />
        {opts ? (
          <>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}
              data-testid="currency-line"
            >
              <DvIcon name="check_circle" size={18} color="success.main" />
              <Typography>
                {opts.currency.name} ({opts.currency.code} {opts.currency.symbol})
              </Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              <DvBanner kind="info" level="inline">
                The default reporting currency is based on your selected location
              </DvBanner>
            </Box>
          </>
        ) : null}
      </DvSectionCard>

      {opts ? (
        <DvSectionCard title="Digital and linear TV report settings" layout="stacked">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Choose a sub-location for your report
          </Typography>
          <DvRadioGroup
            label="Sub-location"
            value={reportScope}
            onChange={(v) => setReportScope(v as 'NATIONAL' | 'SUB_LOCATION')}
            options={[
              { value: 'NATIONAL', label: 'National' },
              { value: 'SUB_LOCATION', label: 'Sub-location' },
            ]}
          />
          {reportScope === 'SUB_LOCATION' ? (
            <Box sx={{ mt: 2 }} role="group" aria-label="Sub-locations">
              <Typography variant="body2" color="text.secondary">
                Reach and impressions data is available from January 2024 if you select
                sub-location(s)
              </Typography>
              {opts.subLocations.map((s) => (
                <FormControlLabel
                  key={s.code}
                  sx={{ display: 'flex' }}
                  control={
                    <Checkbox
                      checked={subs.includes(s.code)}
                      onChange={() =>
                        setSubs((v) =>
                          v.includes(s.code) ? v.filter((x) => x !== s.code) : [...v, s.code],
                        )
                      }
                    />
                  }
                  label={s.name}
                />
              ))}
              {errors.subLocations ? (
                <Typography role="alert" variant="caption" color="error">
                  {errors.subLocations}
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </DvSectionCard>
      ) : null}

      {showCards ? (
        <>
          <DvSectionCard title="Add insertion orders" layout="stacked">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button variant="outlined" onClick={() => setDialog('io')}>
                Add insertion orders
              </Button>
              <Typography data-testid="io-count">
                {ioIds.length
                  ? `${ioIds.length} insertion order${ioIds.length === 1 ? '' : 's'} selected`
                  : 'None selected'}
              </Typography>
            </Box>
            {ioIds.length ? (
              <Typography variant="caption" color="text.secondary">
                {ioIds
                  .map((id) => ioNames.get(id))
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            ) : null}
          </DvSectionCard>
          <DvSectionCard title="Add TV campaigns" layout="stacked">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button variant="outlined" onClick={() => setDialog('tv')}>
                Add TV campaigns
              </Button>
              <Typography data-testid="tv-count">
                {tvIds.length
                  ? `${tvIds.length} TV campaign${tvIds.length === 1 ? '' : 's'} selected`
                  : 'None selected'}
              </Typography>
            </Box>
            {tvIds.length ? (
              <Typography variant="caption" color="text.secondary">
                {tvIds
                  .map((id) => tvNames.get(id))
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            ) : null}
          </DvSectionCard>
          {errors.ioIds ? (
            <Typography role="alert" color="error" variant="caption">
              {errors.ioIds}
            </Typography>
          ) : null}
          <Box sx={{ maxWidth: 420 }}>
            <DvTextField
              label="Report name (optional)"
              value={name}
              maxLength={100}
              onChange={setName}
            />
          </Box>
        </>
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" disabled={!canCreate || busy} onClick={create}>
          Create report
        </Button>
        <Button
          onClick={() => toast.show({ message: 'Thanks. Feedback is stored for your instructor.' })}
        >
          Give feedback
        </Button>
        {issues.length && country ? (
          <Typography variant="caption" color="text.secondary">
            {issues[0]?.message ?? PLN_MSG.PICK_ONE}
          </Typography>
        ) : null}
      </Box>

      {dialog === 'io' && opts ? (
        <IoPicker
          opts={opts}
          value={ioIds}
          onDone={(v) => {
            setIoIds(v);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'tv' && opts ? (
        <TvPicker
          opts={opts}
          country={CROSS_MEDIA_COUNTRIES.find((c) => c.crossMedia === country)?.name ?? ''}
          reportScope={reportScope}
          value={tvIds}
          onDone={(v) => {
            setTvIds(v);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </Box>
  );
}

// ---- Pickers ---------------------------------------------------------------------------------------

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      role="group"
      aria-label={title}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        minHeight: 280,
        maxHeight: 360,
        overflowY: 'auto',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function IoPicker({
  opts,
  value,
  onDone,
  onCancel,
}: {
  opts: CrossMediaOptions;
  value: string[];
  onDone: (v: string[]) => void;
  onCancel: () => void;
}) {
  const [sel, setSel] = useState<string[]>(value);
  const [q, setQ] = useState('');
  const [advId, setAdvId] = useState(opts.tree[0]?.advertiserId ?? '');
  const adv = opts.tree.find((a) => a.advertiserId === advId);
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const campaigns = (adv?.campaigns ?? []).filter(
    (c) =>
      match(c.name) || match(c.publicId) || c.ios.some((i) => match(i.name) || match(i.publicId)),
  );
  const toggle = (ids: string[]) =>
    setSel((s) =>
      ids.every((i) => s.includes(i))
        ? s.filter((i) => !ids.includes(i))
        : [...new Set([...s, ...ids])],
    );
  const shownIos = campaigns.flatMap((c) => c.ios.map((i) => ({ ...i, campaign: c })));

  return (
    <DvModal
      open
      title="Select insertion orders"
      size="lg"
      onClose={onCancel}
      primary={{ label: 'Done', disabled: sel.length === 0, onClick: () => onDone(sel) }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Typography variant="body2" sx={{ mb: 1 }}>
        Choose insertion orders to include in your report. Data is available for the last 24 months.
      </Typography>
      <DvTextField label="Search by name or ID" value={q} onChange={setQ} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.4fr 1fr', gap: 2, mt: 2 }}>
        <Column title={`Advertiser (${opts.tree.length})`}>
          {opts.tree.map((a) => (
            <ButtonBase
              key={a.advertiserId}
              onClick={() => setAdvId(a.advertiserId)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                p: 1.5,
                bgcolor: a.advertiserId === advId ? 'action.selected' : undefined,
              }}
            >
              {a.name}
            </ButtonBase>
          ))}
        </Column>
        <Column title={`Campaigns (${campaigns.length})`}>
          {campaigns.map((c) => {
            const ids = c.ios.map((i) => i.id);
            return (
              <FormControlLabel
                key={c.id}
                sx={{ display: 'flex', px: 1 }}
                control={
                  <Checkbox
                    size="small"
                    disabled={c.disabled}
                    checked={ids.length > 0 && ids.every((i) => sel.includes(i))}
                    onChange={() => toggle(ids)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">{c.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.publicId} - {money(c.spend)}
                    </Typography>
                  </Box>
                }
              />
            );
          })}
        </Column>
        <Column title={`Insertion orders (${shownIos.length})`}>
          {shownIos.map((i) => (
            <FormControlLabel
              key={i.id}
              sx={{ display: 'flex', px: 1 }}
              control={
                <Checkbox
                  size="small"
                  disabled={i.campaign.disabled}
                  checked={sel.includes(i.id)}
                  onChange={() => toggle([i.id])}
                />
              }
              label={i.name}
            />
          ))}
        </Column>
        <Box data-testid="io-selected" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2">
            {sel.length
              ? `${sel.length} insertion order${sel.length === 1 ? '' : 's'} selected`
              : 'Select one or more insertion orders'}
          </Typography>
        </Box>
      </Box>
    </DvModal>
  );
}

function TvPicker({
  opts,
  country,
  reportScope,
  value,
  onDone,
  onCancel,
}: {
  opts: CrossMediaOptions;
  country: string;
  reportScope: 'NATIONAL' | 'SUB_LOCATION';
  value: string[];
  onDone: (v: string[]) => void;
  onCancel: () => void;
}) {
  const [sel, setSel] = useState<string[]>(value);
  const [by, setBy] = useState<'COMPANY' | 'CAMPAIGN'>('COMPANY');
  const [q, setQ] = useState('');
  const [company, setCompany] = useState(opts.tvCompanies[0]?.company ?? '');
  const w = opts.tvDataWindow;
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const companies = opts.tvCompanies.filter((c) =>
    by === 'COMPANY' ? match(c.company) : c.campaigns.some((t) => match(t.name)),
  );
  const active = companies.find((c) => c.company === company) ?? companies[0];
  const shown = (active?.campaigns ?? []).filter((t) => by === 'COMPANY' || match(t.name));
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const names = new Map(
    opts.tvCompanies.flatMap((c) => c.campaigns.map((t) => [t.id, t.name] as const)),
  );

  return (
    <DvModal
      open
      title="Select TV campaigns"
      size="lg"
      onClose={onCancel}
      primary={{ label: 'Done', onClick: () => onDone(sel) }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Typography variant="body2">
        Data for {country} - {reportScope === 'NATIONAL' ? 'National' : 'Sub-location'} is available
        from {fmtDay(reportScope === 'NATIONAL' ? w.from : w.subLocationFrom)} to {fmtDay(w.to)}.
        New data is expected by {fmtDay(w.nextUpdate)}.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        TV data powered by {opts.tvVendor}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, my: 2 }}>
        <Box sx={{ width: 200 }}>
          <DvSelect
            label="Search by"
            value={by}
            options={[
              { value: 'COMPANY', label: 'Company/Brand' },
              { value: 'CAMPAIGN', label: 'Campaign' },
            ]}
            onChange={(v) => setBy(v as 'COMPANY' | 'CAMPAIGN')}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <DvTextField label="Search" value={q} onChange={setQ} />
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 2 }}>
        <Column title="Company/Brand">
          {companies.map((c) => (
            <ButtonBase
              key={c.company}
              onClick={() => setCompany(c.company)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                p: 1.5,
                bgcolor: c.company === active?.company ? 'action.selected' : undefined,
              }}
            >
              {c.company}
            </ButtonBase>
          ))}
        </Column>
        <Column title="Campaigns">
          {shown.map((t) => (
            <FormControlLabel
              key={t.id}
              sx={{ display: 'flex', px: 1 }}
              control={
                <Checkbox size="small" checked={sel.includes(t.id)} onChange={() => toggle(t.id)} />
              }
              label={t.name}
            />
          ))}
        </Column>
        <Box data-testid="tv-selected" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2">
            {sel.length ? `${sel.length} selected` : 'None selected'}
          </Typography>
          {sel.map((id) => (
            <Typography key={id} variant="caption" component="div">
              {names.get(id)}
            </Typography>
          ))}
        </Box>
      </Box>
    </DvModal>
  );
}
