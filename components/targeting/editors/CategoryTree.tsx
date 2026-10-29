'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvTextField } from '@/components/dv/DvTextField';
import { CATEGORY_TREE, flattenCategories, type CategoryNode } from '@/lib/targeting/options';
import type { Sel, TargetMode } from '@/lib/targeting/types';

export interface CategoryTreeProps {
  value: Sel[];
  onChange: (next: Sel[]) => void;
  readOnly?: boolean;
}

/** Search plus a ✓/⊘ tree of categories, expandable to sub-categories (AC-10-02, AC-10-07). A node is in one mode only (TGT-001). */
export function CategoryTree({ value, onChange, readOnly }: CategoryTreeProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? new Set(
            flattenCategories()
              .filter((n) => n.label.toLowerCase().includes(q))
              .map((n) => n.code),
          )
        : null,
    [q],
  );
  const modeOf = (code: string) => value.find((s) => s.id === code)?.mode;
  const set = (node: CategoryNode, mode: TargetMode) => {
    if (readOnly) return;
    const rest = value.filter((s) => s.id !== node.code);
    onChange(
      modeOf(node.code) === mode ? rest : [...rest, { id: node.code, mode, label: node.label }],
    );
  };
  const toggle = (code: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(code)) n.add(code);
      return n;
    });
  /** A node shows when it matches, or when a descendant does. */
  const visible = (n: CategoryNode): boolean =>
    !matches || matches.has(n.code) || (n.children ?? []).some(visible);

  const renderNode = (n: CategoryNode, depth: number): React.ReactNode => {
    if (!visible(n)) return null;
    const kids = n.children ?? [];
    const expanded = open.has(n.code) || (!!matches && kids.some(visible));
    const mode = modeOf(n.code);
    return (
      <Box component="li" key={n.code} sx={{ listStyle: 'none' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', pl: depth * 3 }}>
          {kids.length ? (
            <IconButton
              size="small"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${n.label}`}
              aria-expanded={expanded}
              onClick={() => toggle(n.code)}
            >
              <DvIcon name={expanded ? 'expand_less' : 'expand_more'} />
            </IconButton>
          ) : (
            <Box sx={{ width: 34 }} />
          )}
          <Typography sx={{ flex: 1 }} variant="body1">
            {n.label}
          </Typography>
          <IconButton
            size="small"
            disabled={readOnly}
            aria-label={`Include ${n.label}`}
            aria-pressed={mode === 'INCLUDE'}
            color={mode === 'INCLUDE' ? 'primary' : 'default'}
            onClick={() => set(n, 'INCLUDE')}
          >
            <DvIcon name="check" />
          </IconButton>
          <IconButton
            size="small"
            disabled={readOnly}
            aria-label={`Exclude ${n.label}`}
            aria-pressed={mode === 'EXCLUDE'}
            color={mode === 'EXCLUDE' ? 'error' : 'default'}
            onClick={() => set(n, 'EXCLUDE')}
          >
            <DvIcon name="block" />
          </IconButton>
        </Box>
        {expanded && kids.length ? (
          <Box component="ul" sx={{ m: 0, p: 0 }}>
            {kids.map((k) => renderNode(k, depth + 1))}
          </Box>
        ) : null}
      </Box>
    );
  };

  const count = (m: TargetMode) => value.filter((s) => s.mode === m).length;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DvTextField
        ariaLabel="Search categories"
        placeholder="Search categories"
        value={query}
        onChange={setQuery}
      />
      <Typography variant="body2" color="text.secondary">
        {count('INCLUDE')} included; {count('EXCLUDE')} excluded
      </Typography>
      <Box component="ul" aria-label="Categories" sx={{ m: 0, p: 0 }}>
        {CATEGORY_TREE.map((n) => renderNode(n, 0))}
      </Box>
    </Box>
  );
}
