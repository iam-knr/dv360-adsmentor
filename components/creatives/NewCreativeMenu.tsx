'use client';

// New ▾ menu of the creatives library (module 12 S1): four groups, exact order of explore 08. Items navigate to the
// New creative form with the matching `kind`, open the bulk add dialog, or go to the format gallery.
import { useState } from 'react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { DvIcon } from '@/components/icons';
import { BULK_KINDS, BULK_KIND_LABEL, type BulkCreativeKind } from '@/lib/creatives/bulk-csv';

export interface NewMenuItem {
  id: string;
  label: string;
  /** `?kind=` of the New creative form. */
  kind?: string;
  bulk?: BulkCreativeKind;
  href?: string;
  external?: boolean;
  children?: NewMenuItem[];
}

const THIRD_PARTY = [
  { id: 'tp-audio', label: 'Third-party audio', kind: 'third-party-audio' },
  { id: 'tp-display', label: 'Third-party display', kind: 'third-party-display' },
  { id: 'tp-video', label: 'Third-party video', kind: 'third-party-video' },
];

/** Exact menu of module 12 S1. */
export const NEW_MENU: NewMenuItem[] = [
  { id: 'gallery', label: 'Creative from format gallery', href: 'formats' },
  {
    id: 'upload',
    label: 'Upload',
    children: [
      { id: 'upload-asset', label: 'HTML5 or image', kind: 'upload-image' },
      { id: 'upload-video', label: 'Video file', kind: 'upload-video' },
      { id: 'youtube', label: 'YouTube video', kind: 'youtube-video' },
      { id: 'upload-audio', label: 'Audio file', kind: 'upload-audio' },
    ],
  },
  {
    id: 'bulk',
    label: 'Bulk add creatives',
    children: [
      ...BULK_KINDS.map((b) => ({ id: `bulk-${b}`, label: BULK_KIND_LABEL[b], bulk: b })),
      { id: 'templates', label: 'Download templates', href: 'templates', external: true },
    ],
  },
  { id: 'third-party', label: 'Third party', children: THIRD_PARTY },
];

export function NewCreativeMenu({
  onKind,
  onBulk,
  onHref,
}: {
  onKind: (kind: string) => void;
  onBulk: (kind: BulkCreativeKind) => void;
  onHref: (href: string) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sub, setSub] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const close = () => {
    setSub(null);
    setAnchor(null);
  };
  const run = (item: NewMenuItem) => {
    close();
    if (item.kind) onKind(item.kind);
    else if (item.bulk) onBulk(item.bulk);
    else if (item.href) onHref(item.href);
  };
  return (
    <>
      <Button
        variant="contained"
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<DvIcon name="arrow_drop_down" size={20} />}
      >
        New
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        slotProps={{ list: { 'aria-label': 'New creative' } }}
      >
        {NEW_MENU.map((item) => (
          <MenuItem
            key={item.id}
            aria-haspopup={item.children ? 'menu' : undefined}
            onClick={(e) =>
              item.children ? setSub({ id: item.id, anchor: e.currentTarget }) : run(item)
            }
            onKeyDown={(e) => {
              if (item.children && e.key === 'ArrowRight')
                setSub({ id: item.id, anchor: e.currentTarget });
            }}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 4, minWidth: 240 }}
          >
            {item.label}
            {item.children ? <DvIcon name="chevron_right" size={18} /> : null}
          </MenuItem>
        ))}
      </Menu>
      {NEW_MENU.filter((i) => i.children).map((parent) => (
        <Menu
          key={parent.id}
          anchorEl={sub?.id === parent.id ? sub.anchor : null}
          open={sub?.id === parent.id}
          onClose={() => setSub(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ list: { 'aria-label': parent.label } }}
        >
          {parent.children!.flatMap((item) => [
            ...(item.external ? [<Divider key={`${item.id}-d`} />] : []),
            <MenuItem key={item.id} onClick={() => run(item)} sx={{ gap: 2, minWidth: 220 }}>
              {item.label}
              {item.external ? <DvIcon name="open_in_new" size={16} /> : null}
            </MenuItem>,
          ])}
        </Menu>
      ))}
    </>
  );
}
