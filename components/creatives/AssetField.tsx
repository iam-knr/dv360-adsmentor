'use client';

// Main asset drop zone (module 12 K2): a file chip with ⊗ once a file is attached. Files go to the upload route; the
// result says what the bytes are, and the rules (CRE-020 to CRE-023) judge them on save.
import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import type { CreativeAssetInput } from '@/lib/validation/types';
import { uploadFile, type UploadedFile } from './upload';

export function AssetField({
  id,
  label,
  accept,
  asset,
  error,
  disabled,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  asset: CreativeAssetInput | null | undefined;
  error?: string | undefined;
  disabled?: boolean;
  hint?: string;
  onChange: (asset: CreativeAssetInput | null, upload?: UploadedFile) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(undefined);
    const res = await uploadFile(file);
    setBusy(false);
    if (input.current) input.current.value = '';
    if (!res.ok) {
      setProblem(res.message);
      return;
    }
    const u = res.file;
    onChange(
      {
        uploadId: u.uploadId,
        fileName: u.fileName,
        mimeType: u.contentType,
        sizeBytes: u.sizeBytes,
        width: u.width,
        height: u.height,
        durationSeconds: u.durationSeconds,
        ...(u.entryHtml !== null ? { entryHtml: u.entryHtml } : {}),
      },
      u,
    );
  };

  const message = error ?? problem;
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={id}
        variant="body2"
        sx={{ display: 'block', mb: 1, fontWeight: 500 }}
      >
        {label}
      </Typography>
      <Box
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) void pick(e.dataTransfer.files[0]);
        }}
        sx={{
          border: '1px dashed',
          borderColor: message ? 'error.main' : 'divider',
          borderRadius: 1,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {asset ? (
          <Box
            data-testid={`${id}-chip`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 4,
              pl: 2,
              pr: 0.5,
            }}
          >
            <DvIcon name="article" size={18} />
            <Typography variant="body2">{asset.fileName}</Typography>
            {disabled ? null : (
              <IconButton
                size="small"
                aria-label={`Remove ${asset.fileName}`}
                onClick={() => onChange(null)}
              >
                <DvIcon name="cancel" size={18} />
              </IconButton>
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {busy ? 'Uploading…' : 'Drop a file here or'}
          </Typography>
        )}
        {disabled ? null : (
          <Button component="label" size="small" variant="outlined" disabled={busy}>
            {asset ? 'Replace file' : 'Browse'}
            <input
              ref={input}
              id={id}
              type="file"
              hidden
              accept={accept}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </Button>
        )}
      </Box>
      {message ? (
        <Typography role="alert" variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {message}
        </Typography>
      ) : hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}
