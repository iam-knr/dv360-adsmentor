'use client';

// Reports hub (module 16 S1): tabs Instant / Offline, Generate report card, suggested templates, the report list.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Badge from '@mui/material/Badge';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import {
  DvBanner,
  DvEmptyState,
  DvModal,
  DvTabs,
  DvTextField,
  useToast,
} from '@/components/dv';
import {
  deleteReportAction,
  generateReportAction,
  runReportAction,
  saveReportAsAction,
} from '@/lib/reporting/actions';
import type { GenerateResult } from '@/lib/reporting/generate';
import type { TemplateDef } from '@/lib/reporting/templates';
import type { ReportRow } from '@/lib/reporting/types';
import { formatModified } from '@/lib/reporting/format';
import { partnerPath } from '@/lib/routes/paths';
import { TemplateCards } from './TemplateCards';
import { ShareDialog } from './ShareDialog';

export interface ReportsHubProps {
  partnerId: string;
  tab: 'instant' | 'offline';
  createdBy: 'me' | 'any';
  q: string;
  page: number;
  pageSize: number;
  total: number;
  rows: ReportRow[];
  templates: TemplateDef[];
  canWrite: boolean;
}

const KIND_LABEL: Record<ReportRow['kind'], string> = {
  INSTANT: 'Instant',
  OFFLINE_FLOODLIGHT: 'Floodlight',
  OFFLINE_INVENTORY_AVAILABILITY: 'Inventory Availability',
};

