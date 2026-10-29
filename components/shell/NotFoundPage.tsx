// The DV360-style 404 page (routes.md 6.5, design-system 4.2 H): logo, message, "Return to home page". No top bar,
// no nav, no rail. Used by /404, app/not-found.tsx and every in-place 404 (foreign or missing ids).
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

export const NOT_FOUND_TEXT =
  "The page you're looking for wasn't found. The link you clicked may be broken or the page may have been removed.";

export function NotFoundPage() {
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
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, same file as the app bar */}
      <img
        src="/brand/adsmentor-logo-horizontal.png"
        alt="AdsMentor"
        height={48}
        style={{ height: 48, width: 'auto' }}
      />
      <Typography variant="h4" component="h1">
        Page not found
      </Typography>
      <Typography variant="body1" sx={{ maxWidth: 560 }}>
        {NOT_FOUND_TEXT}
      </Typography>
      <Link href="/">Return to home page</Link>
    </Box>
  );
}
