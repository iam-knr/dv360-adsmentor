'use client';

// Page banner slot (routes.md 4.5, design-system 4.1): the DV360 banner first (advertiser paused or scheduled for
// deletion), then the simulator banner below it (view-as). None of them can be dismissed.
import Box from '@mui/material/Box';
import { DvBanner } from '@/components/dv';
import { ViewAsBanner } from '@/components/sim/ViewAsBanner';
import { MSG } from '@/lib/validation/messages';
import { usePageScope } from '@/lib/scope/context';
import { useViewer } from './ViewerProvider';

/** ADV-009 text, validation.md 1.2 `ADV_PAUSED_BANNER`. */
export const ADV_PAUSED_BANNER = MSG.ADV_PAUSED_BANNER;
/** [SIM] text for the scheduled for deletion slot (routes.md 4.5 "same slot, own text"). */
export const ADV_DELETION_BANNER =
  'This advertiser is scheduled for deletion. None of its campaigns or deals are serving.';

export function BannerStack() {
  const { scope } = usePageScope();
  const { viewer } = useViewer();
  const adv = scope.advertiser;
  const dvText = adv?.paused
    ? ADV_PAUSED_BANNER
    : adv?.scheduledForDeletion
      ? ADV_DELETION_BANNER
      : null;
  if (!dvText && !viewer.viewAs) return null;
  return (
    <Box
      data-testid="banner-stack"
      sx={{ position: 'sticky', top: 0, zIndex: (t) => t.zIndex.appBar - 1 }}
    >
      {dvText ? (
        <DvBanner kind="warning" level="page">
          {dvText}
        </DvBanner>
      ) : null}
      {viewer.viewAs ? (
        <ViewAsBanner name={viewer.viewAs.name} actAs={viewer.viewAs.actAs} />
      ) : null}
    </Box>
  );
}
