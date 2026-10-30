'use client';

// Column views (module 11 2.7): the menu, the custom view editor and the visible column list of a grid.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DvModal, DvTextField } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { savePrefsAction } from '@/lib/scope/actions';
import {
  GRID_COLUMNS,
  PREDEFINED,
  PREDEFINED_LABEL,
  customKey,
  predefinedColumns,
  resolveView,
  validateView,
  type CustomView,
  type PredefinedView,
  type ViewGrid,
} from '@/lib/views/columns';

interface Loaded {
  views: CustomView[];
  pinned: string | null;
  pinnedAll?: Record<string, string>;
}

export function useColumnView(
  grid: ViewGrid,
  advertiserId: string,
): { visible: string[]; menu: ReactNode } {
  const { viewer } = useViewer();
  const [data, setData] = useState<Loaded>({ views: [], pinned: null });
  const [active, setActive] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [editor, setEditor] = useState<{ id?: string; name: string; columns: string[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/dv/column-views?grid=${grid}&advertiserId=${encodeURIComponent(advertiserId)}`,
    );
    const json = (await res.json().catch(() => null)) as { data?: Loaded } | null;
    if (json?.data) setData(json.data);
  }, [grid, advertiserId]);
  useEffect(() => {
    void load();
  }, [load]);

  const key = active ?? data.pinned ?? 'performance';
  const visible = useMemo(() => resolveView(grid, key, data.views), [grid, key, data.views]);

  const save = async () => {
    if (!editor) return;
    const problem = validateView(editor.name, editor.columns, data.views, editor.id);
    if (problem) return setError(problem);
    const res = await fetch('/api/dv/column-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grid, advertiserId, ...editor }),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: CustomView;
      issues?: { message: string }[];
    } | null;
    if (!res.ok || !json?.data)
      return setError(json?.issues?.[0]?.message ?? 'Could not save the view.');
    setEditor(null);
    setError(null);
    await load();
    setActive(customKey(json.data.id));
  };

  const pin = async (k: string) => {
    const all = { ...(data.pinnedAll ?? {}), [grid]: k };
    setData((d) => ({ ...d, pinned: k, pinnedAll: all }));
    await savePrefsAction({ pinnedColumnView: all });
  };

  const remove = async (v: CustomView) => {
    await fetch(`/api/dv/column-views?id=${encodeURIComponent(v.id)}`, { method: 'DELETE' });
    if (key === customKey(v.id)) setActive('performance');
    await load();
  };

  const catalog = GRID_COLUMNS[grid];
  const groups = [...new Set(catalog.map((c) => c.group))];

  const menu = (
    <>
      <Button variant="outlined" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        Columns
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <ListSubheader>Predefined views</ListSubheader>
        {PREDEFINED.map((p: PredefinedView) => (
          <MenuItem
            key={p}
            selected={key === p}
            onClick={() => {
              setActive(p);
              setAnchor(null);
            }}
            sx={{ gap: 3, justifyContent: 'space-between' }}
          >
            <span>
              {PREDEFINED_LABEL[p]}
              {key === p ? ' ✓' : ''}
            </span>
            <Button
              size="small"
              aria-label={`Pin ${PREDEFINED_LABEL[p]}`}
              onClick={(e) => {
                e.stopPropagation();
                void pin(p);
              }}
            >
              {data.pinned === p || (!data.pinned && p === 'performance') ? 'Pinned' : 'Pin'}
            </Button>
          </MenuItem>
        ))}
        <Divider component="li" />
        <ListSubheader>Your custom views</ListSubheader>
        {data.views.length === 0 ? <MenuItem disabled>No custom views</MenuItem> : null}
        {data.views.map((v) => (
          <MenuItem
            key={v.id}
            selected={key === customKey(v.id)}
            onClick={() => {
              setActive(customKey(v.id));
              setAnchor(null);
            }}
            sx={{ gap: 2, justifyContent: 'space-between' }}
          >
            <span>
              {v.name}
              {key === customKey(v.id) ? ' ✓' : ''}
            </span>
            <Box>
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void pin(customKey(v.id));
                }}
              >
                {data.pinned === customKey(v.id) ? 'Pinned' : 'Pin'}
              </Button>
              <Button
                size="small"
                disabled={viewer.readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  setAnchor(null);
                  setEditor({ id: v.id, name: v.name, columns: v.columns });
                }}
              >
                Rename
              </Button>
              <Button
                size="small"
                disabled={viewer.readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(v);
                }}
              >
                Delete
              </Button>
            </Box>
          </MenuItem>
        ))}
        <Divider component="li" />
        <MenuItem
          disabled={viewer.readOnly}
          onClick={() => {
            setAnchor(null);
            setError(null);
            setEditor({ name: '', columns: visible });
          }}
        >
          Create custom view from current view
        </MenuItem>
        <MenuItem
          disabled={viewer.readOnly}
          onClick={() => {
            setAnchor(null);
            setError(null);
            setEditor({ name: '', columns: ['name'] });
          }}
        >
          Create new custom view
        </MenuItem>
      </Menu>
      <DvModal
        open={!!editor}
        size="lg"
        title={editor?.id ? 'Edit custom view' : 'Create custom view'}
        primary={{ label: 'Save', onClick: () => void save() }}
        secondary={{ label: 'Cancel', onClick: () => setEditor(null) }}
        onClose={() => setEditor(null)}
        error={error ?? undefined}
      >
        {editor ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <DvTextField
              label="View name"
              value={editor.name}
              onChange={(name) => setEditor({ ...editor, name })}
            />
            <Typography variant="subtitle2">Available columns</Typography>
            {groups.map((g) => (
              <Box key={g} role="group" aria-label={g}>
                <Typography variant="caption">{g}</Typography>
                {catalog
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <FormControlLabel
                      key={c.id}
                      sx={{ display: 'flex' }}
                      control={
                        <Checkbox
                          size="small"
                          checked={editor.columns.includes(c.id)}
                          disabled={c.fixed}
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              columns: e.target.checked
                                ? [...editor.columns, c.id]
                                : editor.columns.filter((x) => x !== c.id),
                            })
                          }
                        />
                      }
                      label={c.label}
                    />
                  ))}
              </Box>
            ))}
            <Typography variant="subtitle2">Selected columns</Typography>
            <Box component="ol" aria-label="Selected columns" sx={{ m: 0, pl: 4 }}>
              {editor.columns.map((id, i) => (
                <li key={id}>
                  {catalog.find((c) => c.id === id)?.label ?? id}{' '}
                  <IconButton
                    size="small"
                    aria-label={`Move ${id} up`}
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...editor.columns];
                      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                      setEditor({ ...editor, columns: next });
                    }}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Move ${id} down`}
                    disabled={i === editor.columns.length - 1}
                    onClick={() => {
                      const next = [...editor.columns];
                      [next[i + 1], next[i]] = [next[i]!, next[i + 1]!];
                      setEditor({ ...editor, columns: next });
                    }}
                  >
                    ↓
                  </IconButton>
                </li>
              ))}
            </Box>
          </Box>
        ) : null}
      </DvModal>
    </>
  );
  return { visible, menu };
}

export { predefinedColumns };

/** Keep the columns of the active view, in the order of the view. The name column is always first. */
export function orderBy<T extends { id: string }>(columns: T[], visible: readonly string[]): T[] {
  const idx = (id: string) => (id === 'name' ? -1 : visible.indexOf(id));
  return columns
    .filter((c) => c.id === 'name' || visible.includes(c.id))
    .sort((a, b) => idx(a.id) - idx(b.id));
}
