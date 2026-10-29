'use client';

// Reports hub (module 16 S1): tabs Instant / Offline, Generate report card, suggested templates, the report list.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import {
  DvBanner,
  DvCardCarousel,
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
import { partnerPath } from '@/lib/routes/paths';
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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function ReportsHub(props: ReportsHubProps) {
  const { partnerId, tab, createdBy, q, page, pageSize, total, rows, templates, canWrite } = props;
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [menu, setMenu] = useState<{ el: HTMLElement; row: ReportRow } | null>(null);
  const [share, setShare] = useState<ReportRow | null>(null);
  const [del, setDel] = useState<ReportRow | null>(null);
  const [offlineMenu, setOfflineMenu] = useState<HTMLElement | null>(null);
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
      ...over,
    };
    for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== '') p.set(k, String(v));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const go = (over: Record<string, string | number | undefined>) => router.push(href(over));
  const editable = canWrite;

  const openRow = (r: ReportRow) =>
    router.push(
      `${base}/${r.kind === 'INSTANT' ? 'instant' : 'offline'}/${r.id}`,
    );

  const runNow = async (r: ReportRow) => {
    setMenu(null);
    const res = await runReportAction(partnerId, { reportId: r.id });
    if (!res.ok) setError(res.issues[0]?.message ?? 'The report could not be run.');
    else {
      toast.show({ kind: 'neutral', message: `Ran ${r.name}` });
      startTransition(() => router.refresh());
    }
  };
  const duplicate = async (r: ReportRow) => {
    setMenu(null);
    const res = await saveReportAsAction(partnerId, r.id, `${r.name} (copy)`);
    if (!res.ok) setError(res.issues[0]?.message ?? 'Could not duplicate the report.');
    else startTransition(() => router.refresh());
  };
  const remove = async () => {
    if (!del) return;
    setBusy(true);
    const res = await deleteReportAction(del.id);
    setBusy(false);
    setDel(null);
    if (!res.ok) setError(res.issues[0]?.message ?? 'Could not delete the report.');
    else startTransition(() => router.refresh());
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

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="text"
            aria-expanded={genOpen}
            onClick={() => setGenOpen((o) => !o)}
            startIcon={<DvIcon name={genOpen ? 'expand_less' : 'expand_more'} />}
          >
            Generate report
          </Button>
          <Chip size="small" label="BETA" />
          <Chip size="small" variant="outlined" label="Tutor" />
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

      <Box>
        <Link
          href={partnerPath(partnerId, 'cross-media-reach')}
          data-testid="cross-media-link"
          underline="hover"
        >
          Cross-media reach reports
        </Link>
      </Box>

      {tab === 'instant' ? (
        <Box>
          <Typography variant="cardTitle" component="h2" sx={{ mb: 2 }}>
            Suggested templates
          </Typography>
          <DvCardCarousel
            ariaLabel="Suggested templates"
            cards={templates.map((t) => ({
              id: t.key,
              name: t.title,
              family: t.family.toLowerCase() as 'basic' | 'reach' | 'video',
              meta: t.family,
              description: t.description,
            }))}
            onApply={(id) => router.push(`${base}/instant/new?template=${id}`)}
          />
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        {tab === 'instant' ? (
          <Button
            variant="contained"
            disabled={!editable}
            onClick={() => router.push(`${base}/instant/new`)}
          >
            New instant report
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              disabled={!editable}
              onClick={(e) => setOfflineMenu(e.currentTarget)}
              endIcon={<DvIcon name="expand_more" />}
            >
              New Offline Report
            </Button>
            <Menu anchorEl={offlineMenu} open={!!offlineMenu} onClose={() => setOfflineMenu(null)}>
              <MenuItem onClick={() => router.push(`${base}/offline/new?type=floodlight`)}>
                Floodlight
              </MenuItem>
              <MenuItem onClick={() => router.push(`${base}/offline/new?type=inventory-availability`)}>
                Inventory Availability
              </MenuItem>
            </Menu>
          </>
        )}
        {createdBy === 'me' ? (
          <Chip
            label="Created by: Me"
            onDelete={() => go({ createdBy: 'any', page: undefined })}
            data-testid="created-by-chip"
          />
        ) : (
          <Chip
            variant="outlined"
            label="Created by: Anyone with access"
            onClick={() => go({ createdBy: 'me', page: undefined })}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ width: 280 }}>
          <DvTextField
            ariaLabel="Filter reports"
            placeholder="Filter"
            value={search}
            onChange={setSearch}
            onBlur={() => search !== q && go({ q: search || undefined, page: undefined })}
          />
        </Box>
      </Box>

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
              <TableCell>Report name</TableCell>
              {tab === 'offline' ? <TableCell>Report type</TableCell> : null}
              <TableCell>Created by</TableCell>
              <TableCell>Last modified</TableCell>
              <TableCell>Report ID</TableCell>
              <TableCell>Files</TableCell>
              <TableCell sx={{ width: 48 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover data-testid="report-row">
                <TableCell>
                  <Link component="button" underline="hover" onClick={() => openRow(r)}>
                    {r.name}
                  </Link>
                  {r.scheduled ? <Chip size="small" sx={{ ml: 2 }} label="Scheduled" /> : null}
                  {r.shared ? <Chip size="small" variant="outlined" sx={{ ml: 1 }} label="Shared" /> : null}
                </TableCell>
                {tab === 'offline' ? <TableCell>{KIND_LABEL[r.kind]}</TableCell> : null}
                <TableCell>{r.createdByMe ? 'Me' : r.createdBy}</TableCell>
                <TableCell>{fmtDate(r.modified)}</TableCell>
                <TableCell>{r.publicId}</TableCell>
                <TableCell>
                  <Link
                    component="button"
                    underline="hover"
                    onClick={() =>
                      router.push(`${base}/${r.kind === 'INSTANT' ? 'instant' : 'offline'}/${r.id}/runs`)
                    }
                  >
                    View{r.files ? ` (${r.files})` : ''}
                  </Link>
                </TableCell>
                <TableCell>
                  <IconButton aria-label={`Actions for ${r.name}`} onClick={(e) => setMenu({ el: e.currentTarget, row: r })}>
                    <DvIcon name="more_vert" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pages > 1 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
          <Typography variant="body2">
            Page {page} of {pages}
          </Typography>
          <Button disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            Previous
          </Button>
          <Button disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
            Next
          </Button>
        </Box>
      ) : null}

      <Menu anchorEl={menu?.el ?? null} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem disabled={!editable} onClick={() => menu && void runNow(menu.row)}>
          Run now
        </MenuItem>
        <MenuItem disabled={!editable} onClick={() => menu && void duplicate(menu.row)}>
          Duplicate
        </MenuItem>
        <MenuItem
          disabled={!editable || !menu?.row.createdByMe}
          onClick={() => {
            setShare(menu?.row ?? null);
            setMenu(null);
          }}
        >
          Share
        </MenuItem>
        <MenuItem
          disabled={!editable || !menu?.row.createdByMe}
          onClick={() => {
            setDel(menu?.row ?? null);
            setMenu(null);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
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
        open={!!del}
        title="Delete report?"
        onClose={() => setDel(null)}
        primary={{ label: 'Delete', onClick: () => void remove(), loading: busy, tone: 'danger' }}
        secondary={{ label: 'Cancel', onClick: () => setDel(null) }}
      >
        <Typography variant="body2">
          {del?.name} and its files will be removed. This can&apos;t be undone.
        </Typography>
      </DvModal>
    </Box>
  );
}
