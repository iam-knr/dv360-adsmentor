'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvTextField } from '@/components/dv/DvTextField';
import type { OptionDef } from '@/lib/targeting/options';
import type { Sel, TargetMode } from '@/lib/targeting/types';

export interface ListEditorProps {
  options: readonly OptionDef[];
  value: Sel[];
  onChange: (next: Sel[]) => void;
  /** Where one mode only makes sense (e.g. Language exclude). Both modes by default. */
  modes?: TargetMode[];
  searchLabel?: string;
  readOnly?: boolean;
  error?: string;
}

/**
 * Shared editor chrome (P3-07a stop condition): search box, Include / Exclude choice and a checkbox list.
 * An option is in exactly one mode (TGT-001), so picking it in the other mode moves it.
 */
export function ListEditor({
  options,
  value,
  onChange,
  modes = ['INCLUDE', 'EXCLUDE'],
  searchLabel = 'Search',
  readOnly,
  error,
}: ListEditorProps) {
  const [mode, setMode] = useState<TargetMode>(modes[0]!);
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );
  const modeOf = (code: string) => value.find((s) => s.id === code)?.mode;
  const toggle = (o: OptionDef) => {
    if (readOnly) return;
    const current = modeOf(o.code);
    if (current === mode) onChange(value.filter((s) => s.id !== o.code));
    else onChange([...value.filter((s) => s.id !== o.code), { id: o.code, mode, label: o.label }]);
  };
  const count = (m: TargetMode) => value.filter((s) => s.mode === m).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {modes.length > 1 ? (
        <DvRadioGroup
          label="Mode"
          value={mode}
          readOnly={readOnly}
          onChange={(v) => setMode(v as TargetMode)}
          options={[
            { value: 'INCLUDE', label: `Include (${count('INCLUDE')})` },
            { value: 'EXCLUDE', label: `Exclude (${count('EXCLUDE')})` },
          ]}
        />
      ) : null}
      <DvTextField
        ariaLabel={searchLabel}
        placeholder={searchLabel}
        value={query}
        onChange={setQuery}
      />
      <Box role="group" aria-label="Options" sx={{ display: 'flex', flexDirection: 'column' }}>
        {shown.map((o) => {
          const m = modeOf(o.code);
          return (
            <FormControlLabel
              key={o.code}
              disabled={readOnly}
              control={<Checkbox checked={m === mode} onChange={() => toggle(o)} />}
              label={
                <Typography variant="body1" component="span">
                  {o.label}
                  {m && m !== mode ? (
                    <Typography variant="caption" color="text.secondary" component="span">
                      {' '}
                      ({m === 'INCLUDE' ? 'included' : 'excluded'})
                    </Typography>
                  ) : null}
                </Typography>
              }
            />
          );
        })}
        {shown.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No matches
          </Typography>
        ) : null}
      </Box>
      {error ? (
        <Typography role="alert" variant="body2" color="error">
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
