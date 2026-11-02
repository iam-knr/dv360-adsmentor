'use client';

// Field picker (module 16 S2): search, frequently used, categories with counts, incompatible fields greyed.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvTextField, DvTooltip } from '@/components/dv';
import { CATEGORIES } from '@/lib/reporting/catalogue/types';
import type { FieldView } from '@/lib/reporting/service';

export const DRAG_TYPE = 'application/x-report-field';

export function FieldPicker({
  fields,
  selected,
  incompatible,
  disabled,
  showDownloadOnly,
  onToggleDownloadOnly,
  onAdd,
  onCustomData,
}: {
  fields: FieldView[];
  selected: string[];
  incompatible: Record<string, string>;
  disabled?: boolean;
  showDownloadOnly: boolean;
  onToggleDownloadOnly: () => void;
  onAdd: (key: string) => void;
  onCustomData?: () => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set(['Frequently used']));
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const visible = useMemo(
    () => fields.filter((f) => showDownloadOnly || !f.downloadOnly),
    [fields, showDownloadOnly],
  );
  const needle = q.trim().toLowerCase();
  const matches = (f: FieldView) => !needle || f.label.toLowerCase().includes(needle);
  const groups = useMemo(() => {
    const byLabel = (a: FieldView, b: FieldView) => a.label.localeCompare(b.label, 'en');
    const out: { name: string; items: FieldView[]; count: number; all?: boolean }[] = [];
    const freq = visible.filter((f) => f.frequentlyUsed).sort(byLabel);
    out.push({ name: 'Frequently used', items: freq.filter(matches), count: freq.length });
    const cats = [...CATEGORIES].sort((a, b) => a.localeCompare(b, 'en'));
    for (const cat of cats) {
      const all = visible.filter((f) => f.category === cat).sort(byLabel);
      if (all.length) out.push({ name: cat, items: all.filter(matches), count: all.length, all: true });
    }
    return out.filter((g) => !needle || g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, needle]);

  const isOpen = (name: string) => !!needle || open.has(name);
  const toggle = (name: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="field-picker">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <DvTextField
            ariaLabel="Search metrics and dimensions"
            placeholder="Search metrics and dimensions"
            value={q}
            onChange={setQ}
          />
        </Box>
        <IconButton aria-label="Picker options" onClick={(e) => setMenu(e.currentTarget)}>
          <DvIcon name="more_vert" />
        </IconButton>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          <MenuItem
            onClick={() => {
              setOpen(new Set(['Frequently used', ...CATEGORIES]));
              setMenu(null);
            }}
          >
            Expand all
          </MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(new Set());
              setMenu(null);
            }}
          >
            Collapse all
          </MenuItem>
          <MenuItem
            onClick={() => {
              onToggleDownloadOnly();
              setMenu(null);
            }}
          >
            {showDownloadOnly ? 'Hide download-only' : 'Show download-only'}
          </MenuItem>
        </Menu>
      </Box>
      <Box>
        <Button size="small" startIcon={<DvIcon name="add" size={16} />} onClick={onCustomData}>
          Custom data
        </Button>
      </Box>
      <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {groups.map((g, gi) => (
          <Box key={g.name}>
            {g.all && !groups[gi - 1]?.all ? (
              <Typography variant="body2" sx={{ fontWeight: 500, mt: 2, mb: 0.5 }}>
                All data
              </Typography>
            ) : null}
            <ButtonBase
              onClick={() => toggle(g.name)}
              aria-expanded={isOpen(g.name)}
              sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, py: 1, typography: 'body2', textTransform: 'none' }}
            >
              <DvIcon name={isOpen(g.name) ? 'expand_less' : 'expand_more'} size={16} />
              {g.name}
            </ButtonBase>
            {isOpen(g.name)
              ? g.items.map((f) => {
                  const taken = selected.includes(f.key);
                  const blocked = incompatible[f.key];
                  const off = disabled || taken || !!blocked;
                  const row = (
                    <Box
                      key={`${g.name}-${f.key}`}
                      draggable={!off}
                      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, f.key)}
                      data-testid="picker-field"
                      data-field={f.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        pl: 4,
                        py: 0.5,
                        opacity: blocked ? 0.45 : 1,
                        cursor: off ? 'default' : 'grab',
                      }}
                    >
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                          {f.kind === 'DIMENSION' ? 'abc' : '123'}
                        </Box>
                        {f.label}
                        {f.downloadOnly ? ' (download only)' : ''}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`Add ${f.label}`}
                        disabled={off}
                        onClick={() => onAdd(f.key)}
                      >
                        <DvIcon name="add" size={16} />
                      </IconButton>
                    </Box>
                  );
                  return blocked ? (
                    <DvTooltip key={`${g.name}-${f.key}`} title={blocked}>
                      {row}
                    </DvTooltip>
                  ) : (
                    row
                  );
                })
              : null}
          </Box>
        ))}
        {groups.length === 0 ? <Typography variant="body2">No matching fields.</Typography> : null}
      </Box>
    </Box>
  );
}
