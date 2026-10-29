'use client';

// "Assign to line items…" for a package of My inventory (module 13 S2). Picks line items the package format fits
// (INV-017 filtered up front) and calls assignInventoryToLineItems.
import { useEffect, useState } from 'react';
import { DvPickerDialog, useToast, type PickerItem } from '@/components/dv';
import { assignInventoryAction, assignableLineItemsAction } from '@/lib/inventory/actions';
import type { Format, LineItemChoice } from '@/lib/inventory/types';

export function AssignPackageDialog({
  advertiserId,
  pkg,
  kind = 'PACKAGE',
  onClose,
}: {
  advertiserId: string;
  pkg: { id: string; name: string; format: Format };
  /** A package of My inventory, or a deal from the deal page. */
  kind?: 'PACKAGE' | 'DEAL';
  onClose: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<LineItemChoice[] | null>(null);
  useEffect(() => {
    void assignableLineItemsAction(advertiserId, pkg.format).then(setItems);
  }, [advertiserId, pkg.format]);
  if (!items) return null;
  const picker: PickerItem[] = items.map((l) => ({ id: l.id, label: l.name, secondLine: `${l.campaignName} › ${l.ioName}` }));
  return (
    <DvPickerDialog
      open
      title={`Assign ${pkg.name} to line items`}
      items={picker}
      value={[]}
      applyLabel="Assign"
      searchPlaceholder="Search line items"
      onCancel={onClose}
      onApply={async (ids) => {
        const res = await assignInventoryAction(advertiserId, {
          lineItemIds: ids,
          items: [{ kind, id: pkg.id, mode: 'INCLUDE' }],
        });
        toast.show(
          res.ok
            ? { message: res.data.assigned ? `Assigned to ${res.data.assigned} line items` : (res.warnings?.[0]?.message ?? 'Nothing to assign') }
            : { kind: 'error', message: res.issues[0]?.message ?? "Couldn't assign it." },
        );
        onClose();
      }}
    />
  );
}
