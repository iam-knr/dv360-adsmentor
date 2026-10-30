'use client';

// Native date input with a label and an error line; an empty value is allowed (optional end date).
import { useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function DateInput({
  label,
  value,
  onChange,
  error,
  hint,
  disabled,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean;
  min?: string;
}) {
  const id = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography component="label" htmlFor={id} variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box
        component="input"
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...(min ? { min } : {})}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        sx={{
          font: 'inherit',
          height: 40,
          px: 1.5,
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: '4px',
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      />
      {error ? (
        <Typography id={`${id}-err`} role="alert" variant="caption" color="error">
          {error}
        </Typography>
      ) : hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}
