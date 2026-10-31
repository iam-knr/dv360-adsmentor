'use client';

// New plan wizard (explore 19 section 3, gap p4-08 #6): step 1 "Select channels" (name, location and currency,
// channels), step 2 (name, dates, demographics, optional sub-location). "Next: Add products" saves the plan and opens
// the plan page. Defaults follow the spec (4.2): next calendar month, advertiser currency and country, all people.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvBanner, DvRadioGroup, DvSectionCard, DvSelect, DvTextField } from '@/components/dv';
import { confirmLeave, useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { createPlanAction } from '@/lib/planning/actions';
import {
  AGE_BRACKETS,
  CURRENCY_NAME,
  DEFAULT_DEMOGRAPHICS,
  PLAN_COUNTRIES,
  planCountry,
  type Gender,
  type PlanDemographics,
} from '@/lib/planning/countries';
import { planPagePath, plansListPath } from '@/lib/planning/paths';
import type { NewPlanDefaults } from '@/lib/planning/service';
import type { PlanChannelKey } from '@/lib/planning/types';
import { PlanDateRange } from './PlanDateRange';

const AGE_LOW = [18, 25, 35, 45, 55, 65];
/** Upper edges are the ends of the editor's brackets (24, 34 ... 64, 65+), so wizard and editor store the same values. */
const AGE_HIGH = [24, 34, 44, 54, 64, 65];
const ageLabel = (n: number, upper: boolean) => (upper ? (n >= 65 ? '65+' : String(n)) : String(n));

export function NewPlanWizard({
  partnerId,
  advertiserId,
  defaults,
}: {
  partnerId: string;
  advertiserId: string;
  defaults: NewPlanDefaults;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(defaults.name);
  const [location, setLocation] = useState(defaults.location);
  const [currency, setCurrency] = useState(defaults.currencyCode);
  const [tv, setTv] = useState(false);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [specific, setSpecific] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [genders, setGenders] = useState<Gender[]>(['MALE', 'FEMALE']);
  const [subLocation, setSubLocation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | undefined>();
  const [busy, startSave] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const dirty =
    !leaving &&
    (name !== defaults.name ||
      location !== defaults.location ||
      currency !== defaults.currencyCode ||
      tv ||
      start !== defaults.start ||
      end !== defaults.end ||
      specific ||
      subLocation !== '');
  useUnsavedGuard(dirty);

  const country = planCountry(location);
  const currencies = useMemo(
    () =>
      [...new Set([defaults.currencyCode, ...PLAN_COUNTRIES.map((c) => c.currency)])].map((c) => ({
        value: c,
        label: `${CURRENCY_NAME[c]?.name ?? c} (${c})`,
      })),
    [defaults.currencyCode],
  );
  const channels: PlanChannelKey[] = tv ? ['DIGITAL', 'TV'] : ['DIGITAL'];

  const next = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a value';
    if (!location) e.location = 'Select an option';
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  };

  const demographics: PlanDemographics = specific
    ? {
        genders: genders.length ? genders : ['MALE', 'FEMALE'],
        ageMin,
        ageMax: ageMax >= 65 ? 120 : ageMax,
      }
    : DEFAULT_DEMOGRAPHICS;

  const save = () =>
    startSave(async () => {
      setErrors({});
      setPageError(undefined);
      if (specific && ageMin > ageMax) {
        setErrors({ demographics: 'Choose a valid age range.' });
        return;
      }
      const res = await createPlanAction(advertiserId, {
        name,
        location,
        currencyCode: currency,
        start,
        end,
        demographics,
        channels,
        ...(subLocation.trim() ? { subLocation } : {}),
      });
      if (!res.ok) {
        const byPath = Object.fromEntries(res.issues.map((i) => [i.path, i.message]));
        setErrors(byPath);
        const first = res.issues[0];
        setPageError(
          first && !byPath[first.path.split('.')[0] as string] ? first.message : first?.message,
        );
        // errors on the first step's fields send the user back to that step
        if (byPath.name || byPath.location) setStep(1);
        return;
      }
      setLeaving(true);
      router.push(planPagePath(partnerId, advertiserId, res.data.publicId));
    });

  const cancel = () => confirmLeave(() => router.push(plansListPath(partnerId, advertiserId)));

  return (
    <Box
      data-testid="new-plan-wizard"
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 760, mx: 'auto' }}
    >
      <Typography variant="overline" color="text.secondary" data-testid="wizard-step">
        {step === 1 ? 'Step 1 of 2: Select channels' : 'Step 2 of 2: Plan details'}
      </Typography>
      {pageError ? (
        <DvBanner kind="error" level="inline">
          {pageError}
        </DvBanner>
      ) : null}

      {step === 1 ? (
        <>
          <DvSectionCard title="Plan name" layout="settings">
            <DvTextField
              label="Name"
              value={name}
              maxLength={100}
              required
              error={errors.name}
              onChange={setName}
            />
          </DvSectionCard>
          <DvSectionCard title="Location and currency" layout="settings">
            <Typography variant="body2" color="text.secondary">
              Show your ads to people located in, or who show interest in, a geographic location.
            </Typography>
            <DvSelect
              label="Country/Region"
              value={location}
              searchable
              error={errors.location}
              options={PLAN_COUNTRIES.map((c) => ({
                value: c.code,
                label: c.name,
                secondLine: c.currency,
              }))}
              onChange={setLocation}
            />
            <DvSelect
              label="Currency"
              value={currency}
              options={currencies}
              onChange={setCurrency}
            />
          </DvSectionCard>
          <DvSectionCard title="Channels" layout="settings">
            <FormControlLabel
              control={<Checkbox checked disabled />}
              label="Digital: Display, Video (YouTube, third-party, connected TV) and Audio. Always included in your plan"
            />
            <FormControlLabel
              control={<Checkbox checked={tv} onChange={(e) => setTv(e.target.checked)} />}
              label="Linear TV: compare against digital channels and see the optimal split of your budget"
            />
          </DvSectionCard>
        </>
      ) : (
        <>
          <DvSectionCard title="Plan name" layout="settings">
            <DvTextField
              label="Name"
              value={name}
              maxLength={100}
              required
              error={errors.name}
              onChange={setName}
            />
            <Box
              data-testid="wizard-summary"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
            >
              <Typography variant="body2">
                Channels {channels.map((c) => (c === 'TV' ? 'Linear TV' : 'Digital')).join(', ')} |
                Location and currency {country?.name ?? location} | {currency}
              </Typography>
              <Button size="small" onClick={() => setStep(1)}>
                Edit
              </Button>
            </Box>
          </DvSectionCard>
          <DvSectionCard title="Dates" layout="settings">
            <PlanDateRange
              label="Dates"
              start={start}
              end={end}
              today={defaults.simToday}
              error={errors['dates.start'] ?? errors['dates.end']}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
          </DvSectionCard>
          <DvSectionCard title="Demographics" layout="settings">
            <DvRadioGroup
              label="On-target demographics"
              value={specific ? 'SPECIFIC' : 'ALL'}
              onChange={(v) => setSpecific(v === 'SPECIFIC')}
              options={[
                { value: 'ALL', label: 'All people' },
                { value: 'SPECIFIC', label: 'Specific age and gender' },
              ]}
            />
            {specific ? (
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <DvSelect
                  label="Age from"
                  value={String(ageMin)}
                  options={AGE_LOW.map((n) => ({ value: String(n), label: ageLabel(n, false) }))}
                  onChange={(v) => setAgeMin(Number(v))}
                />
                <DvSelect
                  label="Age to"
                  value={String(ageMax)}
                  options={AGE_HIGH.map((n) => ({ value: String(n), label: ageLabel(n, true) }))}
                  onChange={(v) => setAgeMax(Number(v))}
                />
                <Box role="group" aria-label="Gender">
                  {(['FEMALE', 'MALE'] as const).map((g) => (
                    <FormControlLabel
                      key={g}
                      sx={{ display: 'flex' }}
                      control={
                        <Checkbox
                          checked={genders.includes(g)}
                          onChange={() =>
                            setGenders((s) =>
                              s.includes(g) ? s.filter((x) => x !== g) : [...s, g],
                            )
                          }
                        />
                      }
                      label={g === 'FEMALE' ? 'Female' : 'Male'}
                    />
                  ))}
                </Box>
              </Box>
            ) : null}
            {errors.demographics ? (
              <Typography role="alert" variant="caption" color="error">
                {errors.demographics}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {AGE_BRACKETS.length} age brackets from 18 to 65+. Unknown gender is included in All
              people.
            </Typography>
          </DvSectionCard>
          <DvSectionCard title="Sub-location (optional)" layout="settings">
            <DvTextField
              label="Sub-location"
              value={subLocation}
              hint="A region inside the country, kept on the plan for reference."
              maxLength={100}
              onChange={setSubLocation}
            />
          </DvSectionCard>
        </>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={cancel}>Cancel</Button>
        {step === 1 ? (
          <Button variant="contained" onClick={next}>
            Next
          </Button>
        ) : (
          <Button variant="contained" disabled={busy} onClick={save}>
            Next: Add products
          </Button>
        )}
      </Box>
    </Box>
  );
}
