'use client';

// Pieces shared by the audience screens (module 14): size bar with bucket text, status chip, chip input, the
// path helpers and a hook for the form pages.
import { useState, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import { DvFieldShell, DvTooltip } from '@/components/dv';
import { advertiserPath } from '@/lib/routes/paths';
import { STATUS_LABEL, type AudienceRow, type AudienceStatusKey, type AudienceTypeKey, type SizeCell } from '@/lib/audiences/wire';

/** Bucket text with a thin bar; the exact value is in the tooltip (module 14 S1, AUD-070). */
export function SizeBar({ cell, label }: { cell: SizeCell; label?: string }) {
  return (
    <DvTooltip title={`${cell.exact.toLocaleString('en-US')} users`}>
      <Box
        component="span"
        data-testid="size-cell"
        aria-label={label ? `${label}: ${cell.bucket}` : undefined}
        sx={{ display: 'inline-flex', flexDirection: 'column', gap: 0.5, minWidth: 88 }}
      >
        <Typography variant="body2" component="span">
          {cell.bucket}
        </Typography>
        <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${Math.round(cell.fraction * 100)}%`, bgcolor: 'primary.main' }} />
        </Box>
      </Box>
    </DvTooltip>
  );
}

export function AudienceStatus({
  status,
  availableInHours,
}: {
  status: AudienceStatusKey;
  availableInHours?: number;
}) {
  if (status === 'PROCESSING' && availableInHours)
    return (
      <Chip
        size="small"
        label={`Available in about ${availableInHours} ${availableInHours === 1 ? 'hour' : 'hours'}`}
        data-testid="status-chip"
      />
    );
  return <Chip size="small" variant="outlined" label={STATUS_LABEL[status]} data-testid="status-chip" />;
}

const KIND_SLUG: Record<AudienceTypeKey, string> = {
  TAG_BASED: 'tagbased',
  CUSTOMER_MATCH: 'customermatch',
  YOUTUBE_USERS: 'youtubeusers',
  LOOKALIKE: 'lookalike',
  COMBINED: 'combined',
  CUSTOM_AFFINITY: 'affinity',
  CUSTOM_INTENT_DISPLAY_VIDEO: 'intent',
  CUSTOM_INTENT_YOUTUBE: 'intent',
  PARTNER: 'partner',
};

export function detailsPath(partnerId: string, advertiserId: string, row: Pick<AudienceRow, 'id' | 'type'>): string {
  return row.type === 'TAG_BASED'
    ? advertiserPath(partnerId, advertiserId, 'audience', 'tagbased', row.id, 'details')
    : advertiserPath(partnerId, advertiserId, 'audience', KIND_SLUG[row.type], row.id, 'details');
}

export const listPathFor = (partnerId: string, advertiserId: string, type: AudienceTypeKey): string =>
  advertiserPath(
    partnerId,
    advertiserId,
    type === 'COMBINED'
      ? 'combined-audiences'
      : type.startsWith('CUSTOM_')
        ? 'custom-lists'
        : type === 'PARTNER'
          ? 'partner-audiences'
          : 'first-party-audiences',
  );

/** Free-text chips: Enter or a comma adds one, the x removes it (interests, URLs, keywords). */
export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  validate,
  error,
  hint,
  id,
  disabled,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Message for an entry that is not acceptable, or null. */
  validate?: (value: string) => string | null;
  error?: string;
  hint?: string;
  id: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    const problem = validate?.(v) ?? null;
    if (problem) return setLocal(problem);
    setLocal(null);
    if (!values.includes(v)) onChange([...values, v]);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <DvFieldShell id={id} label={label} error={error ?? local ?? undefined} hint={hint}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: values.length ? 1 : 0 }}>
        {values.map((v) => (
          <Chip
            key={v}
            size="small"
            label={v}
            disabled={disabled}
            onDelete={() => onChange(values.filter((x) => x !== v))}
          />
        ))}
      </Box>
      <OutlinedInput
        id={id}
        size="small"
        fullWidth
        disabled={disabled}
        value={text}
        placeholder={placeholder ?? 'Type and press Enter'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(text)}
        inputProps={{ 'aria-label': label }}
      />
    </DvFieldShell>
  );
}
