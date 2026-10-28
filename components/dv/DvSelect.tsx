'use client';

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvFieldShell, describedBy } from './DvFieldShell';

export interface DvSelectOption {
  value: string;
  label: string;
  /** Second line (ID or path) in caption. */
  secondLine?: string;
  /** Subheader the option is listed under ("Recommended KPIs"). Order of first use is kept. */
  group?: string;
  disabled?: boolean;
}

export interface DvSelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: DvSelectOption[];
  /** "Choose goal", "Select an option". */
  placeholder?: string;
  id?: string;
  required?: boolean;
  showRequiredHint?: boolean;
  error?: string;
  warning?: string;
  hint?: string;
  help?: string;
  /** Disabled until its dependency is set. */
  disabled?: boolean;
  /** Search input at the top of the menu. */
  searchable?: boolean;
  /** 32 px variant for grids and filter popovers. */
  small?: boolean;
  ariaLabel?: string;
}

/** Outlined dropdown with grouped lists and an optional search box (design-system 2.8.2). */
export function DvSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  id: idProp,
  required,
  showRequiredHint,
  error,
  warning,
  hint,
  help,
  disabled,
  searchable,
  small,
  ariaLabel,
}: DvSelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.secondLine?.toLowerCase().includes(q),
        )
      : options;
  }, [options, query]);

  const items: ReactNode[] = [];
  if (searchable) {
    items.push(
      <ListSubheader
        key="__search"
        component="div"
        sx={{ bgcolor: 'background.paper', p: 2, lineHeight: 'normal' }}
      >
        <OutlinedInput
          autoFocus
          fullWidth
          size="small"
          value={query}
          placeholder="Search"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key !== 'Escape') e.stopPropagation();
          }}
          startAdornment={
            <InputAdornment position="start">
              <DvIcon name="search" size={20} />
            </InputAdornment>
          }
          inputProps={{ 'aria-label': 'Search options' }}
          sx={{ height: 32 }}
        />
      </ListSubheader>,
    );
  }
  let lastGroup: string | undefined;
  for (const o of visible) {
    if (o.group && o.group !== lastGroup) {
      items.push(
        <ListSubheader
          key={`g-${o.group}`}
          sx={{ typography: 'panelOverline', lineHeight: '32px' }}
        >
          {o.group}
        </ListSubheader>,
      );
    }
    lastGroup = o.group;
    items.push(
      <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <span>{o.label}</span>
          {o.secondLine ? <Typography variant="caption">{o.secondLine}</Typography> : null}
        </Box>
      </MenuItem>,
    );
  }
  if (searchable && visible.length === 0) {
    items.push(
      <MenuItem key="__none" disabled>
        No results
      </MenuItem>,
    );
  }

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
    >
      <Select
        id={id}
        value={value}
        displayEmpty
        disabled={disabled}
        error={Boolean(error)}
        onChange={(e) => onChange(String(e.target.value))}
        onClose={() => setQuery('')}
        labelId={label ? `${id}-label` : undefined}
        input={<OutlinedInput sx={small ? { height: 32 } : undefined} />}
        IconComponent={() => (
          <DvIcon
            name="arrow_drop_down"
            size={24}
            sx={{ position: 'absolute', right: 8, pointerEvents: 'none' }}
          />
        )}
        renderValue={(v) => {
          const selected = options.find((o) => o.value === v);
          return selected ? (
            selected.label
          ) : (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {placeholder}
            </Box>
          );
        }}
        SelectDisplayProps={{
          'aria-label': label ? undefined : ariaLabel,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy(id, { error, warning, hint }),
          'aria-required': required ? true : undefined,
        }}
        MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
        sx={{
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            pr: '32px !important',
          },
        }}
      >
        {items}
      </Select>
    </DvFieldShell>
  );
}
