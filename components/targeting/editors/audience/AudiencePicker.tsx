'use client';

// Audience pickers of the line item targeting (module 10 2.5; fidelity audit LIT-006 to LIT-011, AUD-001 to AUD-011):
// a stacked full-height slide-over per section with Apply / Cancel in the footer, an Audience type dropdown, a filter
// bar, a table with a select-all header and numeric IDs, and a "None selected" column.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvSelect, type DvSelectOption } from '@/components/dv/DvSelect';
import { DvSlideOver } from '@/components/dv/DvSlideOver';
import { DvHelp } from '@/components/dv/DvTooltip';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { eligibleFor, GOOGLE_KIND_LABEL } from '@/lib/targeting/audience';
import type { CatalogueItem } from './useAudienceCatalogue';

export type PickerKind = 'custom' | 'firstParty' | 'google' | 'combined';

export const SUBTYPE_LABEL: Record<string, string> = {
  ...GOOGLE_KIND_LABEL,
  FIRST_PARTY: 'First-party',
  PARTNER: 'Partner',
  LOOKALIKE: 'Lookalike',
  COMBINED: 'Combined',
  CUSTOM: 'Custom',
  CUSTOM_AFFINITY: 'Custom Affinity',
  CUSTOM_INTENT_DISPLAY_VIDEO: 'Custom Intent',
  CUSTOM_INTENT_YOUTUBE: 'Custom Intent',
};

interface KindConfig {
  title: string;
  defaultType: string;
  options: DvSelectOption[];
  /** Whether a catalogue item belongs to a dropdown value. */
  matches: (value: string, subtype: string) => boolean;
  suggestions: boolean;
}

const CONFIG: Record<PickerKind, KindConfig> = {
  custom: {
    title: 'Select custom lists',
    defaultType: 'CUSTOM_AFFINITY',
    options: [
      { value: 'ALL', label: 'Custom lists' },
      { value: 'CUSTOM_AFFINITY', label: 'Custom affinity' },
      { value: 'CUSTOM_INTENT', label: 'Custom intent' },
    ],
    matches: (v, t) =>
      v === 'ALL' || (v === 'CUSTOM_INTENT' ? t.startsWith('CUSTOM_INTENT') : t === v),
    suggestions: false,
  },
  firstParty: {
    title: 'First-party and partner audiences',
    defaultType: 'FIRST_PARTY',
    options: [
      { value: 'FIRST_PARTY', label: 'First-party', group: 'First-party' },
      { value: 'PAIR', label: 'PAIR', group: 'First-party' },
      { value: 'COMMERCE', label: 'Commerce', group: 'Partner' },
      { value: 'LINEAR_TV', label: 'Linear TV', group: 'Partner' },
      { value: 'THIRD_PARTY', label: 'Third-party', group: 'Partner' },
    ],
    // Lookalike lists are first-party seeds; the module-14 "partner" lists are third-party data.
    matches: (v, t) =>
      v === 'FIRST_PARTY'
        ? t === 'FIRST_PARTY' || t === 'LOOKALIKE'
        : v === 'THIRD_PARTY'
          ? t === 'PARTNER' || t === 'THIRD_PARTY'
          : t === v,
    suggestions: true,
  },
  google: {
    title: 'Google audiences',
    defaultType: 'AFFINITY',
    options: [
      { value: 'AFFINITY', label: 'Affinity' },
      { value: 'IN_MARKET', label: 'In-market' },
    ],
    matches: (v, t) => t === v,
    suggestions: true,
  },
  combined: {
    title: 'Select combined audience',
    defaultType: 'COMBINED',
    options: [{ value: 'COMBINED', label: 'Combined' }],
    matches: () => true,
    suggestions: false,
  },
};

export const PICKER_TITLE: Record<PickerKind, string> = {
  custom: CONFIG.custom.title,
  firstParty: CONFIG.firstParty.title,
  google: CONFIG.google.title,
  combined: CONFIG.combined.title,
};

export interface AudiencePickerProps {
  open: boolean;
  kind: PickerKind;
  items: CatalogueItem[];
  lineItemType: LiType | null;
  initial: string[];
  /** Link of "campaign settings" in the suggestions panel. */
  campaignSettingsHref?: string;
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}

const lineOf = (kind: PickerKind, i: CatalogueItem) =>
  kind === 'google' ? i.path : `${SUBTYPE_LABEL[i.subtype] ?? i.subtype} · ${i.name}`;
const idOf = (i: CatalogueItem) => i.displayId ?? i.id;
const isYoutube = (i: CatalogueItem) =>
  (i.meta.eligibleTypes ?? []).some((t) => t.startsWith('YT_'));

