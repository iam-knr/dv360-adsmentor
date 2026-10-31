'use client';

// Advertiser Targeting rules (module 03 2.4, S4): info banner and a summary card with four rows. Read only here:
// DV360's own rows are not clickable for Limited Access either, and the shared locked-rule editors are a gap.
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvBanner, DvPageHeader } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import type { TargetingRules } from '@/lib/settings/targeting-rules';

export function AdvertiserTargetingRules({ rules }: { rules: TargetingRules }) {
  return (
    <>
      <DvPageHeader title="Targeting rules" limitedAccess={rules.limitedAccess} />
      <Box sx={{ p: 4, maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DvBanner kind="info" level="inline">
          Targeting rules are applied to all new and existing targeting templates and line items.
        </DvBanner>
        <Box
          component="section"
          aria-label="Targeting rules"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            bgcolor: 'background.paper',
          }}
        >
          {rules.rows.map((r, i) => (
            <Box
              key={r.key}
              data-testid={`rule-${r.key}`}
              sx={{
                display: 'flex',
                gap: 4,
                p: 4,
                borderTop: i === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="cardTitle" component="h3" sx={{ width: 240 }}>
                {r.title}
              </Typography>
              <Box sx={{ flex: 1 }}>
                {r.locked ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <DvIcon name="lock" size={18} />
                    <Typography variant="body2">
                      Locked for campaigns, insertion orders, and line items.
                    </Typography>
                  </Box>
                ) : null}
                {r.lines.map((l) => (
                  <Typography key={l} variant="body1">
                    {l}
                  </Typography>
                ))}
                {r.key === 'BRAND_SUITABILITY' ? (
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <DvBanner kind="info" level="inline">
                      Sensitive categories exclusions will become unavailable in October 2026. Use
                      Brand suitability controls instead.
                    </DvBanner>
                    <DvBanner kind="info" level="inline">
                      Digital content labels will become unavailable in October 2026. Use Brand
                      suitability controls instead.
                    </DvBanner>
                  </Box>
                ) : null}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}
