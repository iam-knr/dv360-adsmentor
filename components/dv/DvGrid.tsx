'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table';
import { DvIcon } from '@/components/icons';
import { colors, sizes } from '@/lib/theme/tokens';
import { DvEmptyState } from './DvEmptyState';
import { EMPTY_CELL, formatCurrency, formatNumber, formatPercent } from './grid-format';
import { DvSkeleton } from './DvLoading';
import { DvStatusDot, type DvStatus } from './DvStatus';
import { DvTooltip } from './DvTooltip';

export interface DvColumn<T> {
  id: string;
  header: string;
  group?: string;
  type?: 'text' | 'currency' | 'number' | 'percent' | 'status' | 'link' | 'custom';
  width?: number;
  sticky?: boolean;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Dotted underline on the header and a tooltip with this text. */
  tooltip?: string;
  /** Value for the built-in renderers. Default: `row[id]`. */
  accessor?: (row: T) => unknown;
  /** Currency symbol, or a function when it varies per row (SGD in an INR partner). */
  currencySymbol?: string | ((row: T) => string);
  cell?: (row: T) => ReactNode;
  total?: (rows: T[]) => ReactNode;
}

export interface DvGridGroup {
  id: string;
  label: string;
  collapsible?: boolean;
}

export type DvAlertSeverity = 'critical' | 'warning';

export interface DvGridProps<T> {
  rows: T[];
  columns: DvColumn<T>[];
  groups?: DvGridGroup[];
  getRowId: (row: T) => string;
  selection?: Set<string>;
  onSelectionChange?: (s: Set<string>) => void;
  sort?: { id: string; dir: 'asc' | 'desc' };
  onSortChange?: (s: DvGridProps<T>['sort']) => void;
  /** 1-based page number. */
  pageSize: number;
  page: number;
  total: number;
  onPageChange: (p: number, size: number) => void;
  pageSizes?: number[];
  sections?: { id: string; label: string; rowIds: string[] }[];
  getChildren?: (row: T) => T[];
  totalRow?: boolean;
  /** Text in the Name column of the total row, for example "Total: Display". */
  totalLabel?: string;
  loading?: boolean;
  /** Banner shown above the grid when loading failed. */
  error?: ReactNode;
  emptyState?: ReactNode;
  /** Icons shown at the right of the sticky link cell on row hover (info, edit). */
  rowActions?: (row: T) => ReactNode;
  /** Alert bell column. Return null for no icon. */
  getAlert?: (row: T) => DvAlertSeverity | null;
  onAlertClick?: (row: T) => void;
  /** Status column with the hover menu (Activate / Pause). */
  getStatus?: (row: T) => DvStatus;
  onStatusChange?: (row: T, next: 'active' | 'paused') => void;
  /** Grey text for archived rows. */
  isArchived?: (row: T) => boolean;
  /** Controlled collapsed column groups. Default: uncontrolled, all expanded. */
  collapsedGroups?: string[];
  onCollapsedGroupsChange?: (ids: string[]) => void;
  /** Max height of the scroll area. Header and total row stick inside it. */
  maxHeight?: number | string;
  ariaLabel: string;
  density?: 'compact';
}

type RenderCol<T> =
  | { kind: 'select' | 'alert' | 'status'; key: string; width: number; sticky: true; left: number }
  | { kind: 'data'; key: string; width: number; sticky: boolean; left: number; col: DvColumn<T> }
  | {
      kind: 'stub';
      key: string;
      width: number;
      sticky: false;
      left: 0;
      group: DvGridGroup;
      count: number;
    };

const NUMERIC: DvColumn<unknown>['type'][] = ['currency', 'number', 'percent'];
const DEFAULT_WIDTH = 120;
const SKELETON_ROWS = 8;
const STUB_WIDTH = 40;

function rawValue<T>(col: DvColumn<T>, row: T): unknown {
  return col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.id];
}