const ROW_H = 45;

/** Slide-over picker for one audience section: stacked above the Audience lists panel. */
export function AudiencePicker({
  open,
  kind,
  items,
  lineItemType,
  initial,
  campaignSettingsHref,
  onApply,
  onCancel,
}: AudiencePickerProps) {
  const cfg = CONFIG[kind];
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState('');
  const [type, setType] = useState(cfg.defaultType);
  const [tab, setTab] = useState<'display' | 'youtube'>('display');
  const [eligibilityOn, setEligibilityOn] = useState(true);
  const [suggestedOnly, setSuggestedOnly] = useState(false);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const [funnel, setFunnel] = useState<HTMLElement | null>(null);

  const eligible = useMemo(
    () => (eligibilityOn ? items.filter((i) => eligibleFor(i.meta, lineItemType)) : items),
    [items, lineItemType, eligibilityOn],
  );
  const suggested = useMemo(
    () => new Set(eligible.filter((i) => cfg.matches(type, i.subtype)).slice(0, 6).map((i) => i.id)),
    [eligible, cfg, type],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eligible.filter(
      (i) =>
        cfg.matches(type, i.subtype) &&
        (kind !== 'combined' || isYoutube(i) === (tab === 'youtube')) &&
        (!suggestedOnly || suggested.has(i.id)) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q) ||
          idOf(i).includes(q)),
    );
  }, [eligible, query, type, tab, kind, cfg, suggestedOnly, suggested]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allShown = shown.length > 0 && shown.every((i) => picked.includes(i.id));
  const someShown = shown.some((i) => picked.includes(i.id));
  const toggleAll = () =>
    setPicked((cur) =>
      allShown
        ? cur.filter((id) => !shown.some((i) => i.id === id))
        : [...cur, ...shown.map((i) => i.id).filter((id) => !cur.includes(id))],
    );
  const byId = new Map(items.map((i) => [i.id, i]));
  const eligibilityLabel = lineItemType ? `Audience eligibility: ${LI_TYPE_LABEL[lineItemType]}` : null;
  const chips = [
    ...(eligibilityLabel && eligibilityOn && kind !== 'custom'
      ? [{ key: 'eligibility', label: eligibilityLabel, clear: () => setEligibilityOn(false) }]
      : []),
    ...(suggestedOnly
      ? [{ key: 'suggested', label: 'Audience suggestions', clear: () => setSuggestedOnly(false) }]
      : []),
  ];

  return (
    <DvSlideOver
      open={open}
      level={1}
      width="xwide"
      title={cfg.title}
      dirty={JSON.stringify(picked) !== JSON.stringify(initial)}
      onApply={() => onApply(picked)}
      onCancel={onCancel}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Box sx={{ maxWidth: 280 }}>
            <DvSelect
              label="Audience type"
              value={type}
              onChange={setType}
              options={cfg.options}
            />
          </Box>

          {/* Filter bar: funnel (with badge), chips, free text, clear */}
          <Box
            data-testid="picker-filter-bar"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              px: 1,
              minHeight: 40,
            }}
          >
            <IconButton
              size="small"
              aria-label="Filter"
              aria-haspopup="menu"
              onClick={(e) => setFunnel(e.currentTarget)}
              sx={{ position: 'relative' }}
            >
              <DvIcon name="filter_alt" size={20} />
              {chips.length > 0 ? (
                <Box
                  component="span"
                  data-testid="filter-badge"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontSize: 10,
                    lineHeight: '14px',
                    textAlign: 'center',
                  }}
                >
                  {chips.length}
                </Box>
              ) : null}
            </IconButton>
            <Menu anchorEl={funnel} open={Boolean(funnel)} onClose={() => setFunnel(null)}>
              {eligibilityLabel && kind !== 'custom' ? (
                <MenuItem
                  onClick={() => {
                    setEligibilityOn(true);
                    setFunnel(null);
                  }}
                >
                  {eligibilityLabel}
                </MenuItem>
              ) : (
                <MenuItem disabled>No filters available</MenuItem>
              )}
            </Menu>
            {chips.map((c) => (
              <Chip key={c.key} size="small" label={c.label} onDelete={c.clear} />
            ))}
            <OutlinedInput
              size="small"
              value={query}
              placeholder="Enter a search term or select filters"
              onChange={(e) => setQuery(e.target.value)}
              inputProps={{ 'aria-label': 'Enter a search term or select filters' }}
              sx={{ flex: 1, minWidth: 160, '& fieldset': { border: 0 } }}
            />
            {query ? (
              <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                <DvIcon name="close" size={18} />
              </IconButton>
            ) : null}
          </Box>

          {kind === 'combined' ? (
            <Box role="tablist" aria-label="Combined audience users" sx={{ display: 'flex', gap: 3, borderBottom: 1, borderColor: 'divider' }}>
              {(['display', 'youtube'] as const).map((t) => (
                <Box
                  key={t}
                  component="button"
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  sx={{
                    border: 0,
                    background: 'none',
                    cursor: 'pointer',
                    font: 'inherit',
                    py: 1,
                    color: tab === t ? 'primary.main' : 'text.secondary',
                    borderBottom: 2,
                    borderColor: tab === t ? 'primary.main' : 'transparent',
                  }}
                >
                  {t === 'display' ? 'Display users' : 'YouTube users'}
                </Box>
              ))}
            </Box>
          ) : null}

          <Box role="table" aria-label="Audiences" sx={{ maxHeight: 420, overflow: 'auto' }}>
            <Box
              role="row"
              sx={{
                display: 'flex',
                alignItems: 'center',
                height: ROW_H,
                borderBottom: 1,
                borderTop: 1,
                borderColor: 'divider',
                position: 'sticky',
                top: 0,
                bgcolor: 'background.paper',
                zIndex: 1,
              }}
            >
              <Checkbox
                checked={allShown}
                indeterminate={!allShown && someShown}
                disabled={shown.length === 0}
                onChange={toggleAll}
                slotProps={{ input: { 'aria-label': 'Select all' } }}
              />
              <Typography role="columnheader" variant="subtitle2" sx={{ flex: 1 }}>
                Name
              </Typography>
              <Typography
                role="columnheader"
                variant="subtitle2"
                sx={{ width: 120, textAlign: 'right', pr: 2 }}
              >
                ID
              </Typography>
            </Box>
            {shown.map((i) => (
              <Box
                role="row"
                key={i.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  height: ROW_H,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Checkbox
                  checked={picked.includes(i.id)}
                  onChange={() => toggle(i.id)}
                  slotProps={{ input: { 'aria-label': i.name } }}
                />
                <Box role="cell" sx={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
                  <Typography variant="body2" noWrap sx={{ lineHeight: '18px' }}>
                    {i.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    component="div"
                    title={lineOf(kind, i)}
                    sx={{ lineHeight: '16px' }}
                  >
                    {lineOf(kind, i)}
                  </Typography>
                </Box>
                <Typography
                  role="cell"
                  variant="body2"
                  sx={{ width: 120, textAlign: 'right', pr: 2, fontVariantNumeric: 'tabular-nums' }}
                >
                  {idOf(i)}
                </Typography>
              </Box>
            ))}
            {shown.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No audiences available
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {picked.length === 0 ? 'None selected' : `${picked.length} selected`}
            </Typography>
            <Button size="small" variant="text" disabled={picked.length === 0} onClick={() => setPicked([])}>
              Clear all
            </Button>
          </Box>
          <Box component="ul" aria-label="Selected audiences" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {picked.map((id) => (
              <Box
                component="li"
                key={id}
                sx={{ display: 'flex', alignItems: 'center', minHeight: 32 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {byId.get(id)?.name ?? id}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`Remove ${byId.get(id)?.name ?? id}`}
                  onClick={() => toggle(id)}
                >
                  <DvIcon name="close" size={16} />
                </IconButton>
              </Box>
            ))}
          </Box>
          {cfg.suggestions && !suggestionsHidden ? (
            <Box
              data-testid="audience-suggestions"
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  px: 2,
                  py: 1,
                }}
              >
                <Typography variant="subtitle2" component="h3" sx={{ flex: 1, color: 'inherit' }}>
                  Audience suggestions
                </Typography>
                <Box sx={{ color: 'inherit', display: 'inline-flex' }}>
                  <DvHelp label="Help: Audience suggestions">
                    Suggestions are based on the landing page URLs and keywords of your campaign.
                  </DvHelp>
                </Box>
              </Box>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2">
                  For the best results, make sure you&apos;ve entered some landing page URLs or
                  keywords in your{' '}
                  {campaignSettingsHref ? (
                    <a href={campaignSettingsHref} target="_blank" rel="noreferrer">
                      campaign settings
                    </a>
                  ) : (
                    <Box component="span" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
                      campaign settings
                    </Box>
                  )}
                  .
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => setSuggestedOnly(true)}>
                    View suggestions
                  </Button>
                  <Button size="small" variant="text" onClick={() => setSuggestionsHidden(true)}>
                    Dismiss
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>
    </DvSlideOver>
  );
}
