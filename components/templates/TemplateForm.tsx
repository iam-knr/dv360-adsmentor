'use client';

// New and edit form of a targeting template (module 10 2.7). New: step 1 picks the line item type (six cards), step 2
// is this form. Edit: the same form prefilled, Save / Reset / note and Archive. The targeting card is the shared one.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvFormFooter,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvTextField,
} from '@/components/dv';
import { TargetingCard } from '@/components/targeting';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { advertiserPath } from '@/lib/routes/paths';
import type { TargetingState } from '@/lib/targeting';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { TEMPLATE_TYPES } from '@/lib/validation/rules/template';
import {
  createTemplateAction,
  setTemplateStatusAction,
  updateTemplateAction,
} from '@/lib/templates/actions';
import { INVENTORY_QUALITY_LABEL, type InventoryQualityKey } from '@/lib/templates/constants';

export function TemplateTypeStep({
  partnerId,
  advertiserId,
}: {
  partnerId: string;
  advertiserId: string;
}) {
  const router = useRouter();
  const [type, setType] = useState('');
  const base = advertiserPath(partnerId, advertiserId, 'templates', 'new');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DvRadioGroup
        label="Select a line item type for the template to be applied to"
        variant="cards"
        value={type}
        onChange={setType}
        options={TEMPLATE_TYPES.map((t) => ({ value: t, label: LI_TYPE_LABEL[t] }))}
      />
      <Typography variant="body2" color="text.secondary">
        Targeting templates aren&apos;t available for Digital out-of-home, Mobile app install, Ads
        in mobile apps, YouTube &amp; partners audio and YouTube &amp; partners on CTV line items.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          disabled={!type}
          onClick={() => router.push(`${base}?type=${type.toLowerCase()}`)}
        >
          Continue
        </Button>
        <Button
          variant="outlined"
          onClick={() => router.push(advertiserPath(partnerId, advertiserId, 'templates'))}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

export interface TemplateFormValue {
  name: string;
  description: string;
  inventoryQuality: InventoryQualityKey;
  optimizedTargeting: boolean;
  state: TargetingState;
}

export function TemplateForm({
  partnerId,
  advertiserId,
  type,
  mode,
  initial,
  templateId,
  archived,
  canWrite,
}: {
  partnerId: string;
  advertiserId: string;
  type: LiType;
  mode: 'create' | 'edit';
  initial: TemplateFormValue;
  templateId?: string;
  archived?: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [note, setNote] = useState('');
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(value), [saved, value]);
  useUnsavedGuard(dirty);
  const list = advertiserPath(partnerId, advertiserId, 'templates');
  const set = (patch: Partial<TemplateFormValue>) => {
    setBanner('');
    setValue((v) => ({ ...v, ...patch }));
  };

  const submit = async () => {
    const res =
      mode === 'create'
        ? await createTemplateAction(advertiserId, { type, ...value })
        : await updateTemplateAction(advertiserId, templateId!, value);
    if (res.ok) {
      setSaved(value);
      setErrors({});
      // The guard reads `dirty` on the next render, so leave after the state settles.
      setTimeout(() => router.push(list), 0);
      return;
    }
    setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
    setBanner(
      res.issues.length
        ? 'Fix the highlighted fields and try again.'
        : 'The template was not saved.',
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, pb: 10 }}>
      {banner ? (
        <DvBanner kind="error" level="inline">
          {banner}
        </DvBanner>
      ) : null}
      {archived ? (
        <DvBanner kind="warning" level="inline">
          This template is archived and is not offered when you create line items.
        </DvBanner>
      ) : null}
      <DvSectionCard title="Template details" layout="settings">
        <DvTextField label="Type" value={LI_TYPE_LABEL[type]} locked />
        <DvTextField
          label="Name"
          required
          value={value.name}
          maxLength={240}
          readOnly={!canWrite}
          error={errors.name ?? ''}
          onChange={(name) => set({ name })}
        />
        <DvTextField
          label="Description"
          multiline
          rows={3}
          value={value.description}
          maxLength={600}
          readOnly={!canWrite}
          error={errors.description ?? ''}
          onChange={(description) => set({ description })}
        />
      </DvSectionCard>
      <DvSectionCard title="Inventory source" layout="settings">
        <DvSelect
          label="Quality"
          value={value.inventoryQuality}
          disabled={!canWrite}
          onChange={(v) => set({ inventoryQuality: v as InventoryQualityKey })}
          options={(Object.keys(INVENTORY_QUALITY_LABEL) as InventoryQualityKey[]).map((k) => ({
            value: k,
            label: INVENTORY_QUALITY_LABEL[k],
          }))}
        />
      </DvSectionCard>
      <DvSectionCard title="Targeting" layout="stacked">
        <TargetingCard
          lineItemType={type}
          value={value.state}
          onChange={(state) => set({ state })}
          readOnly={!canWrite}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.optimizedTargeting}
              disabled={!canWrite}
              onChange={(e) => set({ optimizedTargeting: e.target.checked })}
            />
          }
          label="Optimized targeting"
        />
      </DvSectionCard>
      {mode === 'edit' && canWrite ? (
        <Box>
          <Button
            variant="text"
            onClick={() =>
              void (async () => {
                const res = await setTemplateStatusAction(
                  advertiserId,
                  templateId!,
                  archived ? 'ACTIVE' : 'ARCHIVED',
                );
                if (res.ok) router.push(list);
              })()
            }
          >
            {archived ? 'Unarchive' : 'Archive'}
          </Button>
        </Box>
      ) : null}
      {canWrite ? (
        <DvFormFooter
          mode={mode}
          dirty={dirty}
          onPrimary={() => void submit()}
          onSecondary={() => router.push(list)}
          onReset={() => {
            setValue(saved);
            setErrors({});
          }}
          note={note}
          onNoteChange={setNote}
        />
      ) : null}
    </Box>
  );
}
