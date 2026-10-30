'use client';

// Survey fields shared by the lift study form and the A/B test Brand lift block (module 17 S7): up to three metrics,
// brand and competitors, language, object type and the intended action for Purchase intent.
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvBanner, DvCheckboxGroup, DvRadioGroup, DvSectionCard, DvSelect, DvTextField } from '@/components/dv';
import {
  BRAND_METRIC_LABEL,
  BRAND_METRICS,
  LIFT_LANGUAGES,
  LIFT_OBJECT_TYPES,
  LS_BRAND_MAX,
  LS_MAX_COMPETITORS,
  LS_MAX_METRICS,
} from '@/lib/experiments/constants';
import { EXP_MSG } from '@/lib/experiments/rules';
import { MSG } from '@/lib/validation/messages';
import type { BrandLiftInput } from '@/lib/experiments/types';

export function BrandLiftFields({
  value,
  onChange,
  errors,
  disabled,
  withCards = true,
}: {
  value: BrandLiftInput;
  onChange: (v: BrandLiftInput) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  withCards?: boolean;
}) {
  const set = (p: Partial<BrandLiftInput>) => onChange({ ...value, ...p });
  const full = value.metrics.length >= LS_MAX_METRICS;
  const comps = [...value.competitors];
  while (comps.length < LS_MAX_COMPETITORS) comps.push('');
  const experimental = LIFT_LANGUAGES.filter((l) => l.experimental);

  const metrics = (
    <DvCheckboxGroup
      label="Select up to 3 metrics to measure"
      values={value.metrics}
      disabled={!!disabled}
      onChange={(v) => set({ metrics: v as BrandLiftInput['metrics'] })}
      options={BRAND_METRICS.map((m) => ({
        value: m,
        label: BRAND_METRIC_LABEL[m],
        disabled: full && !value.metrics.includes(m),
      }))}
      {...(errors['brandLift.metrics'] ? { error: errors['brandLift.metrics'] } : {})}
    />
  );
  const survey = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
      <DvTextField
        label="Your brand/product name"
        value={value.brandName}
        maxLength={LS_BRAND_MAX}
        disabled={!!disabled}
        onChange={(v) => set({ brandName: v })}
        {...(errors['brandLift.brandName'] ? { error: errors['brandLift.brandName'] } : {})}
      />
      {comps.map((c, i) => (
        <DvTextField
          key={i}
          label={`Competitor ${i + 1}`}
          value={c}
          maxLength={LS_BRAND_MAX}
          disabled={!!disabled}
          onChange={(v) => set({ competitors: comps.map((x, j) => (j === i ? v : x)) })}
          {...(i === 0 && errors['brandLift.competitors'] ? { error: errors['brandLift.competitors'] } : {})}
        />
      ))}
    </Box>
  );
  const settings = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
      <DvBanner kind="info" level="inline">
        {MSG.LS_LANG_OBJ}
      </DvBanner>
      <DvSelect
        label="Language"
        value={value.language}
        disabled={!!disabled}
        searchable
        onChange={(v) => set({ language: v })}
        options={[
          ...LIFT_LANGUAGES.filter((l) => !l.experimental).map((l) => ({ value: l.value, label: l.label })),
          ...experimental.map((l) => ({ value: l.value, label: l.label, group: 'Experimental' })),
        ]}
      />
      <DvSelect
        label="Object type"
        required
        value={value.objectType ?? ''}
        placeholder="Select an option"
        disabled={!!disabled}
        searchable
        onChange={(v) => set({ objectType: v })}
        options={LIFT_OBJECT_TYPES.map((t) => ({ value: t, label: t }))}
        {...(errors['brandLift.objectType'] ? { error: errors['brandLift.objectType'] } : {})}
      />
      {value.metrics.includes('PURCHASE_INTENT') ? (
        <DvRadioGroup
          label="Intended action"
          required
          value={value.intendedAction ?? ''}
          disabled={!!disabled}
          onChange={(v) => set({ intendedAction: v as BrandLiftInput['intendedAction'] })}
          options={[
            { value: 'BUY', label: 'Buy' },
            { value: 'CHOOSE', label: 'Choose' },
            { value: 'USE', label: 'Use' },
          ]}
          {...(errors['brandLift.intendedAction'] ? { error: errors['brandLift.intendedAction'] } : {})}
        />
      ) : null}
    </Box>
  );
  if (!withCards) return (<>{metrics}{survey}{settings}</>);
  return (
    <>
      <DvSectionCard title="Brand lift" layout="stacked">
        {metrics}
      </DvSectionCard>
      <DvSectionCard title="Survey details" layout="stacked">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your brand/product and up to 3 competitors. The name should match the name used in your ads.
        </Typography>
        {survey}
      </DvSectionCard>
      <DvSectionCard title="Survey settings" layout="stacked">
        {settings}
      </DvSectionCard>
    </>
  );
}

export const emptyBrandLift = (): BrandLiftInput => ({
  metrics: [],
  brandName: '',
  competitors: [],
  language: 'en-US',
  objectType: null,
  intendedAction: null,
});

export { EXP_MSG };
