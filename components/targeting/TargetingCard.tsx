import Box from '@mui/material/Box';
import type { TargetingState } from '@/lib/targeting';

export interface TargetingCardProps {
  lineItemType: string;
  value: TargetingState;
  onChange: (next: TargetingState) => void;
  locked?: string[];
  inherited?: string[];
  readOnly?: boolean;
}

/** Stub (P3-07a replaces it). */
export function TargetingCard(_props: TargetingCardProps) {
  return (
    <Box sx={{ p: 2, bgcolor: 'grey.100', color: 'text.secondary', borderRadius: 1 }}>
      Targeting editors are not built yet
    </Box>
  );
}
