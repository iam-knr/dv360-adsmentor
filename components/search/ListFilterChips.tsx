'use client';

// Removable chips for the Search filters a list page applied on the server (lib/search/list-filters.ts). The remove
// button is a link to the same URL without the chip's params, so the list state stays shareable (routes.md 6.2).
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { usePathname, useSearchParams } from 'next/navigation';
import { AppLink } from '@/lib/routes/AppLink';
import type { FilterChip } from '@/lib/search/list-filters';
import { DvIcon } from '@/components/icons';

export function ListFilterChips({ chips }: { chips: FilterChip[] }) {
  const pathname = usePathname();
  const search = useSearchParams();
  if (!chips.length) return null;
  const removeHref = (drops: string[]) => {
    const next = new URLSearchParams(search?.toString() ?? '');
    for (const k of drops) next.delete(k);
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  return (
    <Box
      role="list"
      aria-label="Applied filters"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}
    >
      {chips.map((c) => (
        <Chip
          key={c.key}
          role="listitem"
          label={c.label}
          onDelete={() => undefined}
          deleteIcon={
            <AppLink
              href={removeHref(c.drops)}
              aria-label={`Remove filter ${c.label}`}
              style={{ display: 'inline-flex', color: 'inherit' }}
            >
              <DvIcon name="close" size={16} />
            </AppLink>
          }
        />
      ))}
    </Box>
  );
}
