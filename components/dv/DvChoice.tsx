'use client';

import { useId, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import type { DvIconMeaning, DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';
import { DvFieldShell, describedBy } from './DvFieldShell';
import { DvTooltip } from './DvTooltip';

export interface DvChoiceOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Tooltip shown on a disabled card ("{Type} line items aren't compatible with ..."). */
  disabledReason?: string;
  /** Card variant only. */
  icon?: DvIconName | DvIconMeaning;
  /**
   * Inline inputs shown inside the option ("Limit frequency to [n] exposures per [Month]").
   * Receives `selected` so the inputs can be disabled until the option is picked.
   */
  inline?: (selected: boolean) => ReactNode;
}

interface GroupCommon {
  label?: string;
  options: DvChoiceOption[];
  id?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}

const hidden = {
  position: 'absolute',
  opacity: 0,
  width: 1,
  height: 1,
  m: 0,
  p: 0,
  pointerEvents: 'none',
} as const;

function OptionText({ option }: { option: DvChoiceOption }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
      <Typography variant="body1" component="span">
        {option.label}
      </Typography>
      {option.description ? (
        <Typography variant="body2" component="span">
          {option.description}
        </Typography>
      ) : null}
    </Box>
  );
}

export interface DvRadioGroupProps extends GroupCommon {
  value: string;
  onChange: (v: string) => void;
  /** `cards`: bordered tiles with icon, title and description (IO type, LI type). */
  variant?: 'list' | 'cards';
}

export function DvRadioGroup({
  label,
  options,
  id: idProp,
  error,
  hint,
  required,
  disabled,
  readOnly,
  value,
  onChange,
  variant = 'list',
}: DvRadioGroupProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <DvFieldShell id={id} error={error} hint={hint}>
      <RadioGroup
        id={id}
        value={value}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        onChange={(_e, v) => {
          if (!readOnly) onChange(v);
        }}
        sx={
          variant === 'cards'
            ? {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 4,
              }
            : undefined
        }
      >
        {label ? (
          <Typography variant="subtitle1" id={`${id}-legend`} sx={{ mb: 1, gridColumn: '1 / -1' }}>
            {label}
          </Typography>
        ) : null}
        {options.map((o) => {
          const selected = o.value === value;
          const off = disabled || o.disabled;
          if (variant === 'cards') {
            const tile = (
              <Box
                component="label"
                data-selected={selected}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  p: 4,
                  borderRadius: '8px',
                  cursor: off ? 'default' : 'pointer',
                  border: selected ? '2px solid' : '1px solid',
                  borderColor: selected ? 'primary.main' : 'divider',
                  m: selected ? 0 : '1px',
                  bgcolor: selected ? 'primary.light' : off ? 'surface.sunken' : 'background.paper',
                  color: off ? 'text.disabled' : 'text.primary',
                  '&:focus-within': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                <Radio
                  value={o.value}
                  disabled={off}
                  sx={hidden}
                  slotProps={{ input: { 'aria-label': o.label } }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {o.icon ? <DvIcon name={o.icon} size={24} /> : null}
                  <Typography variant="subtitle1" component="span" sx={{ color: 'inherit' }}>
                    {o.label}
                  </Typography>
                  {off && o.disabledReason ? (
                    <DvIcon name="info" size={18} label={o.disabledReason} />
                  ) : null}
                </Box>
                {o.description ? <Typography variant="body2">{o.description}</Typography> : null}
              </Box>
            );
            return off && o.disabledReason ? (
              <DvTooltip key={o.value} title={o.disabledReason}>
                {tile}
              </DvTooltip>
            ) : (
              <Box key={o.value}>{tile}</Box>
            );
          }
          return (
            <Box key={o.value}>
              <FormControlLabel
                value={o.value}
                disabled={off}
                control={<Radio size="small" />}
                label={<OptionText option={o} />}
                sx={{ alignItems: 'flex-start', m: 0, '& .MuiRadio-root': { pt: 1 } }}
              />
              {o.inline ? <Box sx={{ ml: 8, mb: 1 }}>{o.inline(selected)}</Box> : null}
            </Box>
          );
        })}
      </RadioGroup>
    </DvFieldShell>
  );
}

export interface DvCheckboxGroupProps extends GroupCommon {
  values: string[];
  onChange: (values: string[]) => void;
}

export function DvCheckboxGroup({
  label,
  options,
  id: idProp,
  error,
  hint,
  disabled,
  readOnly,
  values,
  onChange,
}: DvCheckboxGroupProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const toggle = (v: string) => {
    if (readOnly) return;
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <DvFieldShell id={id} error={error} hint={hint}>
      <Box
        role="group"
        id={id}
        aria-label={label}
        aria-describedby={describedBy(id, { error, hint })}
        sx={{ display: 'flex', flexDirection: 'column' }}
      >
        {label ? (
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {label}
          </Typography>
        ) : null}
        {options.map((o) => {
          const selected = values.includes(o.value);
          return (
            <Box key={o.value}>
              <FormControlLabel
                disabled={disabled || o.disabled}
                control={
                  <Checkbox size="small" checked={selected} onChange={() => toggle(o.value)} />
                }
                label={<OptionText option={o} />}
                sx={{ alignItems: 'flex-start', m: 0, '& .MuiCheckbox-root': { pt: 1 } }}
              />
              {o.inline ? <Box sx={{ ml: 8, mb: 1 }}>{o.inline(selected)}</Box> : null}
            </Box>
          );
        })}
      </Box>
    </DvFieldShell>
  );
}
