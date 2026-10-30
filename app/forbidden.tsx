import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

// Rendered with HTTP 403 when a page or layout calls forbidden() or a service answers FORBIDDEN (ServiceFailure).
export default function Forbidden() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        p: 6,
        textAlign: 'center',
      }}
    >
      <Typography variant="h5" component="h1">
        You do not have access to this page.
      </Typography>
      <Link href="/">Return to home page</Link>
    </Box>
  );
}
