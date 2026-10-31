'use client';

// Create advertiser (module 02 2.2, S2): full-screen form, Create and Cancel in the footer. Empty Create shows
// "Enter a value" and focuses Name; success lands on the new advertiser's campaigns (RT 6.3).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import {
  DvBanner,
  DvFormFooter,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvTextField,
  focusFirstInvalid,
} from '@/components/dv';
import { confirmLeave, useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { advertiserPath, partnerPath } from '@/lib/routes/paths';
import { createAdvertiserAction } from '@/lib/settings/actions';
import { CURRENCIES, INDUSTRIES, NAME_MAX, TIME_ZONES } from '@/lib/settings/constants';
import type { CreateAdvertiserContext } from '@/lib/settings/create-advertiser-context';
import { errorMap } from './shared';

const NONE = '';

export function CreateAdvertiserForm({
  partnerId,
  context,
}: {
  partnerId: string;
  context: CreateAdvertiserContext;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [currency, setCurrency] = useState(context.partnerCurrency);
  const [zone, setZone] = useState(context.partnerTimeZone);
  const [adServer, setAdServer] = useState<'THIRD_PARTY_ONLY' | 'CM360_HYBRID'>('THIRD_PARTY_ONLY');
  const [industry, setIndustry] = useState(NONE);
  const [copyFrom, setCopyFrom] = useState(NONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const dirty = useMemo(
    () => Boolean(name || website || industry || copyFrom || adServer !== 'THIRD_PARTY_ONLY'),
    [name, website, industry, copyFrom, adServer],
  );
  useUnsavedGuard(dirty && !done);

  const currencies = [
    context.partnerCurrency,
    ...CURRENCIES.filter((c) => c !== context.partnerCurrency),
  ];
  const zones = [
    context.partnerTimeZone,
    ...TIME_ZONES.filter((z) => z !== context.partnerTimeZone),
  ];
  const cancel = () => confirmLeave(() => router.push(partnerPath(partnerId, 'advertisers')));

  const create = async () => {
    setSubmitting(true);
    setBanner(null);
    const res = await createAdvertiserAction(partnerId, {
      name,
      website,
      currencyCode: currency,
      timeZone: zone,
      adServer,
      industry: industry || null,
      copyFromAdvertiserId: copyFrom || null,
    });
    if (res.ok) {
      setDone(true);
      router.push(advertiserPath(partnerId, res.data.publicId, 'cs'));
      return;
    }
    setSubmitting(false);
    if (res.code === 'FORBIDDEN')
      setBanner('You need write access to the partner to create an advertiser.');
    else {
      setErrors(errorMap(res.issues));
      requestAnimationFrame(() => focusFirstInvalid());
    }
  };

  const ro = !context.canCreate;
  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, pb: 10 }}>
        {banner ? (
          <DvBanner kind="error" level="inline">
            {banner}
          </DvBanner>
        ) : null}
        {ro ? (
          <DvBanner kind="info" level="inline">
            You have view-only access to this partner, so you cannot create an advertiser.
          </DvBanner>
        ) : null}
        {context.atCap ? (
          <DvBanner kind="warning" level="inline">
            This partner can have up to 50 advertisers.
          </DvBanner>
        ) : null}
        <DvSectionCard title="Basic details" layout="settings">
          <DvTextField
            label="Name"
            required
            value={name}
            maxLength={NAME_MAX}
            disabled={ro}
            error={errors.name ?? ''}
            onChange={setName}
          />
          <DvTextField
            label="Website"
            required
            type="url"
            placeholder="https://www.example.com"
            value={website}
            disabled={ro}
            error={errors.website ?? ''}
            onChange={setWebsite}
          />
          <DvSelect
            label="Currency"
            value={currency}
            disabled={ro}
            error={errors.currencyCode ?? ''}
            hint="The currency cannot be changed after the advertiser is created."
            options={currencies.map((c) => ({ value: c, label: c }))}
            onChange={setCurrency}
          />
          <DvSelect
            label="Time zone"
            value={zone}
            disabled={ro}
            error={errors.timeZone ?? ''}
            hint="The time zone cannot be changed after the advertiser is created."
            options={zones.map((z) => ({ value: z, label: z }))}
            onChange={setZone}
          />
        </DvSectionCard>
        <DvSectionCard title="Ad server and attribution" layout="settings">
          <DvRadioGroup
            label="Ad server"
            value={adServer}
            disabled={ro}
            options={[
              { value: 'THIRD_PARTY_ONLY', label: 'Third-party ad servers only' },
              { value: 'CM360_HYBRID', label: 'Campaign Manager 360' },
            ]}
            onChange={(v) => setAdServer(v as typeof adServer)}
          />
          <DvTextField
            label="Attribution"
            value="A Floodlight group is created for this advertiser"
            locked
          />
          <DvSelect
            label="Industry"
            value={industry}
            disabled={ro}
            placeholder="Optional"
            options={INDUSTRIES.map((i) => ({ value: i.key, label: i.label }))}
            onChange={setIndustry}
          />
          <DvSelect
            label="Copy settings from"
            value={copyFrom}
            disabled={ro}
            placeholder="Optional"
            error={errors.copyFromAdvertiserId ?? ''}
            hint="Copies authorizations, alert preferences, SDF version and third-party configuration. Not entities."
            options={context.advertisers.map((a) => ({
              value: a.id,
              label: a.name,
              secondLine: a.publicId,
            }))}
            onChange={setCopyFrom}
          />
        </DvSectionCard>
      </Box>
      <DvFormFooter
        mode="create"
        dirty={dirty}
        primaryDisabled={ro || submitting}
        onPrimary={() => void create()}
        onSecondary={cancel}
      />
    </>
  );
}
