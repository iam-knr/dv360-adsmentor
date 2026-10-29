'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvCheckboxGroup } from '@/components/dv/DvChoice';
import { DvSelect } from '@/components/dv/DvSelect';
import { VERIFICATION_OPTIONS, VERIFICATION_PROVIDERS } from '@/lib/targeting/verification';
import type { VerificationProvider } from '@/lib/targeting/types';
import type { EditorProps } from '../editors';
import { useTargetingEditorContext } from '../apps-urls/context';
import {
  BRAND_MESSAGES,
  brandError,
  disabledOptions,
  setProvider,
  toggleOption,
  totalCostText,
} from './verification-options';

const NOT_LABELED_NOTE =
  'Sensitive categories and digital content labels move to Advertiser settings › Targeting rules from October 2026. Inventory mode "Not yet labeled" is set at advertiser level only.';

export function BrandSuitabilityEditor({ criteria, onChange, readOnly }: EditorProps) {
  const b = criteria.brandSuitability ?? {
    inventoryMode: 'MAXIMUM' as const,
    thirdParty: { provider: 'NONE' as const, options: [] },
  };
  const ctx = useTargetingEditorContext();
  const symbol = ctx.currencySymbol ?? '₹';
  const [open, setOpen] = useState(true);
  const { provider, options } = b.thirdParty;
  const enabled = ctx.enabledProviders;
  const notEnabled = (p: VerificationProvider) => p !== 'NONE' && !!enabled && !enabled.includes(p);
  const error = brandError(b, enabled);
  const off = disabledOptions(provider, options);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        data-testid="inventory-mode"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <DvIcon name="lock" />
        <Box>
          <Typography variant="subtitle2">Inventory mode</Typography>
          <Typography variant="body2">
            {b.inventoryMode === 'MAXIMUM' ? 'Maximum inventory' : 'Not yet labeled'}
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {NOT_LABELED_NOTE}
      </Typography>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Button
          fullWidth
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}
        >
          <span>Third-party brand suitability — {options.length} items selected</span>
          <span aria-hidden>{open ? '▴' : '▾'}</span>
        </Button>
        {open ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
            <DvSelect
              label="Third-party verification provider"
              value={provider}
              disabled={readOnly}
              onChange={(p) =>
                onChange({ brandSuitability: setProvider(b, p as VerificationProvider) })
              }
              options={VERIFICATION_PROVIDERS.map((p) => ({
                value: p.id,
                label: notEnabled(p.id) ? `${p.label} (not enabled)` : p.label,
              }))}
              {...(notEnabled(provider) ? { error: BRAND_MESSAGES.TGT_092 } : {})}
            />
            {provider !== 'NONE' ? (
              <DvCheckboxGroup
                label="Options"
                readOnly={readOnly}
                values={options}
                onChange={(next) => {
                  const added = next.find((k) => !options.includes(k));
                  const removed = options.find((k) => !next.includes(k));
                  const result = added
                    ? toggleOption(provider, options, added, true)
                    : removed
                      ? toggleOption(provider, options, removed, false)
                      : next;
                  onChange({
                    brandSuitability: { ...b, thirdParty: { provider, options: result } },
                  });
                }}
                options={VERIFICATION_OPTIONS[provider].map((o) => ({
                  value: o.key,
                  label: `${o.label} (~${symbol}${o.cpm.toFixed(2)} CPM)`,
                  disabled: off.includes(o.key),
                  ...(off.includes(o.key)
                    ? { disabledReason: 'Authentic Brand Safety replaces this option.' }
                    : {}),
                }))}
                {...(error === BRAND_MESSAGES.TGT_091 ? { error } : {})}
              />
            ) : null}
            <Typography variant="subtitle2" role="status" data-testid="verification-total">
              {totalCostText(provider, options, symbol)}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
