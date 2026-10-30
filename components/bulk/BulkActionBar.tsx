'use client';

// The Bulk Action bar of the Campaigns, Insertion orders and Line items grids (module 11 2.2, 2.3). It builds the
// menu from the selected rows (same function as the capabilities endpoint), opens the confirm dialogs and edit
// panels, runs the job and reports through a snackbar that links to Bulk status.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { DvBulkBar, DvModal, DvSelect, DvTextField, type BulkMenuGroup, type BulkMenuItem } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { INVENTORY_MENU, TARGETING_MENU, computeCapabilities, type CapRow } from '@/lib/bulk/capabilities';
import { nounFor, type BulkEntityKey } from '@/lib/bulk/entities';
import { BLK_013 } from '@/lib/bulk/messages';
import type { BulkParams, BulkResponse, BulkTargetingDimension } from '@/lib/bulk/types';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { BulkEditPanel, type PanelKind } from './BulkEditPanel';
import { fetchOptions, requestDownload, runBulkRequest, type PickItem } from './client';
import { SdfDownloadDialog } from './SdfDialogs';

export interface BulkRowLite extends CapRow {
  /** Public id shown in the ID column; also the id the API takes. */
  id: string;
}

export interface BulkActionBarProps {
  entity: BulkEntityKey;
  selection: Set<string>;
  rows: readonly BulkRowLite[];
  advertiserId: string;
  /** Public id of the advertiser, for the SDF scope. */
  onClear: () => void;
  bulkStatusHref: string;
}

type Dialog =
  | { kind: 'archive' }
  | { kind: 'duplicate' }
  | { kind: 'template' }
  | { kind: 'sdf' }
  | { kind: 'edit'; panel: PanelKind; dimension?: BulkTargetingDimension; title: string }
  | null;

const item = (id: string, label: string, caps: ReturnType<typeof computeCapabilities>['actions'], key = id, shortcut?: string): BulkMenuItem => {
  const c = caps[key];
  return { id, label, disabled: !c?.enabled, ...(c && !c.enabled && c.reason ? { disabledReason: c.reason } : {}), ...(shortcut ? { shortcut } : {}) };
};

