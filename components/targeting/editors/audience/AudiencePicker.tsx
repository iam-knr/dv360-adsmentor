'use client';

import { useId, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { eligibleFor, GOOGLE_KIND_LABEL } from '@/lib/targeting/audience';
import type { CatalogueItem } from './useAudienceCatalogue';

export interface AudiencePickerProps {
  open: boolean;
  title: string;
  items: CatalogueItem[];
  lineItemType: LiType | null;
  initial: string[];
  /** Categories listed in the type filter whether or not they have lists, in this order. */
  categories?: PickerCategory[];
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}

export const SUBTYPE_LABEL: Record<string, string> = {
  ...GOOGLE_KIND_LABEL,
  FIRST_PARTY: 'First-party',
  PARTNER: 'Partner',
  LOOKALIKE: 'Lookalike',
  COMBINED: 'Combined',
  CUSTOM: 'Custom',
  CUSTOM_AFFINITY: 'Custom affinity',
  CUSTOM_INTENT_DISPLAY_VIDEO: 'Custom intent (Display, Video)',
  CUSTOM_INTENT_YOUTUBE: 'Custom intent (YouTube)',
};

/** A category the picker always offers, even when the advertiser has no list in it yet. */
export interface PickerCategory {
  value: string;
  /** Link to the Audiences form that creates a list of this category. */
  createHref?: string;
}

/** Audience picker (module 10 2.5): type filter, eligibility chip, search, rows with path and ID, "None selected". */
export function AudiencePicker({
  open,
  title,
  items,
  lineItemType,
  initial,
  categories = [],
  onApply,
  onCancel,
}: AudiencePickerProps) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const titleId = useId();

  const eligible = useMemo(
    () => items.filter((i) => eligibleFor(i.meta, lineItemType)),
    [items, lineItemType],
  );
  const types = useMemo(() => {
    const present = new Set(eligible.map((i) => i.subtype));
    const fixed = categories.map((c) => c.value);
    return [...fixed, ...[...present].filter((t) => !fixed.includes(t))];
  }, [eligible, categories]);
  const category = categories.find((c) => c.value === type);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eligible.filter(
      (i) =>
        (type === 'ALL' || i.subtype === type) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q) ||
          i.id.includes(q)),
    );
  }, [eligible, query, type]);
  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const suggestions = eligible.filter((i) => !picked.includes(i.id)).slice(0, 2);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <DvSelect
              label="Audience type"
              value={type}
              onChange={setType}
              options={[
                { value: 'ALL', label: 'All types' },
                ...types.map((t) => ({
                  value: t,
                  label: SUBTYPE_LABEL[t] ?? t,
                })),
              ]}
            />
            {lineItemType ? (
              <Chip label={`Audience eligibility: ${LI_TYPE_LABEL[lineItemType]}`} size="small" />
            ) : null}
          </Box>
          <DvTextField
            ariaLabel="Search audiences"
            placeholder="Search audiences"
            value={query}
            onChange={setQuery}
          />
          <Box role="group" aria-label="Audiences" sx={{ maxHeight: 320, overflow: 'auto' }}>
            {shown.map((i) => (
              <Box key={i.id} sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Checkbox
                  checked={picked.includes(i.id)}
                  onChange={() => toggle(i.id)}
                  slotProps={{ input: { 'aria-label': i.name } }}
                />
                <Box sx={{ py: 0.75 }}>
                  <Typography variant="body2">{i.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {i.path}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID {i.id}
                  </Typography>
                </Box>
              </Box>
            ))}
            {shown.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                {category && !query.trim()
                  ? `No ${SUBTYPE_LABEL[category.value] ?? 'audiences'} lists yet for this line item.`
                  : 'No audiences match.'}
                {category?.createHref && !query.trim() ? (
                  <>
                    {' '}
                    <a href={category.createHref} target="_blank" rel="noreferrer">
                      Create a {SUBTYPE_LABEL[category.value]?.toLowerCase()} list
                    </a>
                  </>
                ) : null}
              </Typography>
            ) : null}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {picked.length === 0 ? 'None selected' : `${picked.length} selected`}
            </Typography>
            {picked.length > 0 ? (
              <Button size="small" onClick={() => setPicked([])}>
                Clear all
              </Button>
            ) : null}
          </Box>
          <Box
            component="ul"
            aria-label="Selected audiences"
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {picked.map((id) => (
              <Typography component="li" variant="body2" key={id}>
                {byId.get(id)?.name ?? id}
              </Typography>
            ))}
          </Box>
          {suggestions.length > 0 ? (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <Typography variant="subtitle2">Audience suggestions</Typography>
              {suggestions.map((s) => (
                <Box key={s.id} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {s.name}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => toggle(s.id)}
                    aria-label={`Select suggestion ${s.name}`}
                  >
                    Add
                  </Button>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onApply(picked)}>
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
