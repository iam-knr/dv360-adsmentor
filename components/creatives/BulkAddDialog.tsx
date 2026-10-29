'use client';

// Bulk add creatives dialog (module 12 S8): 1 download the template, 2 choose the CSV (and an optional ZIP of the files
// it names), 3 upload. The result lands in Bulk status; failed rows are in the result CSV with their rule ids (CRE-050).
import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvModal } from '@/components/dv/DvModal';
import { useToast } from '@/components/dv/DvToast';
import { bulkAddCreativesAction } from '@/lib/creatives/actions';
import { BULK_KINDS, BULK_KIND_LABEL, type BulkCreativeKind } from '@/lib/creatives/bulk-csv';
import { uploadFile } from './upload';

export function BulkAddDialog({
  kind,
  advertiserId,
  bulkStatusHref,
  onClose,
  onDone,
}: {
  kind: BulkCreativeKind | 'templates' | null;
  advertiserId: string;
  bulkStatusHref: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [csv, setCsv] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const reset = () => {
    setCsv(null);
    setZip(null);
    setError(undefined);
  };
  const close = () => {
    reset();
    onClose();
  };

  if (kind === 'templates')
    return (
      <DvModal
        open
        title="Download templates"
        primary={{ label: 'Done', onClick: close }}
        onClose={close}
      >
        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          {BULK_KINDS.map((k) => (
            <li key={k}>
              <Link href={`/api/dv/creatives/templates/${k}`} download>
                {BULK_KIND_LABEL[k]}
              </Link>
            </li>
          ))}
        </Box>
      </DvModal>
    );

  const upload = async () => {
    if (!kind || !csv) {
      setError('Choose a CSV file.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const csvUp = await uploadFile(csv);
      if (!csvUp.ok) return setError(csvUp.message);
      let zipId: string | undefined;
      if (zip) {
        const zipUp = await uploadFile(zip);
        if (!zipUp.ok) return setError(zipUp.message);
        zipId = zipUp.file.uploadId;
      }
      const res = await bulkAddCreativesAction(advertiserId, {
        kind,
        csvUploadId: csvUp.file.uploadId,
        ...(zipId ? { assetsZipUploadId: zipId } : {}),
      });
      if (!res.ok) return setError(res.issues[0]?.message ?? 'The upload failed.');
      toast.show({
        kind: res.data.failed ? 'warning' : 'neutral',
        message: res.data.failed
          ? `Bulk add started: ${res.data.done} created, ${res.data.failed} failed.`
          : 'Bulk add started',
        action: { label: 'Bulk status', onClick: () => window.location.assign(bulkStatusHref) },
      });
      reset();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DvModal
      open={kind !== null}
      title={
        kind ? `Bulk add ${BULK_KIND_LABEL[kind].toLowerCase()} creatives` : 'Bulk add creatives'
      }
      size="md"
      primary={{ label: 'Upload', onClick: () => void upload(), loading: busy }}
      secondary={{ label: 'Cancel', onClick: close }}
      onClose={close}
      {...(error ? { error } : {})}
    >
      {kind ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography>
            1.{' '}
            <Link href={`/api/dv/creatives/templates/${kind}`} download>
              Download template
            </Link>
          </Typography>
          <Box>
            <Typography component="label" htmlFor="bulk-csv" sx={{ display: 'block', mb: 1 }}>
              2. Choose the filled CSV file
            </Typography>
            <input
              id="bulk-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsv(e.target.files?.[0] ?? null)}
            />
          </Box>
          <Box>
            <Typography component="label" htmlFor="bulk-zip" sx={{ display: 'block', mb: 1 }}>
              Optional: a ZIP with the files the CSV names
            </Typography>
            <input
              id="bulk-zip"
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setZip(e.target.files?.[0] ?? null)}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Up to 500 rows. Rows that fail are listed with their rule in the result file.
          </Typography>
        </Box>
      ) : null}
    </DvModal>
  );
}
