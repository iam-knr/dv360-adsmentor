'use client';

// New instant deal (module 13 S5, frame F): seller cards, then name, commitment, targeting rows, advertiser access
// and the forecast card. Accept needs the forecast of the same payload (INV-006).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvPickerDialog,
  DvSectionCard,
  DvStatusChip,
  DvTextField,
  useToast,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { acceptInstantDealAction, requestInstantForecastAction } from '@/lib/inventory/actions';
import type { InstantContext } from '@/lib/inventory/instant';
import { FORMAT_LABEL } from '@/lib/inventory/format-compat';
import { inventoryPath } from '@/lib/inventory/paths';
import type { InstantDealForecastView, SellerCard } from '@/lib/inventory/types';

const DEFAULT_ROWS = ['Country & Region', 'Format', 'Verticals'];
const money = (n: number, code: string) =>
  `${code === 'INR' ? '₹' : `${code} `}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (n: number) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 2 }).format(n);

export function InstantDealForm({
  partnerId,
  advertiserId,
  ctx,
}: {
  partnerId: string;
  advertiserId: string;
  ctx: InstantContext;
}) {
  const router = useRouter();
  const toast = useToast();
  const [sellerId, setSellerId] = useState('');
  const [name, setName] = useState('');
  const [targeting, setTargeting] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<string[]>(DEFAULT_ROWS);
  const [access, setAccess] = useState<Set<string>>(new Set([ctx.currentAdvertiserId]));
  const [edit, setEdit] = useState<string | null>(null);
  const [forecast, setForecast] = useState<InstantDealForecastView | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const seller: SellerCard | undefined = ctx.sellers.find((s) => s.id === sellerId);
  const dims = useMemo(() => Object.keys(seller?.options ?? {}), [seller]);

  const payload = () => ({ sellerId, name, targeting, advertiserIds: [...access] });
  // any change to the payload invalidates the forecast and its token
  const touch = () => {
    setForecast(null);
    setErrors({});
  };
  const fail = (issues: { path: string; message: string }[]) =>
    setErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));

  const request = async () => {
    setBusy(true);
    const res = await requestInstantForecastAction(advertiserId, payload());
    setBusy(false);
    if (!res.ok) return fail(res.issues);
    setErrors({});
    setForecast(res.data);
  };

  const accept = async () => {
    setBusy(true);
    const res = await acceptInstantDealAction(advertiserId, {
      ...payload(),
      forecastToken: forecast?.forecastToken ?? null,
    });
    setBusy(false);
    if (!res.ok) return fail(res.issues);
    toast.show({ message: `${name.trim()} was created` });
    router.push(inventoryPath({ partnerId, advertiserId }));
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' },
        gap: 3,
        p: 4,
        maxWidth: 1200,
        mx: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DvSectionCard
          title="Create an instant deal"
          description="Each publisher or exchange offers unique targeting signals. Pick one to start."
        >
          <Box
            role="radiogroup"
            aria-label="Publisher or exchange"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 2,
            }}
          >
            {ctx.sellers.map((s) => (
              <Box
                key={s.id}
                role="radio"
                aria-checked={s.id === sellerId}
                aria-label={s.name}
                tabIndex={0}
                data-testid="seller-card"
                onClick={() => {
                  setSellerId(s.id);
                  setTargeting({});
                  touch();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSellerId(s.id);
                    setTargeting({});
                    touch();
                  }
                }}
                sx={{
                  border: '1px solid',
                  borderColor: s.id === sellerId ? 'primary.main' : 'divider',
                  borderWidth: s.id === sellerId ? 2 : 1,
                  borderRadius: 2,
                  p: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Typography fontWeight={500}>{s.name}</Typography>
                <Box>
                  <DvStatusChip
                    kind="new"
                    label={s.kind === 'PUBLISHER' ? 'Publisher' : 'Exchange'}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {FORMAT_LABEL[s.format]} inventory, floor {money(s.floorCpm, s.currencyCode)} CPM
                </Typography>
              </Box>
            ))}
          </Box>
          {errors.sellerId ? (
            <Typography role="alert" color="error" variant="caption">
              {errors.sellerId}
            </Typography>
          ) : null}
        </DvSectionCard>

        {seller ? (
          <>
            <DvSectionCard title="Instant deal name" layout="stacked">
              <DvTextField
                label="Instant deal name"
                value={name}
                maxLength={200}
                required
                error={errors.name}
                onChange={(v) => {
                  setName(v);
                  touch();
                }}
              />
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Commitment</Typography>
                <Typography variant="body2">
                  Non-guaranteed. You receive potential inventory; nothing is reserved.
                </Typography>
              </Box>
            </DvSectionCard>
            <DvSectionCard
              title="Targeting"
              description="At least 1 targeting setting is required"
              layout="stacked"
            >
              {rows
                .filter((d) => dims.includes(d))
                .map((d) => (
                  <Box
                    key={d}
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.5 }}
                    data-testid="targeting-row"
                  >
                    <Typography sx={{ width: 180 }}>{d}</Typography>
                    <Typography
                      sx={{ flex: 1 }}
                      color={targeting[d]?.length ? 'text.primary' : 'text.secondary'}
                    >
                      {targeting[d]?.length ? targeting[d].join(', ') : 'All values'}
                    </Typography>
                    <IconButton aria-label={`Edit ${d}`} onClick={() => setEdit(d)}>
                      <DvIcon name="edit" size={18} />
                    </IconButton>
                  </Box>
                ))}
              {dims.filter((d) => !rows.includes(d)).length > 0 ? (
                <Button onClick={() => setRows(dims)} startIcon={<DvIcon name="add" size={18} />}>
                  Add more targeting
                </Button>
              ) : null}
              {errors.targeting ? (
                <Typography role="alert" color="error" variant="caption" display="block">
                  {errors.targeting}
                </Typography>
              ) : null}
            </DvSectionCard>
            <DvSectionCard title="Advertiser access" layout="stacked">
              <Box role="group" aria-label="Advertiser access">
                {ctx.advertisers.map((a) => (
                  <FormControlLabel
                    key={a.id}
                    sx={{ display: 'flex' }}
                    control={
                      <Checkbox
                        checked={access.has(a.id)}
                        onChange={(e) => {
                          const next = new Set(access);
                          if (e.target.checked) next.add(a.id);
                          else next.delete(a.id);
                          setAccess(next);
                          touch();
                        }}
                      />
                    }
                    label={a.name}
                  />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {access.size} selected
              </Typography>
              {errors.advertiserIds ? (
                <Typography role="alert" color="error" variant="caption" display="block">
                  {errors.advertiserIds}
                </Typography>
              ) : null}
            </DvSectionCard>
          </>
        ) : null}
        {!seller && (errors.name || errors.targeting) ? (
          <Box role="alert">
            {[errors.name, errors.targeting].filter(Boolean).map((m) => (
              <Typography key={m} color="error" variant="caption" display="block">
                {m}
              </Typography>
            ))}
          </Box>
        ) : null}
      </Box>

      <Box>
        <DvSectionCard title="Instant deal forecast" layout="stacked">
          {forecast ? (
            <Box data-testid="forecast" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                7-day impressions
              </Typography>
              <Typography variant="h5" data-testid="forecast-p50">
                {compact(forecast.impressions7d.p50)}
              </Typography>
              <Typography variant="body2">
                Range {compact(forecast.impressions7d.p10)} to {compact(forecast.impressions7d.p90)}
              </Typography>
              <Typography variant="body2">
                Recommended minimum bid {money(forecast.recommendedMinBid, forecast.currencyCode)}{' '}
                CPM
              </Typography>
              <Typography variant="body2">
                Estimated media cost {money(forecast.estimatedMediaCost, forecast.currencyCode)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Seller floor {money(forecast.floorCpm, forecast.currencyCode)} CPM
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Enter the required deal details to build a forecast. You will be able to accept an
              instant deal after reviewing the forecast.
            </Typography>
          )}
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => void request()} disabled={busy}>
              Request forecast
            </Button>
          </Box>
          {errors.forecast ? (
            <Typography role="alert" color="error" variant="caption" display="block" sx={{ mt: 1 }}>
              {errors.forecast}
            </Typography>
          ) : null}
        </DvSectionCard>
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="contained" onClick={() => void accept()} disabled={busy}>
            Accept
          </Button>
          <Button onClick={() => router.push(inventoryPath({ partnerId, advertiserId }))}>
            Cancel
          </Button>
        </Box>
        {Object.keys(errors).length ? (
          <DvBanner kind="error" level="inline">
            {Object.keys(errors).length === 1
              ? 'Fix the highlighted field to continue.'
              : `${Object.keys(errors).length} problems. Fix them to continue.`}
          </DvBanner>
        ) : null}
      </Box>
      {edit && seller ? (
        <DvPickerDialog
          open
          title={edit}
          items={(seller.options[edit] ?? []).map((v) => ({ id: v, label: v }))}
          value={targeting[edit] ?? []}
          onCancel={() => setEdit(null)}
          onApply={(ids) => {
            setTargeting({ ...targeting, [edit]: ids });
            setEdit(null);
            touch();
          }}
        />
      ) : null}
    </Box>
  );
}
