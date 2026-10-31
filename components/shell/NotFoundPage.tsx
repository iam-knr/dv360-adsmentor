// The DV360-style 404 page (routes.md 6.5, design-system 4.2 H): logo, message, "Return to home page". No top bar,
// no nav, no rail. Used by /404, app/not-found.tsx and every in-place 404 (foreign or missing ids). The link goes to the
// person's own landing: a student to the sandbox home, a Super admin to /manage, a visitor to the start page.
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { getSessionUser } from '@/lib/auth/session';
import { homeFor } from '@/lib/scope/home';

export const NOT_FOUND_TEXT =
  "The page you're looking for wasn't found. The link you clicked may be broken or the page may have been removed.";

/** Where "Return to home page" goes. Never throws: any failure falls back to `/`, which routes by role. */
async function homeHref(): Promise<string> {
  try {
    const user = await getSessionUser();
    return user ? await homeFor(user) : '/';
  } catch {
    return '/';
  }
}

export async function NotFoundPage() {
  const home = await homeHref();
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        p: 6,
        textAlign: 'center',
      }}
    >
      <BrandLogo height={48} />
      <Typography variant="h4" component="h1">
        Page not found
      </Typography>
      <Typography variant="body1" sx={{ maxWidth: 560 }}>
        {NOT_FOUND_TEXT}
      </Typography>
      <Link href={home}>Return to home page</Link>
    </Box>
  );
}
