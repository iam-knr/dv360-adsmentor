'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvSlideOver } from '@/components/dv/DvSlideOver';
import { DvTooltip } from '@/components/dv/DvTooltip';
import {
  CARD_LABEL,
  CRITERIA_OF,
  defaultCriteria,
  hasRow,
  menuFor,
  removeDimension,
  rowsOf,
  summarizeTargeting,
  typeLocked,
  type TargetingState,
} from '@/lib/targeting';
import type { MatrixDimension } from '@/lib/validation/constants/targeting-availability';
import { EditorBody, editorError } from './editors/editors';
import type { TargetingCriteria } from '@/lib/targeting/types';

export interface TargetingCardProps {
  lineItemType: string;
  value: TargetingState;
  onChange: (next: TargetingState) => void;
  locked?: string[];
  inherited?: string[];
  readOnly?: boolean;
}

const EDITABLE: MatrixDimension[] = [
  'ENVIRONMENT',
  'POSITION',
  'VIEWABILITY',
  'LANGUAGE',
  'CATEGORIES',
  'BROWSER',
  'DEVICE',
  'CONNECTION_SPEED',
  'CARRIER_ISP',
  'DEMOGRAPHICS',
  'KEYWORDS',
  'KEYWORD_EXCLUSIONS',
  'DAY_TIME',
];

/** Add targeting menu, row summaries and right slide-over editors (module 10 2.1 to 2.3). Editors do not touch the URL (RC-044). */
export function TargetingCard({
  lineItemType,
  value,
  onChange,
  locked = [],
  inherited = [],
  readOnly,
}: TargetingCardProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState<MatrixDimension | null>(null);
  const [draft, setDraft] = useState<TargetingCriteria>({});

  const state = value.lineItemType === lineItemType ? value : { ...value, lineItemType };
  const rows = rowsOf(state);
  const lockedDims = useMemo(
    () => new Set<string>([...typeLocked(lineItemType), ...locked, ...(value.locked ?? [])]),
    [lineItemType, locked, value.locked],
  );
  const inheritedDims = new Set<string>([...inherited, ...(value.inherited ?? [])]);
  const menu = menuFor(lineItemType);

  const openEditor = (dim: MatrixDimension) => {
    const key = CRITERIA_OF[dim];
    setDraft(structuredClone(state.criteria));
    setOpen(dim);
    setAnchor(null);
    return key;
  };
  const add = (dim: MatrixDimension) => {
    if (hasRow(state, dim)) return openEditor(dim);
    const next = {
      ...state,
      criteria: { ...state.criteria, ...defaultCriteria(dim, lineItemType) },
    };
    onChange(next);
    setDraft(structuredClone(next.criteria));
    setOpen(dim);
    setAnchor(null);
  };
  const close = () => setOpen(null);
  const apply = () => {
    if (open && !editorError(open, draft)) onChange({ ...state, criteria: draft });
    close();
  };
  const err = open ? editorError(open, draft) : null;

  return (
    <Box data-testid="targeting-card" sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 1 }}>
        <Typography variant="h3" component="h3" sx={{ flex: 1 }}>
          Targeting
        </Typography>
        <Button
          variant="outlined"
          disabled={readOnly}
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-haspopup="menu"
        >
          Add targeting
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          {menu.flatMap((g) => [
            ...(g.group
              ? [
                  <MenuItem
                    key={`h-${g.group}`}
                    disabled
                    dense
                    sx={{ opacity: 1, fontWeight: 500 }}
                  >
                    {g.group}
                  </MenuItem>,
                ]
              : []),
            ...g.items.map((d) => (
              <MenuItem
                key={d}
                onClick={() => add(d)}
                sx={{ justifyContent: 'space-between', gap: 3 }}
              >
                {CARD_LABEL[d] ?? d}
                {hasRow(state, d) ? (
                  <Typography variant="caption" color="text.secondary">
                    Added
                  </Typography>
                ) : null}
              </MenuItem>
            )),
          ])}
        </Menu>
      </Box>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {rows.map((dim) => {
          const isLocked = lockedDims.has(dim) || lockedDims.has(CARD_LABEL[dim] ?? '');
          const isInherited = inheritedDims.has(dim);
          const editable = EDITABLE.includes(dim);
          return (
            <Box
              component="li"
              key={dim}
              data-testid={`target-row-${dim}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 2,
                py: 1,
                borderTop: 1,
                borderColor: 'divider',
                gap: 1,
              }}
            >
              <Typography sx={{ width: 180 }} variant="subtitle2">
                {CARD_LABEL[dim] ?? dim}
              </Typography>
              <Typography sx={{ flex: 1 }} variant="body2" color="text.secondary">
                {summarizeTargeting(dim, state.criteria) ?? ''}
              </Typography>
              {isInherited ? (
                <DvTooltip title="Inherited from a template or the partner">
                  <span aria-label="Inherited">
                    <DvIcon name="link" />
                  </span>
                </DvTooltip>
              ) : null}
              {editable ? (
                <IconButton
                  size="small"
                  aria-label={`${readOnly ? 'View' : 'Edit'} ${CARD_LABEL[dim] ?? dim}`}
                  onClick={() => openEditor(dim)}
                >
                  <DvIcon name="edit" />
                </IconButton>
              ) : null}
              {isLocked ? (
                <DvTooltip title="This targeting is required and can't be removed">
                  <span aria-label="Locked">
                    <DvIcon name="lock" />
                  </span>
                </DvTooltip>
              ) : !readOnly ? (
                <IconButton
                  size="small"
                  aria-label={`Remove ${CARD_LABEL[dim] ?? dim}`}
                  onClick={() => onChange(removeDimension(state, dim))}
                >
                  <DvIcon name="delete" />
                </IconButton>
              ) : null}
            </Box>
          );
        })}
        {rows.length === 0 ? (
          <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">
            No targeting added
          </Typography>
        ) : null}
      </Box>
      {open ? (
        <DvSlideOver
          open
          title={CARD_LABEL[open] ?? open}
          dirty={JSON.stringify(draft) !== JSON.stringify(state.criteria)}
          onCancel={close}
          onApply={readOnly || err ? undefined : apply}
          onDelete={
            readOnly || lockedDims.has(open)
              ? undefined
              : () => {
                  onChange(removeDimension(state, open));
                  close();
                }
          }
        >
          <EditorBody
            dim={open}
            criteria={draft}
            lineItemType={lineItemType}
            readOnly={readOnly}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
        </DvSlideOver>
      ) : null}
    </Box>
  );
}
