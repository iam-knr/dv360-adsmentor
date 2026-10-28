'use client';

import { useId, useState } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import { DvIcon } from '@/components/icons';
import { DvFieldShell, describedBy } from './DvFieldShell';

export interface DvTextFieldProps {
  label?: string;
  placeholder?: string;
  /** Controlled value. Omit and pass `defaultValue` for uncontrolled use. */
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'url';
  maxLength?: number;
  required?: boolean;
  showRequiredHint?: boolean;
  error?: string;
  warning?: string;
  hint?: string;
  help?: string;
  /** Read-only with a lock icon and sunken fill (Timezone, Currency). */
  locked?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Currency prefix such as "₹". */
  prefix?: string;
  /** Unit suffix such as "%". */
  suffix?: string;
  multiline?: boolean;
  rows?: number;
  /** Right-align digits (currency and percent inputs). */
  numeric?: boolean;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** 40 px outlined field with the label above it (design-system 2.8.1). */
export function DvTextField({
  label,
  placeholder,
  value,
  defaultValue = '',
  onChange,
  onBlur,
  id: idProp,
  name,
  type = 'text',
  maxLength,
  required,
  showRequiredHint,
  error,
  warning,
  hint,
  help,
  locked,
  disabled,
  readOnly,
  prefix,
  suffix,
  multiline,
  rows,
  numeric,
  ariaLabel,
}: DvTextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const messages = { error, warning, hint };
  return (
    <DvFieldShell
      id={id}
      label={label}
      required={required}
      showRequiredHint={showRequiredHint}
      help={help}
      error={error}
      warning={warning}
      hint={hint}
      counter={maxLength ? `${formatCount(current.length)} / ${maxLength}` : undefined}
    >
      <OutlinedInput
        id={id}
        name={name}
        type={type}
        value={current}
        placeholder={placeholder}
        multiline={multiline}
        minRows={multiline ? (rows ?? 3) : undefined}
        error={Boolean(error)}
        disabled={disabled}
        readOnly={readOnly || locked}
        onBlur={onBlur}
        onChange={(e) => {
          if (!controlled) setInner(e.target.value);
          onChange?.(e.target.value);
        }}
        startAdornment={
          prefix ? <InputAdornment position="start">{prefix}</InputAdornment> : undefined
        }
        endAdornment={
          locked ? (
            <InputAdornment position="end">
              <DvIcon name="lock" size={18} color="text.secondary" label="Locked" />
            </InputAdornment>
          ) : suffix ? (
            <InputAdornment position="end">{suffix}</InputAdornment>
          ) : undefined
        }
        inputProps={{
          maxLength,
          'aria-label': label ? undefined : ariaLabel,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy(id, messages),
          'aria-required': required ? true : undefined,
          style: numeric ? { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } : undefined,
        }}
        sx={[
          locked ? { bgcolor: 'surface.sunken' } : {},
          multiline ? { py: 2, '& textarea': { px: 3 } } : {},
        ]}
      />
    </DvFieldShell>
  );
}
