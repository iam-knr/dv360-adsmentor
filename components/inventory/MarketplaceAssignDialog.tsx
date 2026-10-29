'use client';

// Assign / Bulk assign dialog of the Marketplace (module 13 S6, S7): pick line items, then show what happened.
// Format mismatches come back per line item (INV-017) and nothing is created for them (C8: assigns to line items).
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvModal, DvPickerDialog, type PickerItem } from '@/components/dv';
import {
  assignMarketplaceItemAction,
  assignableLineItemsAction,
  bulkAssignMarketplaceAction,
} from '@/lib/inventory/actions';
import { LINE_ITEM_TYPE_LABEL } from '@/lib/inventory/format-compat';
import type { LineItemChoice } from '@/lib/inventory/types';

interface Result {
  title: string;
  lines: { text: string; error?: boolean }[];
}

export function MarketplaceAssignDialog({
  advertiserId,
  productIds,
  title,
  onClose,
}: {
  advertiserId: string;
  productIds: string[];
  title: string;
  onClose: (changed: boolean) => void;
}) {
  const [items, setItems] = useState<LineItemChoice[] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    void assignableLineItemsAction(advertiserId).then(setItems);
  }, [advertiserId]);

  if (result)
    return (
      <DvModal
        open
        title={result.title}
        size="sm"
        onClose={() => onClose(true)}
        primary={{ label: 'Close', onClick: () => onClose(true) }}
      >
        <Box data-testid="assign-result" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {result.lines.map((l, i) => (
            <Typography key={i} variant="body2" color={l.error ? 'error' : 'text.primary'}>
              {l.text}
            </Typography>
          ))}
        </Box>
      </DvModal>
    );
  if (!items) return null;
  const picker: PickerItem[] = items.map((l) => ({
    id: l.id,
    label: l.name,
    secondLine: `${LINE_ITEM_TYPE_LABEL[l.type as keyof typeof LINE_ITEM_TYPE_LABEL] ?? l.type} · ${l.campaignName} › ${l.ioName}`,
  }));
  const name = new Map(items.map((l) => [l.id, l.name]));
  return (
    <DvPickerDialog
      open
      title={title}
      items={picker}
      value={[]}
      applyLabel="Assign"
      searchPlaceholder="Search line items"
      onCancel={() => onClose(false)}
      onApply={(ids) => {
        void (async () => {
          const lines: Result['lines'] = [];
          if (productIds.length === 1) {
            const res = await assignMarketplaceItemAction(advertiserId, productIds[0] as string, {
              lineItemIds: ids,
            });
            if (res.ok) {
              lines.push({
                text: res.data.assigned
                  ? `Assigned to ${res.data.assigned} line item${res.data.assigned === 1 ? '' : 's'}.`
                  : 'Nothing new was assigned.',
              });
              for (const w of res.warnings ?? []) lines.push({ text: w.message });
            } else for (const i of res.issues) lines.push({ text: i.message, error: true });
          } else {
            const res = await bulkAssignMarketplaceAction(advertiserId, {
              productIds,
              lineItemIds: ids,
            });
            if (res.ok) {
              lines.push({
                text: `${res.data.done} of ${res.data.done + res.data.failed} line items assigned.`,
              });
              for (const e of res.data.errors)
                lines.push({ text: `${name.get(e.id) ?? e.id}: ${e.message}`, error: true });
              for (const w of res.warnings ?? []) lines.push({ text: w.message });
            } else for (const i of res.issues) lines.push({ text: i.message, error: true });
          }
          setResult({ title: 'Assignment result', lines });
        })();
      }}
    />
  );
}
