'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export interface ViewAsBannerProps {
  /** Name of the student being viewed. */
  name: string;
  actAs: boolean;
}

/** "Viewing as {student}. Read only." with the Act as student switch and Exit (module 18 2.4). */
export function ViewAsBanner({ name, actAs }: ViewAsBannerProps) {
  const pathname = usePathname();
  const params = useSearchParams();

  const link = (change: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    change(next);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const toggle = link((p) => {
    if (actAs) p.delete('sim_act');
    else p.set('sim_act', '1');
  });
  const exit = link((p) => {
    p.delete('sim_as');
    p.delete('sim_act');
  });

  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        px: 6,
        py: 2,
        bgcolor: actAs ? 'status.warning' : 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      <Typography variant="body2" component="span" sx={{ flex: 1, color: 'inherit' }}>
        {actAs
          ? `Viewing as ${name}. Your changes are saved to their account.`
          : `Viewing as ${name}. Read only.`}
      </Typography>
      <Button
        href={toggle}
        size="small"
        variant="outlined"
        sx={{ color: 'inherit', borderColor: 'currentColor' }}
      >
        {actAs ? 'Stop acting as student' : 'Act as student'}
      </Button>
      <Button
        href={exit}
        size="small"
        variant="outlined"
        sx={{ color: 'inherit', borderColor: 'currentColor' }}
      >
        Exit
      </Button>
    </Box>
  );
}
