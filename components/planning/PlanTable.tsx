'use client';

// Plan line item table (module 04 2.2): rows grouped by buying method, columns from the user's saved order.
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { DvEmptyState, DvGrid, type DvColumn } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { PLAN_COLUMNS, normalizePlanColumns } from '@/lib/planning/columns';
import { cellText } from '@/lib/planning/table';
import {
  BUYING_METHODS,
  BUYING_METHOD_LABEL,
  type PlanDto,
  type PlanRowDto,
} from '@/lib/planning/types';

export function PlanTable({
  plan,
  rows,
  columns,
  onOpen,
  emptyMessage,
}: {
  plan: PlanDto;
  rows: PlanRowDto[];
  columns: string[];
  onOpen: (row: PlanRowDto) => void;
  emptyMessage: string;
}) {
  const order = normalizePlanColumns(columns);
  const perRow = plan.forecast?.perRow ?? {};
  const cols: DvColumn<PlanRowDto>[] = order.map((id) => {
    const def = PLAN_COLUMNS.find((c) => c.id === id);
    const text = (r: PlanRowDto) => cellText(id, plan, r, perRow[r.id]);
    return {
      id,
      header: def?.label ?? id,
      width: id === 'name' ? 260 : id === 'targeting' || id === 'avgCost' ? 240 : 150,
      sticky: id === 'name',
      type: 'custom',
      cell:
        id === 'name'
          ? (r) => (
              <ButtonBase
                data-testid="plan-row-open"
                onClick={() => onOpen(r)}
                sx={{ color: 'primary.main', textAlign: 'left', font: 'inherit' }}
              >
                {r.name}
              </ButtonBase>
            )
          : id === 'avgCost'
            ? (r) => (
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  {text(r)}
                  {r.isCpmLocked ? <DvIcon name="lock" size={14} label="CPM locked" /> : null}
                </Box>
              )
            : (r) => text(r),
    };
  });

  const sections = useMemo(
    () =>
      BUYING_METHODS.map((m) => ({
        id: m,
        label: BUYING_METHOD_LABEL[m],
        rowIds: rows.filter((r) => r.buyingMethod === m).map((r) => r.id),
      })).filter((s) => s.rowIds.length),
    [rows],
  );

  return (
    <DvGrid<PlanRowDto>
      ariaLabel="Plan line items"
      rows={rows}
      columns={cols}
      getRowId={(r) => r.id}
      sections={sections}
      page={1}
      pageSize={50}
      total={rows.length}
      onPageChange={() => undefined}
      emptyState={<DvEmptyState variant="inline" message={emptyMessage} />}
    />
  );
}
