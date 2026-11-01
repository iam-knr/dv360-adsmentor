'use client';

import { useId, useRef, useState, type MouseEventHandler } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import OutlinedInput from '@mui/material/OutlinedInput';
import Popover from '@mui/material/Popover';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvTooltip } from './DvTooltip';

export interface FilterField {
  id: string;
  label: string;
  type: 'multi' | 'single' | 'text' | 'dateRange';
  options?: { value: string; label: string }[];
}

export interface FilterValue {
  fieldId: string;
  values: string[];
}

export interface DvFilterBarProps {
  fields: FilterField[];
  value: FilterValue[];
  /** Text typed into the free-text input and not yet turned into a chip. */
  text: string;
  onChange: (v: FilterValue[], text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Landmark name. Default "Filters". */
  ariaLabel?: string;
  /** Real DV360: the funnel opens a menu of the filter fields (click one to edit it) instead of the active-filter list. */
  fieldMenu?: boolean;
}

export const FILTER_PLACEHOLDER = 'Enter a search term or select filters';
/** Field id of the Name/ID text chip when `fields` has no text field. */
export const NAME_ID_FIELD = '__nameId';

/** "Status: Active", "Status: 5 selected". */
export function filterChipText(field: FilterField | undefined, v: FilterValue): string {
  const label = field?.label ?? (v.fieldId === NAME_ID_FIELD ? 'Name/ID' : v.fieldId);
  if (v.values.length > 1) return `${label}: ${v.values.length} selected`;
  const raw = v.values[0] ?? '';
  const option = field?.options?.find((o) => o.value === raw);
  return `${label}: ${option?.label ?? raw}`;
}

/** MUI injects `onClick` and `className` into the delete icon; `DvIcon` ignores both, so the click would open the chip. */
function ChipDeleteIcon({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  className?: string;
}) {
  return (
    <Box component="span" className={className} onClick={onClick} sx={{ display: 'inline-flex' }}>
      <DvIcon name="close" size={16} label={label} />
    </Box>
  );
}

export function DvFilterBar({
  fields,
  value,
  text,
  onChange,
  placeholder = FILTER_PLACEHOLDER,
  disabled,
  ariaLabel = 'Filters',
  fieldMenu = false,
}: DvFilterBarProps) {
  const popId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const [funnelAnchor, setFunnelAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<{ fieldId: string; anchor: HTMLElement } | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [typingOpen, setTypingOpen] = useState(false);

  const fieldById = (id: string) => fields.find((f) => f.id === id);
  const nameField = fields.find((f) => f.type === 'text')?.id ?? NAME_ID_FIELD;

  const setFilter = (fieldId: string, values: string[]) => {
    const rest = value.filter((v) => v.fieldId !== fieldId);
    onChange(values.length ? [...rest, { fieldId, values }] : rest, text);
  };

  const openEditor = (fieldId: string, anchor: HTMLElement) => {
    setDraft(value.find((v) => v.fieldId === fieldId)?.values ?? []);
    setEditing({ fieldId, anchor });
    setTypingOpen(false);
  };

  const commitText = () => {
    const t = text.trim();
    if (!t) return;
    const existing = value.find((v) => v.fieldId === nameField)?.values ?? [];
    const rest = value.filter((v) => v.fieldId !== nameField);
    onChange([...rest, { fieldId: nameField, values: [...existing, t] }], '');
    setTypingOpen(false);
  };

  const editingField = editing ? fieldById(editing.fieldId) : undefined;
  const count = value.length;

  return (
    <Box
      ref={barRef}
      role="search"
      aria-label={ariaLabel}
      sx={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 40, flexWrap: 'wrap' }}
    >
      <DvTooltip title="Filters">
        <IconButton
          aria-label={count ? `Filters, ${count} active` : 'Filters'}
          disabled={disabled}
          onClick={(e) => setFunnelAnchor(e.currentTarget)}
          sx={{ position: 'relative' }}
        >
          <DvIcon name="filter_alt" size={20} />
          {count ? (
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'common.white',
                typography: 'caption',
                lineHeight: '16px',
                fontSize: 11,
                textAlign: 'center',
              }}
            >
              {count}
            </Box>
          ) : null}
        </IconButton>
      </DvTooltip>
      <Popover
        open={Boolean(funnelAnchor)}
        anchorEl={funnelAnchor}
        onClose={() => setFunnelAnchor(null)}
      >
        <Box sx={{ p: fieldMenu ? 0 : 3, minWidth: 240 }}>
          {fieldMenu ? (
            <List dense aria-label="Filter fields">
              {fields.map((f) => (
                <ListItemButton
                  key={f.id}
                  onClick={() => {
                    const anchor = funnelAnchor;
                    setFunnelAnchor(null);
                    if (anchor) openEditor(f.id, anchor);
                  }}
                >
                  {f.label}
                </ListItemButton>
              ))}
            </List>
          ) : count === 0 ? (
            <Typography variant="body2">No filters applied</Typography>
          ) : (
            <List dense aria-label="Active filters">
              {value.map((v) => (
                <Box component="li" key={v.fieldId} sx={{ typography: 'body1', py: 1 }}>
                  {filterChipText(fieldById(v.fieldId), v)}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Popover>

      {value.map((v) => {
        const field = fieldById(v.fieldId);
        const label = filterChipText(field, v);
        return (
          <Chip
            key={v.fieldId}
            variant="outlined"
            label={label}
            aria-label={label}
            disabled={disabled}
            onClick={(e) => openEditor(v.fieldId, e.currentTarget)}
            onDelete={() => setFilter(v.fieldId, [])}
            deleteIcon={<ChipDeleteIcon label={`Remove filter ${label}`} />}
            sx={{ '&:hover': { bgcolor: 'surface.sunken' } }}
          />
        );
      })}

      <InputBase
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(value, e.target.value);
          setTypingOpen(e.target.value.length > 0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitText();
          }
          if (e.key === 'Escape') setTypingOpen(false);
        }}
        inputProps={{
          'aria-label': 'Search or filter',
        }}
        sx={{ flex: 1, minWidth: 240, typography: 'body1' }}
      />
      <Popover
        id={popId}
        open={typingOpen && Boolean(barRef.current)}
        anchorEl={barRef.current}
        onClose={() => setTypingOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 320 } } }}
      >
        <List dense>
          <ListItemButton onClick={commitText}>
            Search for Name/ID containing: {text}
          </ListItemButton>
          <Typography variant="panelOverline" sx={{ px: 4, pt: 2, display: 'block' }}>
            Filter on:
          </Typography>
          {fields
            .filter((f) => f.type !== 'text')
            .map((f) => (
              <ListItemButton
                key={f.id}
                onClick={(e) => openEditor(f.id, barRef.current ?? e.currentTarget)}
              >
                {f.label}
              </ListItemButton>
            ))}
        </List>
      </Popover>