export function BulkActionBar({ entity, selection, rows, advertiserId, onClear, bulkStatusHref }: BulkActionBarProps) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ message: string; ok: boolean } | null>(null);
  const [copies, setCopies] = useState('1');
  const [parent, setParent] = useState('');
  const [templates, setTemplates] = useState<PickItem[]>([]);
  const [templateId, setTemplateId] = useState('');

  const selected = useMemo(() => rows.filter((r) => selection.has(r.id)), [rows, selection]);
  const caps = useMemo(() => computeCapabilities(entity, selected, { role: viewer.readOnly ? 'READ_ONLY' : 'STANDARD', limitedAccess: viewer.limitedAccess }).actions, [entity, selected, viewer.readOnly, viewer.limitedAccess]);

  const groups: BulkMenuGroup[] = useMemo(() => {
    const g: BulkMenuGroup[] = [{ label: 'Status', items: [item('ACTIVATE', 'Activate', caps), item('PAUSE', 'Pause', caps)] }];
    if (entity !== 'campaign') g.push({ label: 'Bulk apply', items: [item('APPLY_TEMPLATE', 'Targeting template', caps, 'APPLY_TARGETING_TEMPLATE')] });
    if (entity === 'insertionOrder')
      g.push({ label: 'Bulk edit', items: [item('EDIT_SETTINGS', 'Settings', caps), item('EDIT_CREATIVE_ASSIGNMENT', 'Creative assignment', caps)] });
    if (entity === 'lineItem') {
      const sub = (list: { dimension: BulkTargetingDimension; label: string }[]): BulkMenuItem[] =>
        list.map((d) => item(`TGT:${d.dimension}`, d.label, caps, `EDIT_TARGETING:${d.dimension}`));
      g.push({
        label: 'Bulk edit',
        items: [
          item('EDIT_SETTINGS', 'Settings', caps),
          { id: 'INVENTORY', label: 'Inventory', children: INVENTORY_MENU.map((d) => ({ ...item(`TGT:${d.dimension}`, d.label, caps, `EDIT_TARGETING:${d.dimension}`) })) },
          { id: 'CONTENT', label: 'Content targeting', children: sub(TARGETING_MENU.CONTENT) },
          { id: 'AUDIENCE', label: 'Audience targeting', children: sub(TARGETING_MENU.AUDIENCE) },
          { id: 'TECHNOLOGY', label: 'Technology targeting', children: sub(TARGETING_MENU.TECHNOLOGY) },
          item('EDIT_CREATIVE_ASSIGNMENT', 'Creative assignment', caps),
        ],
      });
    }
    g.push({ label: 'Bulk action', items: [item('ARCHIVE', 'Archive', caps), item('UNARCHIVE', 'Unarchive', caps), item('DUPLICATE', 'Duplicate', caps, 'DUPLICATE', '⌘+D')] });
    g.push({ label: 'SDF', items: [{ id: 'SDF_DOWNLOAD', label: 'Download', shortcut: '⌘+Shift+K' }, { id: 'SDF_QA', label: 'Download QA' }] });
    return g;
  }, [caps, entity]);

  const finish = (res: BulkResponse) => {
    setDialog(null);
    setError(null);
    const m = res.failed ? `${res.summary ?? 'Some items were skipped.'}` : 'Bulk action started.';
    setNote({ message: res.status === 'COMPLETED' ? m : 'Bulk action started.', ok: res.failed === 0 });
    onClear();
    router.refresh();
  };

  const run = async (params: BulkParams): Promise<string | null> => {
    setBusy(true);
    const res = await runBulkRequest(entity, [...selection], params);
    setBusy(false);
    if (!res.ok) return res.message;
    finish(res.data);
    return null;
  };

  const onAction = (id: string) => {
    setError(null);
    if (id === 'ACTIVATE' || id === 'PAUSE' || id === 'UNARCHIVE') void run({ op: id }).then((e) => e && setNote({ message: e, ok: false }));
    else if (id === 'ARCHIVE') setDialog({ kind: 'archive' });
    else if (id === 'DUPLICATE') setDialog({ kind: 'duplicate' });
    else if (id === 'APPLY_TEMPLATE') {
      void fetchOptions(advertiserId, 'templates').then(setTemplates);
      setDialog({ kind: 'template' });
    } else if (id === 'EDIT_SETTINGS') setDialog({ kind: 'edit', panel: 'settings', title: 'Settings' });
    else if (id === 'EDIT_CREATIVE_ASSIGNMENT') setDialog({ kind: 'edit', panel: 'creative', title: 'Creative assignment' });
    else if (id.startsWith('TGT:')) {
      const dimension = id.slice(4) as BulkTargetingDimension;
      const label = [...INVENTORY_MENU, ...TARGETING_MENU.CONTENT, ...TARGETING_MENU.AUDIENCE, ...TARGETING_MENU.TECHNOLOGY].find((d) => d.dimension === dimension)?.label ?? dimension;
      setDialog({ kind: 'edit', panel: 'targeting', dimension, title: label });
    } else if (id === 'SDF_DOWNLOAD') setDialog({ kind: 'sdf' });
    else if (id === 'SDF_QA')
      void requestDownload({ advertiserId, kind: 'QA', include: {}, selection: { entity, ids: [...selection] } }).then((r) => {
        setNote(r.ok ? { message: 'Your download is being prepared.', ok: true } : { message: r.message, ok: false });
        if (r.ok) router.refresh();
      });
  };

  const n = selection.size;
  const noun = nounFor(entity, n);
  const copiesNum = Number(copies);
  const copiesBad = !Number.isInteger(copiesNum) || copiesNum < 1;
  const types = new Set(selected.map((r) => r.type).filter((t): t is LiType => !!t));

  return (
    <>
      <DvBulkBar count={n} groups={groups} onAction={onAction} onClear={onClear} />
      <DvModal
        open={dialog?.kind === 'archive'}
        title={`Archive ${n} ${noun}?`}
        primary={{ label: 'Archive', tone: 'danger', loading: busy, onClick: () => void run({ op: 'ARCHIVE' }).then(setError) }}
        secondary={{ label: 'Cancel', onClick: () => setDialog(null) }}
        onClose={() => setDialog(null)}
        error={error ?? undefined}
      >
        <Typography>
          Archived {noun} stop serving and are hidden from the default list.
          {entity === 'campaign' ? ' Their insertion orders and line items are archived too.' : entity === 'insertionOrder' ? ' Their line items are archived too.' : ''}
        </Typography>
      </DvModal>
      <DvModal
        open={dialog?.kind === 'duplicate'}
        title={`Duplicate ${n} ${noun}`}
        primary={{
          label: 'Duplicate',
          loading: busy,
          onClick: () => {
            if (copiesBad) return setError(BLK_013);
            void run({ op: 'DUPLICATE', copies: copiesNum, ...(parent.trim() ? { targetParentId: parent.trim() } : {}) }).then(setError);
          },
        }}
        secondary={{ label: 'Cancel', onClick: () => setDialog(null) }}
        onClose={() => setDialog(null)}
        error={error ?? undefined}
      >
        <Box sx={{ display: 'grid', gap: 2 }}>
          {entity !== 'campaign' ? (
            <DvTextField label={entity === 'insertionOrder' ? 'Target campaign ID (blank keeps the current one)' : 'Target insertion order ID (blank keeps the current one)'} value={parent} onChange={setParent} />
          ) : null}
          <DvTextField label="Number of copies" type="number" value={copies} onChange={setCopies} error={copiesBad ? BLK_013 : undefined} />
          <Typography variant="caption">
            Duplicating {n} {noun} with {copiesBad ? '?' : copiesNum} {copiesNum === 1 ? 'copy' : 'copies'}
          </Typography>
        </Box>
      </DvModal>
      <DvModal
        open={dialog?.kind === 'template'}
        title="Apply targeting template"
        primary={{ label: 'Apply', loading: busy, onClick: () => (templateId ? void run({ op: 'APPLY_TARGETING_TEMPLATE', templateId }).then(setError) : setError('Select a template.')) }}
        secondary={{ label: 'Cancel', onClick: () => setDialog(null) }}
        onClose={() => setDialog(null)}
        error={error ?? undefined}
      >
        <DvSelect label="Template" value={templateId} onChange={setTemplateId} placeholder="Select a template" options={templates.map((t) => ({ value: t.id, label: `${t.label} (${LI_TYPE_LABEL[(t.detail ?? 'DISPLAY') as LiType] ?? t.detail})` }))} />
        {templateId ? (() => {
          const type = templates.find((t) => t.id === templateId)?.detail as LiType | undefined;
          const match = entity === 'lineItem' && type ? selected.filter((r) => r.type === type).length : null;
          return match === null ? null : (
            <Typography variant="caption" sx={{ display: 'block', mt: 2 }}>
              {match} of {n} selected line items match this template&apos;s type
              {types.size > 1 || match < n ? ' The others are skipped.' : ''}
            </Typography>
          );
        })() : null}
      </DvModal>
      {dialog?.kind === 'edit' ? (
        <BulkEditPanel
          open
          kind={dialog.panel}
          entity={entity}
          count={n}
          advertiserId={advertiserId}
          {...(dialog.dimension ? { dimension: dialog.dimension } : {})}
          title={dialog.title}
          onCancel={() => setDialog(null)}
          onApply={run}
        />
      ) : null}
      <SdfDownloadDialog
        open={dialog?.kind === 'sdf'}
        advertiserId={advertiserId}
        selection={{ entity, ids: [...selection] }}
        onClose={() => setDialog(null)}
        onStarted={() => {
          setDialog(null);
          setNote({ message: 'Your download is being prepared.', ok: true });
          router.refresh();
        }}
      />
      <Snackbar open={!!note} autoHideDuration={8000} onClose={() => setNote(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert severity={note?.ok ? 'success' : 'warning'} role="status" onClose={() => setNote(null)}>
          {note?.message}{' '}
          <Link href={bulkStatusHref} underline="always">View Bulk status</Link>
        </Alert>
      </Snackbar>
    </>
  );
}
