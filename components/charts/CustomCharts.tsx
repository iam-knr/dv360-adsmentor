'use client';

// Custom charts (module 11 2.5): saved cards in the strip, Customize mode (prompt, Add menu, Note, undo / redo /
// reset, Save), Share and the four-step tour. Card data comes from POST /api/dv/charts/data.
import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { DvChartCard, DvModal, DvTextField } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { colors } from '@/lib/theme/tokens';
import {
  AI_DISCLAIMER,
  BUILT_IN_LABEL,
  BUILT_INS,
  STARTERS,
  newCardId,
  type BuiltInChart,
  type ChartCardSpec,
  type ChartScope,
} from '@/lib/charts/spec';

type Scope = Exclude<ChartScope, 'ADVERTISER'>;
interface Series {
  key: string;
  label: string;
  points: { x: string | number; y: number; size?: number; label?: string }[];
}
interface Data {
  series: Series[];
  unit: string;
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function CardBody({
  spec,
  scope,
  scopeId,
}: {
  spec: ChartCardSpec;
  scope: Scope;
  scopeId: string;
}) {
  const mounted = useMounted();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const key = JSON.stringify([spec.kind, spec.metrics, spec.dimension, spec.topN]);

  useEffect(() => {
    if (spec.kind === 'NOTE' || spec.kind === 'BUILT_IN') return;
    let live = true;
    setState('loading');
    void fetch('/api/dv/charts/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, scopeId, spec }),
    })
      .then((r) => r.json() as Promise<{ data?: Data }>)
      .then((j) => {
        if (!live) return;
        if (j.data) {
          setData(j.data);
          setState('ready');
        } else setState('error');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scope, scopeId]);

  if (spec.kind === 'NOTE')
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {spec.note}
      </Typography>
    );
  if (spec.kind === 'BUILT_IN')
    return (
      <Typography variant="body2" color="text.secondary">
        {BUILT_IN_LABEL[spec.builtIn ?? 'TOTAL_COST']} appears here once the selection has delivery.
      </Typography>
    );
  if (state === 'loading' || !mounted)
    return (
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    );
  const first = data?.series[0];
  if (state === 'error' || !data || !first || first.points.length === 0)
    return (
      <Typography variant="body2" color="text.secondary">
        No data for this period.
      </Typography>
    );
  const palette = colors.chart;
  const rows = first.points.map((p, i) => ({
    x: p.x,
    ...Object.fromEntries(data.series.map((s) => [s.key, s.points[i]?.y ?? 0])),
  }));
  const W = 250;
  const H = 130;
  if (spec.kind === 'PIE')
    return (
      <PieChart width={W} height={H}>
        <Pie data={first.points} dataKey="y" nameKey="x" outerRadius={50} isAnimationActive={false}>
          {first.points.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <ChartTooltip />
      </PieChart>
    );
  if (spec.kind === 'BUBBLE')
    return (
      <ScatterChart width={W} height={H}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name={spec.metrics?.x ?? 'x'} />
        <YAxis type="number" dataKey="y" name={spec.metrics?.y ?? 'y'} width={36} />
        <ZAxis type="number" dataKey="size" range={[40, 400]} />
        <ChartTooltip />
        <Scatter data={first.points} fill={palette[0]} isAnimationActive={false} />
      </ScatterChart>
    );
  if (spec.kind === 'LINE')
    return (
      <LineChart width={W} height={H} data={rows}>
        <XAxis dataKey="x" hide />
        <YAxis width={36} />
        <ChartTooltip />
        {data.series.map((s, i) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stroke={palette[i % palette.length]}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    );
  return (
    <BarChart width={W} height={H} data={rows}>
      <XAxis dataKey="x" hide />
      <YAxis width={36} />
      <ChartTooltip />
      {data.series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          fill={palette[i % palette.length]}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  );
}

export interface CustomChartsApi {
  cards: React.ReactNode[];
  editing: boolean;
  suggestions: string[];
  onCustomize: () => void;
  onSuggestion: (text: string) => void;
  onTour: () => void;
  onShare: () => void;
  panel: React.ReactNode;
}

const SUGGESTIONS = [
  'Bubble chart of CPA vs conversions',
  'Conversions for top 5 LIs by revenue',
  'Compare CPMs and CTRs',
];
const TOUR = [
  ['Chart strip', 'Charts sit above the table. Customize charts lets you change them.'],
  [
    'Ask a question',
    'Describe the metrics you want, for example "CTR and revenue by day", and choose Create.',
  ],
  ['Add charts', 'Add starter charts, built-in charts or a note from the Add menu.'],
  ['Save', 'Save charts keeps your charts for this page. Share gives others a read-only link.'],
] as const;

export function useCustomCharts(scope: Scope, scopeId: string): CustomChartsApi {
  const { viewer } = useViewer();
  const [saved, setSaved] = useState<ChartCardSpec[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChartCardSpec[] | null>(null);
  const history = useRef<{ past: ChartCardSpec[][]; future: ChartCardSpec[][] }>({
    past: [],
    future: [],
  });
  const [, bump] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [tour, setTour] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams(window.location.search).get('cv');
    const sharedOwner = q?.startsWith('chart:') ? q.slice(6) : null;
    const url = `/api/dv/chart-views?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}${sharedOwner ? `&viewKey=shared&owner=${encodeURIComponent(sharedOwner)}` : ''}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => null)) as {
      data?: { cards: ChartCardSpec[]; readOnly: boolean; ownerId: string | null };
    } | null;
    if (json?.data) {
      setSaved(json.data.cards);
      setReadOnly(json.data.readOnly);
      setOwner(json.data.ownerId);
    }
  }, [scope, scopeId]);
  useEffect(() => {
    void load();
  }, [load]);

  const editing = draft !== null;
  const set = (next: ChartCardSpec[]) => {
    history.current.past.push(draft ?? []);
    history.current.future = [];
    setDraft(next.map((c, i) => ({ ...c, ordinal: i })));
  };
  const add = (spec: Omit<ChartCardSpec, 'id' | 'ordinal'>) =>
    set([...(draft ?? []), { ...spec, id: newCardId(), ordinal: 0 }]);
  const move = (i: number, d: -1 | 1) => {
    const list = [...(draft ?? [])];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    set(list);
  };
  const undo = () => {
    const prev = history.current.past.pop();
    if (prev) {
      history.current.future.push(draft ?? []);
      setDraft(prev);
      bump((n) => n + 1);
    }
  };
  const redo = () => {
    const nxt = history.current.future.pop();
    if (nxt) {
      history.current.past.push(draft ?? []);
      setDraft(nxt);
      bump((n) => n + 1);
    }
  };

  const create = async (text: string) => {
    const res = await fetch('/api/dv/charts/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: Omit<ChartCardSpec, 'id' | 'ordinal'>;
      message?: string;
    } | null;
    if (json?.data) {
      add(json.data);
      setMessage(null);
      setPrompt('');
    } else setMessage(json?.message ?? 'I could not build a chart from that.');
  };

  const persist = async (cards: ChartCardSpec[], share = false) => {
    const res = await fetch('/api/dv/chart-views', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        scopeId,
        cards,
        ...(share ? { share: true, viewKey: 'shared' } : {}),
      }),
    });
    return res.ok;
  };
  const save = async () => {
    if (await persist(draft ?? [])) {
      setSaved(draft ?? []);
      setDraft(null);
      setMessage(null);
      await load();
    } else setMessage('Could not save the charts.');
  };
  const share = async () => {
    const cards = draft ?? saved;
    if (!(await persist(cards, true))) return setNote('Could not create the link.');
    const url = new URL(window.location.href);
    url.searchParams.set('cv', `chart:${owner ?? ''}`);
    const me = await fetch(
      `/api/dv/chart-views?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}`,
    )
      .then((r) => r.json() as Promise<{ data?: { ownerId: string | null } }>)
      .catch(() => null);
    if (me?.data?.ownerId) url.searchParams.set('cv', `chart:${me.data.ownerId}`);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      /* the link is shown below */
    }
    setNote(`Link: ${url.toString()}`);
  };

  const list = draft ?? saved;
  const canEdit = !viewer.readOnly && !readOnly;
  const cards = list.map((c, i) => (
    <DvChartCard
      key={c.id}
      title={c.title}
      locked={c.kind === 'BUILT_IN'}
      menu={
        editing
          ? [
              { label: 'Remove', onClick: () => set(list.filter((x) => x.id !== c.id)) },
              { label: 'Move earlier', onClick: () => move(i, -1) },
              { label: 'Move later', onClick: () => move(i, 1) },
            ]
          : undefined
      }
    >
      <CardBody spec={c} scope={scope} scopeId={scopeId} />
    </DvChartCard>
  ));

  const panel = (
    <>
      {readOnly && !editing ? (
        <Box role="status" sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2">This is a shared view. It is read only.</Typography>
          <Button
            size="small"
            onClick={() => {
              setReadOnly(false);
              setDraft(saved.map((c) => ({ ...c, id: newCardId() })));
            }}
          >
            Save a copy
          </Button>
        </Box>
      ) : null}
      {editing ? (
        <Box role="region" aria-label="Customize charts" sx={{ mb: 3, display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={() => void save()}>
              Save charts
            </Button>
            <Box sx={{ flex: 1, minWidth: 260 }}>
              <DvTextField
                label="Ask a performance question or describe metrics"
                value={prompt}
                onChange={setPrompt}
              />
            </Box>
            <Button variant="outlined" onClick={() => void create(prompt)}>
              Create
            </Button>
            <Button
              variant="outlined"
              aria-haspopup="menu"
              onClick={(e) => setAddAnchor(e.currentTarget)}
            >
              Add
            </Button>
            <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
              <Typography variant="overline" sx={{ px: 2 }}>
                Starter charts
              </Typography>
              {STARTERS.map((s) => (
                <MenuItem
                  key={s.key}
                  onClick={() => {
                    setAddAnchor(null);
                    add(s.make());
                  }}
                >
                  {s.label}
                </MenuItem>
              ))}
              <Typography variant="overline" sx={{ px: 2 }}>
                Built-in charts
              </Typography>
              {BUILT_INS.map((b: BuiltInChart) => (
                <MenuItem
                  key={b}
                  onClick={() => {
                    setAddAnchor(null);
                    add({ kind: 'BUILT_IN', builtIn: b, title: BUILT_IN_LABEL[b] });
                  }}
                >
                  {BUILT_IN_LABEL[b]}
                </MenuItem>
              ))}
            </Menu>
            <Button
              variant="outlined"
              onClick={() => add({ kind: 'NOTE', title: 'Note', note: '' })}
            >
              Note
            </Button>
            <IconButton aria-label="Reset charts" onClick={() => set([])}>
              ⟲
            </IconButton>
            <IconButton
              aria-label="Undo"
              onClick={undo}
              disabled={history.current.past.length === 0}
            >
              ↶
            </IconButton>
            <IconButton
              aria-label="Redo"
              onClick={redo}
              disabled={history.current.future.length === 0}
            >
              ↷
            </IconButton>
            <IconButton
              aria-label="Exit customize mode"
              onClick={() => {
                setDraft(null);
                setMessage(null);
              }}
            >
              ✕
            </IconButton>
          </Box>
          <Typography variant="caption">{AI_DISCLAIMER}</Typography>
          {message ? (
            <Typography role="alert" color="error" variant="body2">
              {message}
            </Typography>
          ) : null}
          {list
            .filter((c) => c.kind === 'NOTE')
            .map((c) => (
              <DvTextField
                key={c.id}
                label="Note"
                value={c.note ?? ''}
                maxLength={500}
                onChange={(v) => setDraft(list.map((x) => (x.id === c.id ? { ...x, note: v } : x)))}
              />
            ))}
        </Box>
      ) : null}
      {note ? (
        <Typography
          role="status"
          variant="caption"
          sx={{ display: 'block', mb: 1, wordBreak: 'break-all' }}
        >
          {note}
        </Typography>
      ) : null}
      <DvModal
        open={tour !== null}
        title={tour !== null ? `${TOUR[tour]![0]} (${tour + 1} of ${TOUR.length})` : ''}
        primary={{
          label: tour === TOUR.length - 1 ? 'Done' : 'Next',
          onClick: () => setTour(tour === TOUR.length - 1 ? null : (tour ?? 0) + 1),
        }}
        secondary={{ label: 'Skip', onClick: () => setTour(null) }}
        onClose={() => setTour(null)}
      >
        {tour !== null ? TOUR[tour]![1] : null}
      </DvModal>
    </>
  );

  return {
    cards,
    editing,
    suggestions: canEdit ? SUGGESTIONS : [],
    onCustomize: () => {
      if (canEdit) {
        history.current = { past: [], future: [] };
        setDraft(saved);
      }
    },
    onSuggestion: (text) => {
      if (canEdit) {
        history.current = { past: [], future: [] };
        setDraft(saved);
        void create(text);
      }
    },
    onTour: () => setTour(0),
    onShare: () => void share(),
    panel,
  };
}
