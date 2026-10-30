'use client';

// SDF dialogs (module 11 2.1): Download (two steps), Upload, and the SDF menu for the list headers.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DvBanner, DvModal, DvSelect } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import type { BulkEntityKey } from '@/lib/bulk/entities';
import { BLK } from '@/lib/sdf/rules';
import { ENTITY_LABEL, SDF_ENTITIES, SDF_VERSIONS, type SdfEntity } from '@/lib/sdf/versions';
import { requestDownload, uploadSdf } from './client';

export const SDF9_NOTE =
  'SDF version 9 will no longer be supported starting January 28, 2027. Upgrade to the latest version… upgrade to SDF version 11.';
const EU_NOTE = 'Line items without an answer for EU political ads will get "No"';
const LEGACY_NOTE =
  'Inventory source and Targeting are no longer managed at campaign or IO level. Leave those columns empty.';

async function info(advertiserId: string): Promise<{ version: string } | null> {
  const res = await fetch(`/api/dv/sdf/info?advertiserId=${encodeURIComponent(advertiserId)}`);
  const json = (await res.json().catch(() => ({}))) as { data?: { version: string } };
  return json.data ?? null;
}

export function SdfDownloadDialog({
  open,
  advertiserId,
  selection,
  onClose,
  onStarted,
}: {
  open: boolean;
  advertiserId: string;
  selection?: { entity: BulkEntityKey; ids: string[] };
  onClose: () => void;
  onStarted: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [include, setInclude] = useState<Record<string, boolean>>({});
  const [version, setVersion] = useState('11');
  const [current, setCurrent] = useState('11');
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setInclude(Object.fromEntries(SDF_ENTITIES.map((e) => [e, true])));
    void info(advertiserId).then((i) => {
      if (i) {
        setVersion(i.version);
        setCurrent(i.version);
      }
    });
  }, [open, advertiserId]);

  const ticked = SDF_ENTITIES.filter((e) => include[e]);
  const start = async () => {
    setBusy(true);
    const res = await requestDownload({
      advertiserId,
      kind: 'DATA',
      include,
      version,
      includeArchived: archived,
      ...(selection ? { selection } : {}),
    });
    setBusy(false);
    if (res.ok) onStarted();
    else setError(res.message);
  };

  return (
    <DvModal
      open={open}
      size="md"
      title="Download Structured Data Files"
      onClose={onClose}
      error={error ?? undefined}
      primary={
        step === 1
          ? {
              label: 'Next',
              onClick: () => (ticked.length ? setStep(2) : setError(BLK['BLK-001'])),
            }
          : { label: 'Download', loading: busy, onClick: () => void start() }
      }
      secondary={
        step === 1
          ? { label: 'Cancel', onClick: onClose }
          : { label: 'Back', onClick: () => setStep(1) }
      }
    >
      {current === '9' ? <DvBanner kind="warning">{SDF9_NOTE}</DvBanner> : null}
      {step === 1 ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            {selection ? `Downloading ${selection.ids.length} selected` : 'Downloading all'} —
            Include CSV files for each
          </Typography>
          <Box role="group" aria-label="Entity files" sx={{ display: 'grid' }}>
            {SDF_ENTITIES.map((e: SdfEntity) => (
              <FormControlLabel
                key={e}
                control={
                  <Checkbox
                    size="small"
                    checked={!!include[e]}
                    onChange={(ev) => {
                      setError(null);
                      setInclude({ ...include, [e]: ev.target.checked });
                    }}
                  />
                }
                label={ENTITY_LABEL[e]}
              />
            ))}
          </Box>
          <Typography variant="caption">
            Using Excel to edit Structured Data Files may cause formatting errors.
          </Typography>
          {ticked.length === 0 ? (
            <Typography role="alert" color="error" variant="caption" sx={{ display: 'block' }}>
              {BLK['BLK-001']}
            </Typography>
          ) : null}
        </Box>
      ) : (
        <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
          <DvSelect
            label="SDF version"
            value={version}
            onChange={setVersion}
            options={SDF_VERSIONS.map((v) => ({
              value: v,
              label: v === '9' ? '9 (Deprecated)' : v,
            }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
            }
            label="Include archived entities"
          />
        </Box>
      )}
    </DvModal>
  );
}