export function ReportsHub(props: ReportsHubProps) {
  const { partnerId, tab, createdBy, q, page, pageSize, total, rows, templates, canWrite } = props;
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [share, setShare] = useState<ReportRow | null>(null);
  const [del, setDel] = useState<ReportRow[]>([]);
  const [dup, setDup] = useState<ReportRow | null>(null);
  const [dupName, setDupName] = useState('');
  const [offlineMenu, setOfflineMenu] = useState<HTMLElement | null>(null);
  const [filterMenu, setFilterMenu] = useState<HTMLElement | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [gen, setGen] = useState<GenerateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(q);
  const [error, setError] = useState<string | undefined>();

  const base = partnerPath(partnerId, 'reporting');
  const href = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const all: Record<string, string | number | undefined> = {
      tab,
      createdBy: createdBy === 'me' ? undefined : createdBy,
      q: q || undefined,
      page: page > 1 ? page : undefined,
      rows: pageSize !== 20 ? pageSize : undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== '') p.set(k, String(v));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const go = (over: Record<string, string | number | undefined>) => {
    setSelected([]);
    router.push(href(over));
  };
  const editable = canWrite;
  const pathOf = (r: ReportRow) => `${base}/${r.kind === 'INSTANT' ? 'instant' : 'offline'}/${r.id}`;

  const chosen = rows.filter((r) => selected.includes(r.id));
  const allOn = rows.length > 0 && chosen.length === rows.length;
  const mine = chosen.length > 0 && chosen.every((r) => r.createdByMe);

  const runNow = async (r: ReportRow) => {
    const res = await runReportAction(partnerId, { reportId: r.id });
    if (!res.ok) setError(res.issues[0]?.message ?? 'The report could not be run.');
    else {
      toast.show({ kind: 'neutral', message: `Ran ${r.name}` });
      startTransition(() => router.refresh());
    }
  };
  const duplicate = async () => {
    if (!dup) return;
    setBusy(true);
    const res = await saveReportAsAction(partnerId, dup.id, dupName);
    setBusy(false);
    if (!res.ok) {
      setError(res.issues[0]?.message ?? 'Could not duplicate the report.');
    } else {
      setDup(null);
      setSelected([]);
      toast.show({ kind: 'neutral', message: `Created ${dupName}` });
      startTransition(() => router.refresh());
    }
  };
  const remove = async () => {
    if (del.length === 0) return;
    setBusy(true);
    for (const r of del) {
      const res = await deleteReportAction(r.id);
      if (!res.ok) setError(res.issues[0]?.message ?? 'Could not delete the report.');
    }
    setBusy(false);
    setDel([]);
    setSelected([]);
    startTransition(() => router.refresh());
  };
  const generate = async () => {
    setBusy(true);
    setGen(await generateReportAction(partnerId, prompt));
    setBusy(false);
  };
  const openGenerated = () => {
    if (!gen) return;
    try {
      sessionStorage.setItem('dv.report.generated', JSON.stringify(gen.definition));
    } catch {
      /* the builder then opens empty */
    }
    router.push(`${base}/instant/new?generated=1`);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const filterRow = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        px: 2,
        py: 0.5,
        minHeight: 40,
      }}
    >
      <IconButton aria-label="Filter" size="small" onClick={(e) => setFilterMenu(e.currentTarget)}>
        <Badge badgeContent={createdBy === 'me' ? 1 : 0} color="primary" data-testid="filter-badge">
          <DvIcon name="filter_list" />
        </Badge>
      </IconButton>
      {createdBy === 'me' ? (
        <Chip
          size="small"
          label="Created by: Me"
          onDelete={() => go({ createdBy: 'any', page: undefined })}
          data-testid="created-by-chip"
        />
      ) : null}
      <InputBase
        sx={{ flex: 1 }}
        inputProps={{ 'aria-label': 'Filter reports' }}
        placeholder="Enter a search term or select filters"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onBlur={() => search !== q && go({ q: search || undefined, page: undefined })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go({ q: search || undefined, page: undefined });
        }}
      />
      <Menu anchorEl={filterMenu} open={!!filterMenu} onClose={() => setFilterMenu(null)}>
        <MenuItem
          selected={createdBy === 'me'}
          onClick={() => {
            setFilterMenu(null);
            go({ createdBy: 'me', page: undefined });
          }}
        >
          Created by: Me
        </MenuItem>
        <MenuItem
          selected={createdBy === 'any'}
          onClick={() => {
            setFilterMenu(null);
            go({ createdBy: 'any', page: undefined });
          }}
        >
          Created by: Anyone with access
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <DvTabs
        ariaLabel="Report type"
        value={tab}
        onChange={(t) => go({ tab: t, page: undefined })}
        tabs={[
          { id: 'instant', label: 'Instant reporting' },
          { id: 'offline', label: 'Offline reporting' },
        ]}
      />
      {error ? (
        <DvBanner kind="error" onDismiss={() => setError(undefined)}>
          {error}
        </DvBanner>
      ) : null}

      {tab === 'instant' ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', px: 3, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DvIcon name="auto_awesome" size={20} />
            <Button
              variant="text"
              aria-expanded={genOpen}
              onClick={() => setGenOpen((o) => !o)}
              endIcon={<DvIcon name={genOpen ? 'expand_less' : 'expand_more'} />}
            >
              Generate report
            </Button>
            <DvIcon name="help" size={16} />
            <Chip size="small" label="BETA" />
          </Box>
          {genOpen ? (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <DvTextField
                label="Describe the report you want"
                placeholder="impressions and clicks by device last 14 days"
                value={prompt}
                onChange={setPrompt}
              />
              <Box>
                <Button variant="contained" disabled={!prompt.trim() || busy || !editable} onClick={() => void generate()}>
                  Generate
                </Button>
              </Box>
              {gen ? (
                <Box data-testid="generated-summary">
                  <Typography variant="body2">{gen.explanation}</Typography>
                  {gen.ignored.length ? (
                    <Typography variant="caption" color="text.secondary">
                      Ignored: {gen.ignored.join(', ')}
                    </Typography>
                  ) : null}
                  <Box sx={{ mt: 2 }}>
                    <Button variant="outlined" onClick={openGenerated}>
                      Open in builder
                    </Button>
                  </Box>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {tab === 'instant' ? (
        <TemplateCards templates={templates} onOpen={(key) => router.push(`${base}/instant/new?template=${key}`)} />
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {tab === 'instant' ? (
          <Button
            variant="contained"
            size="small"
            disabled={!editable}
            onClick={() => router.push(`${base}/instant/new`)}
          >
            New instant report
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              size="small"
              color="success"
              disabled={!editable}
              onClick={(e) => setOfflineMenu(e.currentTarget)}
              endIcon={<DvIcon name="expand_more" />}
            >
              New Offline Report
            </Button>
            <Menu anchorEl={offlineMenu} open={!!offlineMenu} onClose={() => setOfflineMenu(null)}>
              <MenuItem onClick={() => router.push(`${base}/offline/new?type=floodlight`)}>Floodlight</MenuItem>
              <MenuItem onClick={() => router.push(`${base}/offline/new?type=inventory-availability`)}>
                Inventory Availability
              </MenuItem>
            </Menu>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {tab === 'instant' ? (
          <IconButton aria-label="Filter reports list" onClick={(e) => setFilterMenu(e.currentTarget)}>
            <DvIcon name="filter_alt" />
          </IconButton>
        ) : null}
      </Box>

      {filterRow}

      {chosen.length > 0 ? (
        <Box
          role="toolbar"
          aria-label="Selected reports"
          data-testid="selection-bar"
          sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'action.hover', px: 2, py: 1, borderRadius: '4px' }}
        >
          <Typography variant="body2">{chosen.length} selected</Typography>
          <Button size="small" disabled={!editable || chosen.length !== 1} onClick={() => chosen[0] && void runNow(chosen[0])}>
            Run now
          </Button>
          <Button
            size="small"
            disabled={!editable || chosen.length !== 1}
            onClick={() => {
              const r = chosen[0];
              if (!r) return;
              setDupName(`${r.name} (copy)`);
              setDup(r);
            }}
          >
            Duplicate
          </Button>
          <Button size="small" disabled={!editable || chosen.length !== 1 || !mine} onClick={() => setShare(chosen[0] ?? null)}>
            Share
          </Button>
          <Button size="small" color="error" disabled={!editable || !mine} onClick={() => setDel(chosen)}>
            Delete
          </Button>
        </Box>
      ) : null}

      {rows.length === 0 ? (
        <DvEmptyState
          variant="icon"
          icon="bar_chart"
          title="No reports yet"
          message={q ? 'No report matches the filter.' : 'Create a report to see delivery and cost.'}
          {...(editable && tab === 'instant'
            ? { action: { label: 'New instant report', onClick: () => router.push(`${base}/instant/new`), primary: true } }
            : {})}
        />
      ) : (
        <Table size="small" aria-label="Reports">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allOn}
                  indeterminate={chosen.length > 0 && !allOn}
                  inputProps={{ 'aria-label': 'Select all reports' }}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                />
              </TableCell>
              {tab === 'instant' ? <TableCell sx={{ width: 32 }} /> : null}
              <TableCell>Report name</TableCell>
              {tab === 'offline' ? <TableCell>Report type</TableCell> : null}
              <TableCell>Created by</TableCell>
              <TableCell aria-sort="descending" sx={{ whiteSpace: 'nowrap' }}>
                Last modified
                <Box component="span" aria-hidden sx={{ ml: 0.5 }}>
                  ↓
                </Box>
              </TableCell>
              <TableCell>Report ID</TableCell>
              <TableCell>Files</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover data-testid="report-row" selected={selected.includes(r.id)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selected.includes(r.id)}
                    inputProps={{ 'aria-label': `Select ${r.name}` }}
                    onChange={(e) =>
                      setSelected((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id)))
                    }
                  />
                </TableCell>
                {tab === 'instant' ? (
                  <TableCell sx={{ color: 'text.secondary' }}>
                    <DvIcon name="bar_chart" size={18} />
                  </TableCell>
                ) : null}
                <TableCell>
                  <Link component="button" underline="hover" onClick={() => router.push(pathOf(r))}>
                    {r.name}
                  </Link>
                  {r.shared ? <Chip size="small" variant="outlined" sx={{ ml: 1 }} label="Shared" /> : null}
                </TableCell>
                {tab === 'offline' ? <TableCell>{KIND_LABEL[r.kind]}</TableCell> : null}
                <TableCell>{r.createdBy}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatModified(r.modified)}</TableCell>
                <TableCell>{r.publicId}</TableCell>
                <TableCell>
                  <Link component="button" underline="hover" onClick={() => router.push(`${pathOf(r)}/runs`)}>
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {tab === 'offline' || total > pageSize ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
          <Typography variant="body2">Show rows:</Typography>
          <Select
            size="small"
            variant="standard"
            value={pageSize}
            inputProps={{ 'aria-label': 'Show rows' }}
            onChange={(e) => go({ rows: Number(e.target.value) === 20 ? undefined : Number(e.target.value), page: undefined })}
          >
            {[10, 20, 50].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="body2" data-testid="pager-range" sx={{ mx: 2 }}>
            {from} - {to}
          </Typography>
          <IconButton aria-label="Previous page" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            <DvIcon name="chevron_left" />
          </IconButton>
          <IconButton aria-label="Next page" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
            <DvIcon name="chevron_right" />
          </IconButton>
        </Box>
      ) : null}

      {share ? (
        <ShareDialog
          open
          reportId={share.id}
          reportName={share.name}
          onClose={() => setShare(null)}
          onDone={() => startTransition(() => router.refresh())}
        />
      ) : null}
      <DvModal
        open={!!dup}
        title="Duplicate report"
        onClose={() => setDup(null)}
        primary={{ label: 'Duplicate', onClick: () => void duplicate(), loading: busy, disabled: !dupName.trim() }}
        secondary={{ label: 'Cancel', onClick: () => setDup(null) }}
      >
        <DvTextField label="New report name" value={dupName} onChange={setDupName} />
      </DvModal>
      <DvModal
        open={del.length > 0}
        title={del.length > 1 ? `Delete ${del.length} reports?` : 'Delete report?'}
        onClose={() => setDel([])}
        primary={{ label: 'Delete', onClick: () => void remove(), loading: busy, tone: 'danger' }}
        secondary={{ label: 'Cancel', onClick: () => setDel([]) }}
      >
        <Typography variant="body2">
          {del.length > 1 ? `${del.length} reports` : del[0]?.name} and {del.length > 1 ? 'their' : 'its'} files will be
          removed. This can&apos;t be undone.
        </Typography>
      </DvModal>
    </Box>
  );
}
