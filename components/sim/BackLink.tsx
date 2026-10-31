import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { backLabelFor, homeHrefFor } from '@/lib/auth/home-href';
import type { AppRole } from '@/lib/auth/types';

/** "Back to accounts" (Super admin) or "Back to home" (student), for the pages under /sim/me. */
export function BackLink({ role }: { role: AppRole }) {
  return (
    <Typography variant="body2">
      <Link href={homeHrefFor(role)} underline="hover">
        {backLabelFor(role)}
      </Link>
    </Typography>
  );
}
