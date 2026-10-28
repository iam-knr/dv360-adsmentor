import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export default function HomePage() {
  return (
    <Box component="main" sx={{ p: 4 }}>
      <Typography variant="h4" component="h1">
        DV360 Simulator by Adsmetor
      </Typography>
      <Typography sx={{ mt: 1 }} color="text.secondary">
        Placeholder home page.
      </Typography>
    </Box>
  );
}
