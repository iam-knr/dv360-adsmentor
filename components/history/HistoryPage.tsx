'use client';

// HistoryPage (module 05 2.1): one component for the advertiser, campaign, insertion order and line item History
// routes. Spend chart, toolbar (date range, local time zone, system changes, download, expand all), year headings and
// day cards, notes slide-over, Load more. State lives in the URL (`d`, `tz`, `s`, `sim_panel`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import {
  DvChartCard,
  DvDateRange,
  DvEmptyState,
  DvPageHeader,
  DvSkeleton,
  DvSparkBars,
  DvTabs,
  DvTooltip,
  type DateRangeValue,
} from '@/components/dv';
import { formatIsoDate, parseIsoDate } from '@/components/dv/date-presets';
import { useViewer } from '@/components/shell/ViewerProvider';
import { DvIcon } from '@/components/icons';
import type { HistoryDay, HistoryEntityType, HistoryPageData } from '@/lib/history/types';
import { monthDay } from '@/lib/history/zone';
import { DayCard } from './DayCard';
import { NotesPanel } from './NotesPanel';

export interface HistoryPageProps {
  entity: { type: HistoryEntityType; id: string };
  initial: HistoryPageData;
  /** Initial toolbar state read from the URL on the server. */
  initialParams: { d: string | null; local: boolean; system: boolean };
  /** Advertiser level shows its own "History" title; the others sit under the entity header. */
  title?: boolean;
}

const compact = (iso: string) => iso.replaceAll('-', '');
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function toValue(data: HistoryPageData, hasD: boolean): DateRangeValue {
  const start = parseIsoDate(data.range.from) ?? new Date();
  const end = parseIsoDate(data.range.to) ?? new Date();
  return hasD ? { start, end, preset: 'custom' } : { start, end, preset: 'daysToToday', days: 90 };
}