      {count || text ? (
        <DvTooltip title="Clear all">
          <IconButton aria-label="Clear all" disabled={disabled} onClick={() => onChange([], '')}>
            <DvIcon name="close" size={20} />
          </IconButton>
        </DvTooltip>
      ) : null}

      <Popover
        open={Boolean(editing)}
        anchorEl={editing?.anchor}
        onClose={() => setEditing(null)}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': `Edit filter ${editingField?.label ?? ''}`,
            sx: { width: 280 },
          },
        }}
      >
        {editing ? (
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" component="h3">
                {editingField?.label ?? 'Name/ID'}
              </Typography>
              <IconButton size="small" aria-label="Close" onClick={() => setEditing(null)}>
                <DvIcon name="close" size={20} />
              </IconButton>
            </Box>
            <Typography variant="caption">Matches:</Typography>
            {editingField?.type === 'single' ? (
              <RadioGroup
                value={draft[0] ?? ''}
                onChange={(_e, v) => setDraft([v])}
                aria-label="Matches"
              >
                {editingField.options?.map((o) => (
                  <FormControlLabel
                    key={o.value}
                    value={o.value}
                    control={<Radio size="small" />}
                    label={o.label}
                  />
                ))}
              </RadioGroup>
            ) : editingField?.type === 'multi' ? (
              <Box
                role="group"
                aria-label="Matches"
                sx={{ display: 'flex', flexDirection: 'column' }}
              >
                {editingField.options?.map((o) => (
                  <FormControlLabel
                    key={o.value}
                    label={o.label}
                    control={
                      <Checkbox
                        size="small"
                        checked={draft.includes(o.value)}
                        onChange={() =>
                          setDraft(
                            draft.includes(o.value)
                              ? draft.filter((d) => d !== o.value)
                              : [...draft, o.value],
                          )
                        }
                      />
                    }
                  />
                ))}
              </Box>
            ) : (
              <OutlinedInput
                value={draft[0] ?? ''}
                onChange={(e) => setDraft(e.target.value ? [e.target.value] : [])}
                inputProps={{ 'aria-label': 'Matches' }}
                sx={{ height: 32 }}
              />
            )}
            <Button
              variant="contained"
              size="small"
              sx={{ alignSelf: 'flex-end' }}
              onClick={() => {
                setFilter(editing.fieldId, draft);
                setEditing(null);
              }}
            >
              Apply
            </Button>
          </Box>
        ) : null}
      </Popover>
    </Box>
  );
}