function renderValue<T>(col: DvColumn<T>, row: T): ReactNode {
  if (col.cell) return col.cell(row);
  const v = rawValue(col, row);
  if (v === null || v === undefined || v === '')
    return (
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {EMPTY_CELL}
      </Box>
    );
  switch (col.type) {
    case 'currency': {
      const symbol =
        typeof col.currencySymbol === 'function'
          ? col.currencySymbol(row)
          : (col.currencySymbol ?? '₹');
      return formatCurrency(Number(v), symbol);
    }
    case 'number':
      return formatNumber(Number(v));
    case 'percent':
      return formatPercent(Number(v));
    default:
      return typeof v === 'string'
        ? v
        : typeof v === 'number' || typeof v === 'boolean'
          ? String(v)
          : JSON.stringify(v);
  }
}

/** Name cell: entity icon, link (wraps to 2 lines) and the grey ID below. */
export function DvNameCell({
  name,
  id,
  href,
  onClick,
  icon,
}: {
  name: string;
  id?: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
      {icon}
      <Box sx={{ minWidth: 0 }}>
        <Link
          href={href}
          component={href ? 'a' : 'button'}
          type={href ? undefined : 'button'}
          onClick={onClick}
          sx={{
            font: 'inherit',
            textAlign: 'left',
            p: 0,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            color: 'link',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </Link>
        {id ? (
          <Typography variant="caption" component="div" sx={{ color: colors.idText }}>
            {id}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function SrOnly({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  );
}

export function rangeText(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 of 0';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start} - ${end} of ${total}`;
}

/**
 * Header cells: transparent background like real DV360 (CAM-026). A white gradient image keeps the sticky
 * header opaque while rows scroll underneath, without changing the computed background colour.
 */
const headerBg = {
  backgroundColor: 'transparent',
  backgroundImage: (t: Theme) =>
    `linear-gradient(${t.palette.background.paper}, ${t.palette.background.paper})`,
} as const;

const cellSx = {
  px: 3,
  // 3 px keeps a two line name cell (name + id) at the 40 px row height of real DV360 (CAM-028).
  py: '3px',
  height: sizes.rowHeight,
  borderBottom: '1px solid',
  borderColor: 'divider',
  typography: 'tableCell',
  verticalAlign: 'middle',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
} as const;

/**
 * Data grid on TanStack Table v8 (design-system 2.4): two header rows, collapsible column
 * groups, sticky header and left columns, selection, sort, section rows, tree rows, total row, pager.
 * Sorting and paging are driven by props (server side). Page numbers are 1-based.
 */
export function DvGrid<T>(props: DvGridProps<T>) {
  const {
    rows,
    columns,
    groups = [],
    getRowId,
    selection,
    onSelectionChange,
    sort,
    onSortChange,
    pageSize,
    page,
    total,
    onPageChange,
    pageSizes = [10, 20, 50, 100],
    sections,
    getChildren,
    totalRow,
    totalLabel = 'Total',
    loading,
    error,
    emptyState,
    rowActions,
    getAlert,
    onAlertClick,
    getStatus,
    onStatusChange,
    isArchived,
    collapsedGroups,
    onCollapsedGroupsChange,
    maxHeight,
    ariaLabel,
  } = props;

  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [innerCollapsed, setInnerCollapsed] = useState<string[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [focusCell, setFocusCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [statusMenu, setStatusMenu] = useState<{ row: T; anchor: HTMLElement } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const collapsed = collapsedGroups ?? innerCollapsed;
  const setCollapsed = (ids: string[]) => {
    if (collapsedGroups === undefined) setInnerCollapsed(ids);
    onCollapsedGroupsChange?.(ids);
  };
  const toggleGroup = (id: string) =>
    setCollapsed(collapsed.includes(id) ? collapsed.filter((g) => g !== id) : [...collapsed, id]);

  const selectable = Boolean(selection && onSelectionChange);

  const tsColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        accessorFn: (row: T) => rawValue(c, row),
      })),
    [columns],
  );

  const table = useReactTable<T>({
    data: rows,
    columns: tsColumns,
    getRowId,
    getSubRows: getChildren,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: { expanded },
    onExpandedChange: setExpanded,
    manualSorting: true,
    manualPagination: true,
  });
  const modelRows = table.getRowModel().rows;

  // Columns in render order, with left offsets for the sticky ones and a stub per collapsed group.
  const renderCols = useMemo<RenderCol<T>[]>(() => {
    const out: RenderCol<T>[] = [];
    let left = 0;
    const lead = (kind: 'select' | 'alert' | 'status', width: number) => {
      out.push({ kind, key: kind, width, sticky: true, left });
      left += width;
    };
    if (selectable) lead('select', sizes.selectColumn);
    if (getAlert) lead('alert', sizes.alertColumn);
    if (getStatus) lead('status', sizes.statusColumn);
    const stubbed = new Set<string>();
    for (const col of columns) {
      const group = col.group ? groups.find((g) => g.id === col.group) : undefined;
      if (group && collapsed.includes(group.id)) {
        if (!stubbed.has(group.id)) {
          stubbed.add(group.id);
          out.push({
            kind: 'stub',
            key: `stub-${group.id}`,
            width: STUB_WIDTH,
            sticky: false,
            left: 0,
            group,
            count: columns.filter((c) => c.group === group.id).length,
          });
        }
        continue;
      }
      const width = col.width ?? DEFAULT_WIDTH;
      const sticky = Boolean(col.sticky);
      out.push({ kind: 'data', key: col.id, width, sticky, left: sticky ? left : 0, col });
      if (sticky) left += width;
    }
    return out;
  }, [columns, groups, collapsed, selectable, getAlert, getStatus]);

  const lastSticky = [...renderCols].reverse().find((c) => c.sticky);
  const totalWidth = renderCols.reduce((sum, c) => sum + c.width, 0);

  // Group header row: merge adjacent columns of one group.
  const groupSpans = useMemo(() => {
    const spans: {
      key: string;
      span: number;
      group?: DvGridGroup;
      stub?: boolean;
      sticky: boolean;
      left: number;
    }[] = [];
    for (const c of renderCols) {
      const gid = c.kind === 'data' ? c.col.group : c.kind === 'stub' ? c.group.id : undefined;
      const group = gid ? groups.find((g) => g.id === gid) : undefined;
      const prev = spans[spans.length - 1];
      if (prev && group && prev.group?.id === group.id && !prev.stub && c.kind === 'data') {
        prev.span += 1;
      } else if (!group && prev && !prev.group && c.sticky === prev.sticky && c.kind !== 'stub') {
        prev.span += 1;
      } else {
        spans.push({
          key: c.key,
          span: 1,
          group,
          stub: c.kind === 'stub',
          sticky: c.sticky,
          left: c.left,
        });
      }
    }
    return spans;
  }, [renderCols, groups]);

  // Display items: optional section rows, then rows (children follow their parent).
  const items = useMemo(() => {
    type Item = { type: 'section'; id: string; label: string } | { type: 'row'; row: Row<T> };
    if (!sections?.length) return modelRows.map((row): Item => ({ type: 'row', row }));
    const byRoot = new Map<string, Row<T>[]>();
    let root = '';
    for (const row of modelRows) {
      if (row.depth === 0) root = row.id;
      byRoot.set(root, [...(byRoot.get(root) ?? []), row]);
    }
    const out: Item[] = [];
    const used = new Set<string>();
    for (const s of sections) {
      const mine = rows.map(getRowId).filter((id) => s.rowIds.includes(id));
      if (!mine.length) continue;
      out.push({ type: 'section', id: s.id, label: s.label });
      for (const id of mine) {
        used.add(id);
        for (const row of byRoot.get(id) ?? []) out.push({ type: 'row', row });
      }
    }
    for (const [id, list] of byRoot)
      if (!used.has(id)) for (const row of list) out.push({ type: 'row', row });
    return out;
  }, [modelRows, sections, rows, getRowId]);

  const pageIds = rows.map(getRowId);
  const selectedOnPage = selection ? pageIds.filter((id) => selection.has(id)).length : 0;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  const toggleAll = () => {
    if (!selection || !onSelectionChange) return;
    const next = new Set(selection);
    if (allSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };
  const toggleRow = (id: string) => {
    if (!selection || !onSelectionChange) return;
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const cycleSort = (id: string) => {
    if (!onSortChange) return;
    if (!sort || sort.id !== id) onSortChange({ id, dir: 'asc' });
    else if (sort.dir === 'asc') onSortChange({ id, dir: 'desc' });
    else onSortChange(undefined);
  };

  // Roving tabindex over the cells (arrow keys move, Enter activates the first control).
  const colCount = renderCols.length;
  const onGridKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-r][data-c]');
    if (!cell || cell !== target) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    let nr = r;
    let nc = c;
    const rowExists = (n: number) =>
      Boolean(containerRef.current?.querySelector(`[data-r="${n}"]`));
    const stepRow = (from: number, dir: 1 | -1) => {
      let n = from + dir;
      while (n >= 0 && n <= items.length + 2 && !rowExists(n)) n += dir;
      return rowExists(n) ? n : from;
    };
    switch (e.key) {
      case 'ArrowRight':
        nc = Math.min(colCount - 1, c + 1);
        break;
      case 'ArrowLeft':
        nc = Math.max(0, c - 1);
        break;
      case 'ArrowDown':
        nr = stepRow(r, 1);
        break;
      case 'ArrowUp':
        nr = stepRow(r, -1);
        break;
      case 'Home':
        nc = 0;
        break;
      case 'End':
        nc = colCount - 1;
        break;
      case 'Enter':
      case ' ': {
        const control = cell.querySelector<HTMLElement>('a, button, input[type="checkbox"]');
        if (control && (e.key === 'Enter' || control.matches('input[type="checkbox"]'))) {
          e.preventDefault();
          control.click();
        }
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    setFocusCell({ r: nr, c: nc });
    containerRef.current?.querySelector<HTMLElement>(`[data-r="${nr}"][data-c="${nc}"]`)?.focus();
  };

  const stickyStyle = (c: RenderCol<T>, z: number, bg: string) =>
    c.sticky
      ? {
          position: 'sticky' as const,
          left: c.left,
          zIndex: z,
          bgcolor: bg,
          boxShadow: scrolled && lastSticky?.key === c.key ? 1 : 'none',
          clipPath: scrolled && lastSticky?.key === c.key ? 'inset(0 -8px 0 0)' : undefined,
        }
      : {};

  const tab = (r: number, c: number) => (focusCell.r === r && focusCell.c === c ? 0 : -1);
  const showEmpty = !loading && rows.length === 0;
  const bodyRowOffset = 1; // row 0 holds the column headers

  const renderBodyCell = (
    c: RenderCol<T>,
    row: Row<T>,
    ci: number,
    r: number,
    selected: boolean,
    archived: boolean,
  ) => {
    const original = row.original;
    const bg = selected ? 'surface.selected' : 'background.paper';
    const base = {
      ...cellSx,
      ...stickyStyle(c, 2, bg),
      color: archived ? 'text.secondary' : undefined,
    };
    const common = { 'data-r': r, 'data-c': ci, tabIndex: tab(r, ci), role: 'gridcell' } as const;
    switch (c.kind) {
      case 'select':
        return (
          <Box component="td" key={c.key} {...common} sx={{ ...base, p: 0, textAlign: 'center' }}>
            <Checkbox
              size="small"
              checked={Boolean(selection?.has(row.id))}
              onChange={() => toggleRow(row.id)}
              slotProps={{ input: { 'aria-label': `Select row ${row.id}` } }}
            />
          </Box>
        );
      case 'alert': {
        const sev = getAlert?.(original) ?? null;
        return (
          <Box component="td" key={c.key} {...common} sx={{ ...base, p: 0, textAlign: 'center' }}>
            {sev ? (
              <IconButton
                size="small"
                aria-label={sev === 'critical' ? 'Critical alert' : 'Needs attention'}
                onClick={() => onAlertClick?.(original)}
              >
                <DvIcon
                  name={sev === 'critical' ? 'error' : 'warning'}
                  size={20}
                  filled
                  color={sev === 'critical' ? 'status.error' : 'status.warning'}
                />
              </IconButton>
            ) : null}
          </Box>
        );
      }
      case 'status': {
        const status = getStatus?.(original);
        return (
          <Box
            component="td"
            key={c.key}
            {...common}
            sx={{
              ...base,
              p: 0,
              '&:hover .dv-status-caret, &:focus-within .dv-status-caret': { opacity: 1 },
            }}
          >
            {status ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DvStatusDot status={status} />
                {onStatusChange ? (
                  <IconButton
                    size="small"
                    className="dv-status-caret"
                    aria-label="Change status"
                    aria-haspopup="menu"
                    onClick={(e) => setStatusMenu({ row: original, anchor: e.currentTarget })}
                    sx={{ p: 0, opacity: 0 }}
                  >
                    <DvIcon name="arrow_drop_down" size={20} />
                  </IconButton>
                ) : null}
              </Box>
            ) : null}
          </Box>
        );
      }
      case 'stub':
        return (
          <Box component="td" key={c.key} {...common} sx={{ ...base, p: 0 }} aria-hidden="true" />
        );
      case 'data': {
        const numeric = c.col.align ? c.col.align === 'right' : NUMERIC.includes(c.col.type);
        const isTree = Boolean(getChildren) && c.col.sticky && c.col.type === 'link';
        return (
          <Box
            component="td"
            key={c.key}
            {...common}
            sx={{
              ...base,
              textAlign: numeric ? 'right' : 'left',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: numeric ? 'flex-end' : 'flex-start',
                pl: isTree ? row.depth * 6 : 0,
                borderLeft: isTree && row.depth > 0 ? '1px solid' : undefined,
                borderColor: 'divider',
                ml: isTree && row.depth > 0 ? 3 : 0,
              }}
            >
              {isTree && row.depth === 0 ? (
                row.getCanExpand() ? (
                  <IconButton
                    size="small"
                    aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
                    aria-expanded={row.getIsExpanded()}
                    onClick={row.getToggleExpandedHandler()}
                    sx={{ p: 0 }}
                  >
                    <DvIcon
                      name={row.getIsExpanded() ? 'expand_more' : 'chevron_right'}
                      size={20}
                    />
                  </IconButton>
                ) : (
                  <Box component="span" sx={{ width: 20 }} />
                )
              ) : null}
              <Box sx={{ flex: 1, minWidth: 0 }}>{renderValue(c.col, original)}</Box>
              {c.col.sticky && c.col.type === 'link' && rowActions ? (
                <Box className="dv-row-actions" sx={{ display: 'flex', opacity: 0 }}>
                  {rowActions(original)}
                </Box>
              ) : null}
            </Box>
          </Box>
        );
      }
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {error ? <Box role="alert">{error}</Box> : null}
      <Box
        ref={containerRef}
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
        onKeyDown={onGridKeyDown}
        aria-busy={loading || undefined}
        sx={{ overflow: 'auto', maxHeight, position: 'relative' }}
      >
        <Box
          component="table"
          role={getChildren ? 'treegrid' : 'grid'}
          aria-label={ariaLabel}
          aria-rowcount={total + 2 + (totalRow ? 1 : 0)}
          aria-colcount={colCount}
          sx={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            tableLayout: 'fixed',
            width: totalWidth,
            minWidth: '100%',
          }}
        >
          <colgroup>
            {renderCols.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <Box component="tr" role="row" sx={{ height: sizes.groupHeaderHeight }}>
              {groupSpans.map((s) => (
                <Box
                  component={s.group ? 'th' : 'td'}
                  key={s.key}
                  colSpan={s.span}
                  role={s.group ? 'columnheader' : 'gridcell'}
                  scope={s.group ? 'colgroup' : undefined}
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: (t) => (s.sticky ? t.zIndex.gridCorner : t.zIndex.gridStickyHeader),
                    left: s.sticky ? s.left : undefined,
                    ...headerBg,
                    borderBottom: '1px solid',
                    borderBottomColor: colors.dividerStrong,
                    height: sizes.groupHeaderHeight,
                    px: 3,
                    typography: 'tableHeader',
                    textAlign: 'left',
                    ...(s.group ? { borderLeft: '1px solid', borderLeftColor: 'divider' } : {}),
                  }}
                >
                  {s.group ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: s.stub ? 'center' : 'space-between',
                      }}
                    >
                      {s.stub ? null : <span>{s.group.label}</span>}
                      {s.group.collapsible ? (
                        <IconButton
                          size="small"
                          sx={{ p: 0 }}
                          aria-expanded={!s.stub}
                          aria-label={`${s.stub ? 'Expand' : 'Collapse'} ${s.group.label}`}
                          onClick={() => toggleGroup(s.group!.id)}
                        >
                          <DvIcon name={s.stub ? 'chevron_right' : 'chevron_left'} size={16} />
                          {s.stub ? null : <DvIcon name="chevron_right" size={16} />}
                        </IconButton>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Box>
            <Box component="tr" role="row" sx={{ height: sizes.columnHeaderHeight }}>
              {renderCols.map((c, ci) => {
                const common = { 'data-r': 0, 'data-c': ci, tabIndex: tab(0, ci) } as const;
                const hsx = (t: { zIndex: { gridStickyHeader: number; gridCorner: number } }) => ({
                  position: 'sticky' as const,
                  top: sizes.groupHeaderHeight,
                  zIndex: c.sticky ? t.zIndex.gridCorner : t.zIndex.gridStickyHeader,
                  left: c.sticky ? c.left : undefined,
                });
                if (c.kind === 'select') {
                  return (
                    <Box
                      component="th"
                      key={c.key}
                      role="columnheader"
                      {...common}
                      sx={(t) => ({
                        ...cellSx,
                        ...hsx(t),
                        ...headerBg,
                        p: 0,
                        textAlign: 'center',
                        typography: 'tableHeader',
                      })}
                    >
                      <SrOnly>Select</SrOnly>
                      <Checkbox
                        size="small"
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                        slotProps={{ input: { 'aria-label': 'Select all rows' } }}
                      />
                    </Box>
                  );
                }
                if (c.kind === 'alert') {
                  return (
                    <Box
                      component="th"
                      key={c.key}
                      role="columnheader"
                      {...common}
                      sx={(t) => ({
                        ...cellSx,
                        ...hsx(t),
                        ...headerBg,
                        p: 0,
                        textAlign: 'center',
                      })}
                    >
                      <SrOnly>Alerts</SrOnly>
                      <DvTooltip title="Alerts">
                        <span>
                          <DvIcon
                            name="notifications"
                            size={20}
                            color="text.secondary"
                            label="Alerts"
                          />
                        </span>
                      </DvTooltip>
                    </Box>
                  );
                }
                if (c.kind === 'status') {
                  return (
                    <Box
                      component="th"
                      key={c.key}
                      role="columnheader"
                      {...common}
                      sx={(t) => ({
                        ...cellSx,
                        ...hsx(t),
                        ...headerBg,
                        p: 0,
                        typography: 'tableHeader',
                      })}
                    >
                      <SrOnly>Status</SrOnly>
                    </Box>
                  );
                }
                if (c.kind === 'stub') {
                  return (
                    <Box
                      component="th"
                      key={c.key}
                      role="columnheader"
                      {...common}
                      sx={(t) => ({
                        ...cellSx,
                        ...hsx(t),
                        ...headerBg,
                        p: 0,
                        typography: 'tableHeader',
                      })}
                    >
                      <Box
                        sx={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          whiteSpace: 'nowrap',
                          mx: 'auto',
                          py: 1,
                        }}
                      >
                        {`${c.group.label} (${c.count})`}
                      </Box>
                    </Box>
                  );
                }
                if (c.kind !== 'data') return null;
                const col = c.col;
                const numeric = col.align ? col.align === 'right' : NUMERIC.includes(col.type);
                const sorted = sort && sort.id === col.id ? sort.dir : undefined;
                const title = col.tooltip ? (
                  <DvTooltip title={col.tooltip}>
                    <Box
                      component="span"
                      sx={{ borderBottom: '1px dotted', borderColor: 'text.secondary' }}
                    >
                      {col.header}
                    </Box>
                  </DvTooltip>
                ) : (
                  col.header
                );
                return (
                  <Box
                    component="th"
                    key={c.key}
                    role="columnheader"
                    scope="col"
                    aria-sort={
                      sorted
                        ? sorted === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : col.sortable
                          ? 'none'
                          : undefined
                    }
                    {...common}
                    sx={(t) => ({
                      ...cellSx,
                      ...hsx(t),
                      ...stickyStyle(c, t.zIndex.gridCorner, ''),
                      top: sizes.groupHeaderHeight,
                      ...headerBg,
                      typography: 'tableHeader',
                      textAlign: numeric ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                      '&:hover .dv-sort-icon': { opacity: 1 },
                    })}
                  >
                    {col.sortable ? (
                      <ButtonBase
                        onClick={() => cycleSort(col.id)}
                        tabIndex={-1}
                        sx={{
                          typography: 'tableHeader',
                          gap: 1,
                          flexDirection: numeric ? 'row-reverse' : 'row',
                          width: '100%',
                          justifyContent: numeric ? 'flex-start' : 'flex-start',
                          ml: numeric ? 'auto' : 0,
                        }}
                      >
                        {title}
                        <Box
                          component="span"
                          className="dv-sort-icon"
                          sx={{ display: 'inline-flex', opacity: sorted ? 1 : 0 }}
                        >
                          <DvIcon
                            name={sorted === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                            size={16}
                          />
                        </Box>
                      </ButtonBase>
                    ) : (
                      title
                    )}
                  </Box>
                );
              })}
            </Box>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <Box component="tr" role="row" key={`sk-${i}`} sx={{ height: sizes.rowHeight }}>
                    {renderCols.map((c) => (
                      <Box
                        component="td"
                        role="gridcell"
                        key={c.key}
                        sx={{ ...cellSx, ...stickyStyle(c, 2, 'background.paper') }}
                      >
                        {c.kind === 'stub' ? null : (
                          <DvSkeleton width={c.kind === 'data' ? '70%' : 16} />
                        )}
                      </Box>
                    ))}
                  </Box>
                ))
              : null}
            {!loading
              ? items.map((item, idx) => {
                  if (item.type === 'section') {
                    return (
                      <Box component="tr" role="row" key={`section-${item.id}`} sx={{ height: 32 }}>
                        <Box
                          component="td"
                          role="gridcell"
                          colSpan={colCount}
                          sx={{
                            ...cellSx,
                            py: 0,
                            bgcolor: 'surface.sunken',
                            typography: 'subtitle1',
                          }}
                        >
                          {item.label}
                        </Box>
                      </Box>
                    );
                  }
                  const row = item.row;
                  const r = idx + bodyRowOffset;
                  const selected = Boolean(selection?.has(row.id));
                  const archived = Boolean(isArchived?.(row.original));
                  return (
                    <Box
                      component="tr"
                      role="row"
                      key={row.id}
                      aria-selected={selectable ? selected : undefined}
                      aria-level={getChildren ? row.depth + 1 : undefined}
                      data-selected={selected || undefined}
                      sx={{
                        minHeight: sizes.rowHeight,
                        '& td': { bgcolor: selected ? 'surface.selected' : undefined },
                        '&:hover td': { bgcolor: selected ? 'surface.selected' : 'surface.sunken' },
                        '&:hover .dv-row-actions, &:focus-within .dv-row-actions': { opacity: 1 },
                      }}
                    >
                      {renderCols.map((c, ci) => renderBodyCell(c, row, ci, r, selected, archived))}
                    </Box>
                  );
                })
              : null}
          </tbody>
          {totalRow && !loading && rows.length > 0 ? (
            <tfoot>
              <Box component="tr" role="row" sx={{ height: sizes.rowHeight }}>
                {renderCols.map((c, ci, all) => {
                  const firstStickyData = all.findIndex((x) => x.kind === 'data' && x.sticky);
                  const nameCol =
                    c.kind === 'data' &&
                    c.sticky &&
                    (c.col.type === 'link' || ci === firstStickyData);
                  const content = nameCol
                    ? totalLabel
                    : c.kind === 'data' && c.col.total
                      ? c.col.total(rows)
                      : null;
                  const numeric =
                    c.kind === 'data' &&
                    (c.col.align ? c.col.align === 'right' : NUMERIC.includes(c.col.type));
                  return (
                    <Box
                      component="td"
                      role="gridcell"
                      key={c.key}
                      data-r={items.length + bodyRowOffset}
                      data-c={ci}
                      tabIndex={tab(items.length + bodyRowOffset, ci)}
                      sx={{
                        ...cellSx,
                        ...stickyStyle(c, 2, 'background.paper'),
                        position: 'sticky',
                        bottom: 0,
                        left: c.sticky ? c.left : undefined,
                        zIndex: (t) => (c.sticky ? t.zIndex.gridCorner : t.zIndex.gridStickyHeader),
                        bgcolor: 'background.paper',
                        borderTop: '1px solid',
                        fontWeight: 500,
                        textAlign: numeric ? 'right' : 'left',
                      }}
                    >
                      {content}
                    </Box>
                  );
                })}
              </Box>
            </tfoot>
          ) : null}
        </Box>
        {showEmpty ? <Box>{emptyState ?? <DvEmptyState message="No results." />}</Box> : null}
      </Box>

      <Box
        sx={{
          height: sizes.pagerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          px: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" id="dv-grid-rows-label">
            Show rows:
          </Typography>
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={pageSize}
            onChange={(e) => onPageChange(1, Number(e.target.value))}
            labelId="dv-grid-rows-label"
            IconComponent={() => (
              <DvIcon
                name="arrow_drop_down"
                size={20}
                sx={{ position: 'absolute', right: 0, pointerEvents: 'none' }}
              />
            )}
            sx={{ typography: 'caption', color: 'text.primary', minWidth: 48 }}
          >
            {pageSizes.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Typography
          variant="caption"
          aria-live="polite"
          sx={{ color: 'text.primary', minWidth: 96, textAlign: 'center' }}
        >
          {rangeText(page, pageSize, total)}
        </Typography>
        <Box sx={{ display: 'flex' }}>
          {(
            [
              ['First page', 'first_page', 1],
              ['Previous page', 'chevron_left', page - 1],
              ['Next page', 'chevron_right', page + 1],
              ['Last page', 'last_page', Math.max(1, Math.ceil(total / pageSize))],
            ] as const
          ).map(([label, icon, target]) => {
            const lastPage = Math.max(1, Math.ceil(total / pageSize));
            const disabled = target < 1 || target > lastPage || target === page;
            return (
              <IconButton
                key={label}
                aria-label={label}
                disabled={disabled}
                onClick={() => onPageChange(target, pageSize)}
              >
                <DvIcon name={icon} size={20} />
              </IconButton>
            );
          })}
        </Box>
      </Box>

      <Menu
        anchorEl={statusMenu?.anchor}
        open={Boolean(statusMenu)}
        onClose={() => setStatusMenu(null)}
      >
        {(['active', 'paused'] as const).map((s) => {
          const current = statusMenu && getStatus?.(statusMenu.row) === s;
          return (
            <MenuItem
              key={s}
              disabled={Boolean(current)}
              onClick={() => {
                if (statusMenu) onStatusChange?.(statusMenu.row, s);
                setStatusMenu(null);
              }}
            >
              {s === 'active' ? 'Activate' : 'Pause'}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