export function HistoryPage({ entity, initial, initialParams, title }: HistoryPageProps) {
  const { viewer } = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [data, setData] = useState(initial);
  const [days, setDays] = useState<HistoryDay[]>(initial.days);
  const [cursor, setCursor] = useState(initial.nextCursor ?? null);
  const [range, setRange] = useState<DateRangeValue>(() => toValue(initial, !!initialParams.d));
  const [local, setLocal] = useState(initialParams.local);
  const [system, setSystem] = useState(initialParams.system);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const panel = search?.get('sim_panel') ?? null;
  const noteDate =
    panel && /^notes:\d{8}$/.test(panel)
      ? `${panel.slice(6, 10)}-${panel.slice(10, 12)}-${panel.slice(12, 14)}`
      : null;

  const query = useCallback(
    (o: { d: string; local: boolean; system: boolean; cursor?: string | null }) => {
      const qs = new URLSearchParams({
        entityType: entity.type,
        entityId: entity.id,
        d: o.d,
        s: o.system ? '1' : '0',
        tz: o.local ? 'local' : 'advertiser',
      });
      if (o.local) qs.set('zone', browserZone());
      if (o.cursor) qs.set('cursor', o.cursor);
      return qs;
    },
    [entity.id, entity.type],
  );

  const dParam = (r: DateRangeValue) => `${compact(formatIsoDate(r.start))}:${compact(formatIsoDate(r.end))}`;

  const syncUrl = (r: DateRangeValue, l: boolean, s: boolean, custom: boolean) => {
    const qs = new URLSearchParams(search?.toString() ?? '');
    if (custom) qs.set('d', dParam(r));
    else qs.delete('d');
    if (l) qs.set('tz', 'local');
    else qs.delete('tz');
    if (s) qs.set('s', '1');
    else qs.delete('s');
    const text = qs.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  const load = useCallback(
    async (r: DateRangeValue, l: boolean, s: boolean) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dv/history?${query({ d: dParam(r), local: l, system: s })}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as HistoryPageData;
        if (mine !== seq.current) return;
        setData(next);
        setDays(next.days);
        setCursor(next.nextCursor ?? null);
      } catch {
        if (mine === seq.current) setError('The history could not be loaded.');
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [query],
  );

  const change = (r: DateRangeValue, l: boolean, s: boolean) => {
    setRange(r);
    setLocal(l);
    setSystem(s);
    syncUrl(r, l, s, true);
    void load(r, l, s);
  };

  // Reload once when the viewer's time zone matters and the server rendered the advertiser zone.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (initialParams.local) void load(range, true, system);
  }, [initialParams.local, load, range, system]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dv/history?${query({ d: dParam(range), local, system, cursor })}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as HistoryPageData;
      setDays((cur) => [...cur, ...next.days]);
      setCursor(next.nextCursor ?? null);
    } catch {
      setError('The history could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const allIds = useMemo(() => days.flatMap((d) => d.changes.map((c) => c.groupId)), [days]);
  const allOpen = allIds.length > 0 && allIds.every((id) => expanded.has(id));
  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const downloadHref = `/api/dv/history/download?${query({ d: dParam(range), local, system })}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.location.href = downloadHref;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [downloadHref]);

  const openNotes = (date: string) => {
    const qs = new URLSearchParams(search?.toString() ?? '');
    qs.set('sim_panel', `notes:${compact(date)}`);
    router.push(`${pathname}?${qs.toString()}`, { scroll: false });
  };
  const closeNotes = () => {
    const qs = new URLSearchParams(search?.toString() ?? '');
    qs.delete('sim_panel');
    const text = qs.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };
  const setCount = useCallback((date: string, count: number) => {
    setDays((cur) => cur.map((d) => (d.date === date ? { ...d, notesCount: count } : d)));
  }, []);

  const money = useMemo(() => ({ format: (n: number) => formatMoney(n, data.currency) }), [data.currency]);
  const total = data.spend.reduce((sum, p) => sum + p.amount, 0);
  const years = [...new Set(days.map((d) => d.date.slice(0, 4)))];
  const today = parseIsoDate(data.today) ?? new Date();

  return (
    <Box>
      {title ? <DvPageHeader title="History" limitedAccess={viewer.limitedAccess} /> : null}
      <DvTabs tabs={[{ id: 'spend', label: 'Spend' }]} value="spend" onChange={() => undefined} ariaLabel="History charts" />
      <Box sx={{ my: 3 }}>
        <DvChartCard
          title="Spend"
          period={data.spendGrain === 'Weekly' ? '(weekly)' : undefined}
          empty={
            data.spend.length === 0 ? (
              <DvEmptyState variant="inline" message="No performance chart data available" />
            ) : undefined
          }
          footer={data.spend.length ? `Total ${money.format(total)}` : undefined}
        >
          <DvSparkBars
            label={`Spend per ${data.spendGrain === 'Weekly' ? 'week' : 'day'}`}
            data={data.spend.map((p) => ({ label: monthDay(p.date), value: Math.round(p.amount * 100) / 100 }))}
          />
        </DvChartCard>
      </Box>

      <Box
        role="toolbar"
        aria-label="History toolbar"
        sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', mb: 4 }}
      >
        <DvDateRange value={range} onChange={(r) => change(r, local, system)} presets="history" today={today} />
        <FormControlLabel
          control={
            <Switch
              checked={local}
              onChange={(_e, v) => change(range, v, system)}
              slotProps={{ input: { 'aria-label': 'Include local timezone' } }}
            />
          }
          label="Include local timezone"
        />
        <FormControlLabel
          control={
            <Switch
              checked={system}
              onChange={(_e, v) => change(range, local, v)}
              slotProps={{ input: { 'aria-label': 'Include system changes' } }}
            />
          }
          label="Include system changes"
        />
        <Box sx={{ flex: 1 }} />
        <Button
          component="a"
          href={downloadHref}
          download
          variant="text"
          startIcon={<DvIcon name="download" size={18} />}
        >
          Download
        </Button>
        <DvTooltip title={allOpen ? 'Collapse all' : 'Expand all'}>
          <IconButton
            aria-label={allOpen ? 'Collapse all' : 'Expand all'}
            onClick={() => setExpanded(allOpen ? new Set() : new Set(allIds))}
          >
            <DvIcon name={allOpen ? 'unfold_less' : 'unfold_more'} size={24} />
          </IconButton>
        </DvTooltip>
      </Box>

      {error ? (
        <DvEmptyState
          variant="icon"
          message={error}
          action={{ label: 'Retry', onClick: () => void load(range, local, system) }}
        />
      ) : loading && days.length === 0 ? (
        <Box aria-busy="true"><DvSkeleton /><DvSkeleton /></Box>
      ) : days.length === 0 ? (
        <DvEmptyState variant="icon" icon="list_alt" message="There is no history for this date range." />
      ) : (
        <Box aria-busy={loading || undefined} data-testid="history-list">
          {years.map((year) => (
            <Box key={year} component="section" aria-label={year}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                {year}
              </Typography>
              {days
                .filter((d) => d.date.startsWith(year))
                .map((d) => (
                  <DayCard
                    key={d.date}
                    day={d}
                    expanded={expanded}
                    onToggle={toggle}
                    {...(data.canAddNotes ? { onAddNote: openNotes } : { onOpenNotes: openNotes })}
                  />
                ))}
            </Box>
          ))}
          {cursor ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Button variant="outlined" disabled={loading} onClick={() => void loadMore()}>
                Load more
              </Button>
            </Box>
          ) : null}
        </Box>
      )}

      <NotesPanel
        entity={entity}
        date={noteDate}
        canAdd={data.canAddNotes}
        onClose={closeNotes}
        onCount={setCount}
      />
    </Box>
  );
}