export function SdfUploadDialog({
  open,
  advertiserId,
  onClose,
  onDone,
}: {
  open: boolean;
  advertiserId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [version, setVersion] = useState('11');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setError(null);
    void info(advertiserId).then((i) => i && setVersion(i.version));
  }, [open, advertiserId]);

  const add = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const upload = async () => {
    setBusy(true);
    const res = await uploadSdf(advertiserId, files);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    const d = res.data;
    if (d.status === 'FAILED') return setError(d.fileErrors[0]?.message ?? 'The upload failed.');
    const failed = d.perFile.reduce((n, f) => n + f.failed, 0);
    const ok = d.perFile.reduce((n, f) => n + f.succeeded, 0);
    onDone(`Upload finished: ${ok} succeeded, ${failed} failed.`);
  };

  return (
    <DvModal
      open={open}
      size="md"
      title="Upload structured data files"
      onClose={onClose}
      error={error ?? undefined}
      primary={{
        label: 'Upload',
        loading: busy,
        onClick: () => (files.length ? void upload() : setError('Add at least one CSV file.')),
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      {version === '9' ? <DvBanner kind="warning">{SDF9_NOTE}</DvBanner> : null}
      <DvBanner kind="info">{EU_NOTE}</DvBanner>
      <DvBanner kind="info">{LEGACY_NOTE}</DvBanner>
      <Typography sx={{ mt: 2 }}>
        Upload up to one CSV file per entity type, for example, one for all line items, another for
        all ad groups, etc.
      </Typography>
      <Box
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
        sx={{ border: '2px dashed', borderColor: 'divider', p: 3, my: 2, textAlign: 'center' }}
      >
        <Typography>Drag your SDF files here to upload</Typography>
        <Typography variant="caption">or if you prefer</Typography>
        <Box>
          <Button variant="outlined" onClick={() => input.current?.click()}>
            Browse
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            multiple
            hidden
            aria-label="SDF files"
            data-testid="sdf-file-input"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
        </Box>
      </Box>
      <Box component="ul" aria-label="Files to upload" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {files.map((f, i) => (
          <Box
            component="li"
            key={`${f.name}-${i}`}
            sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <Typography sx={{ flex: 1 }}>{f.name}</Typography>
            <Typography variant="caption">{Math.max(1, Math.round(f.size / 1024))} KB</Typography>
            <Button
              size="small"
              aria-label={`Remove ${f.name}`}
              onClick={() => setFiles(files.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
          </Box>
        ))}
      </Box>
      <Typography variant="caption">
        SDF-ResultFiles.zip files now include separate files listing successful and failed uploads.
      </Typography>
    </DvModal>
  );
}

/** SDF menu for the page headers (Campaigns ⋮, IO and line item grids). */
export function SdfMenu({
  advertiserId,
  campaignsList = false,
}: {
  advertiserId: string;
  campaignsList?: boolean;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'download' | 'upload' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const quick = async (kind: 'QA' | 'METADATA') => {
    setAnchor(null);
    const res = await requestDownload({ advertiserId, kind, include: {} });
    setNote(res.ok ? 'Your download is being prepared. See Bulk status.' : res.message);
    if (res.ok) router.refresh();
  };

  return (
    <>
      <Button variant="outlined" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        SDF
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setDialog('download');
          }}
        >
          Download
        </MenuItem>
        <MenuItem
          disabled={viewer.readOnly}
          onClick={() => {
            setAnchor(null);
            setDialog('upload');
          }}
        >
          Upload
        </MenuItem>
        {campaignsList ? (
          <MenuItem onClick={() => void quick('METADATA')}>Download metadata</MenuItem>
        ) : null}
        <MenuItem onClick={() => void quick('QA')}>Download QA</MenuItem>
      </Menu>
      <SdfDownloadDialog
        open={dialog === 'download'}
        advertiserId={advertiserId}
        onClose={() => setDialog(null)}
        onStarted={() => {
          setDialog(null);
          setNote('Your download is being prepared. See Bulk status.');
          router.refresh();
        }}
      />
      <SdfUploadDialog
        open={dialog === 'upload'}
        advertiserId={advertiserId}
        onClose={() => setDialog(null)}
        onDone={(m) => {
          setDialog(null);
          setNote(m);
          router.refresh();
        }}
      />
      {note ? (
        <Typography role="status" variant="caption" sx={{ ml: 2 }}>
          {note}
        </Typography>
      ) : null}
    </>
  );
}
