'use client';

import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import 'material-symbols/outlined.css';
import { ICON_BY_MEANING, type DvIconMeaning, type DvIconName } from './icon-names';

export interface DvIconProps {
  /** A symbol name from section 3, or a semantic meaning such as `navCampaigns`. */
  name: DvIconName | DvIconMeaning;
  /** Pixels. 20 in grids, nav and buttons; 24 in the app bar and rail. */
  size?: number;
  /** Filled variant: only active status dots, selected rail icon and solid severity icons. */
  filled?: boolean;
  /** Theme palette path (for example `status.error`). Default: inherit. */
  color?: string;
  /** Provide for an icon that stands alone. Decorative icons are hidden from assistive tech. */
  label?: string;
  sx?: SxProps<Theme>;
}

function resolve(name: DvIconProps['name']): DvIconName {
  return name in ICON_BY_MEANING ? ICON_BY_MEANING[name as DvIconMeaning] : (name as DvIconName);
}

export function DvIcon({ name, size = 20, filled = false, color, label, sx }: DvIconProps) {
  const symbol = resolve(name);
  return (
    <Box
      component="span"
      className="material-symbols-outlined"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      data-icon={symbol}
      data-filled={filled ? 'true' : undefined}
      sx={[
        {
          fontSize: size,
          width: size,
          height: size,
          overflow: 'hidden',
          fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size >= 24 ? 24 : 20}`,
          color,
          flexShrink: 0,
          userSelect: 'none',
        },
        // MUI's documented pattern for merging a caller's sx; Array.isArray widens it to any.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {symbol}
    </Box>
  );
}
