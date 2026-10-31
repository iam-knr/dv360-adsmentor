'use client';

// Advertiser configurations (module 02 2.6, S6): six cards with a checkbox, terms where required and a
// "Select Advertisers" picker. One Save at the bottom.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvFormFooter,
  DvModal,
  DvPickerDialog,
  DvSectionCard,
  useToast,
} from '@/components/dv';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { acceptConfigurationTermsAction, saveConfigurationsAction } from '@/lib/settings/actions';
import { CONFIG_CARDS, TERMS_KEYS, TERMS_TEXT, type ConfigKey } from '@/lib/settings/constants';
import type { Configurations } from '@/lib/settings/configurations';
import { CheckRow, errorMap, SettingsPage, type Issue } from './shared';

type Flags = Configurations['flags'];
type FlagDraft = Pick<Flags[ConfigKey], 'enabled' | 'scope' | 'advertiserIds'>;
type Draft = Record<ConfigKey, FlagDraft>;

const draftOf = (f: Flags): Draft =>
  Object.fromEntries(
    CONFIG_CARDS.map((c) => [
      c.key,
      { enabled: f[c.key].enabled, scope: f[c.key].scope, advertiserIds: f[c.key].advertiserIds },
    ]),
  ) as Draft;

const DESCRIPTION: Record<ConfigKey, string> = {
  ENHANCED_AUTOMATION:
    'Uses models to fill gaps in conversion and audience signals when third-party cookies are not available.',
  PRODUCT_IMPROVEMENT:
    'Lets Adsmetor use service data to improve the product. It cannot be changed while Enhanced automation is on.',
  GOOGLE_PARTNER_INVENTORY:
    'Lets YouTube & partners and Demand Gen line items buy Google and partner inventory.',
  YOUTUBE_GUARANTEED_INSTANT_DEALS:
    'Lets advertisers use YouTube guaranteed instant deals. The terms must be accepted first.',
  AUTO_TAGGING:
    'Appends a URL parameter to landing page URLs for YouTube & partners and Demand Gen conversion tracking.',
  ADVANCED_AD_SERVING: 'Accept the advanced creative fees for the advertisers selected.',
};

export function ConfigurationsForm({
  partnerId,
  initial,
}: {
  partnerId: string;
  initial: Configurations;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState<Draft>(() => draftOf(initial.flags));
  const [draft, setDraft] = useState<Draft>(saved);
  const [terms, setTerms] = useState<Record<string, boolean>>(
    Object.fromEntries(CONFIG_CARDS.map((c) => [c.key, initial.flags[c.key].termsAccepted])),
  );
  const [ver, setVer] = useState(initial.version);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null);
  const [picker, setPicker] = useState<ConfigKey | null>(null);
  const [termsFor, setTermsFor] = useState<ConfigKey | null>(null);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  useUnsavedGuard(dirty);
  const ro = !initial.canWrite;
  const patch = (k: ConfigKey, p: Partial<FlagDraft>) =>
    setDraft((d) => ({ ...d, [k]: { ...d[k], ...p } }));
  const nameOf = (id: string) => initial.advertisers.find((a) => a.id === id)?.name ?? id;
  const lockedProductImprovement = draft.ENHANCED_AUTOMATION.enabled;

  const toggle = (k: ConfigKey, v: boolean) => {
    // A flag whose terms were never accepted opens the dialog before it can be turned on.
    if (v && (TERMS_KEYS as readonly string[]).includes(k) && !terms[k]) {
      setTermsFor(k);
      return;
    }
    patch(k, { enabled: v });
  };

  const acceptTerms = async () => {
    const key = termsFor;
    if (!key) return;
    if (terms[key] || ro) {
      setTermsFor(null);
      return;
    }
    const res = await acceptConfigurationTermsAction(partnerId, key);
    if (res.ok) {
      setTerms((t) => ({ ...t, [key]: true }));
      patch(key, { enabled: true });
    } else {
      setBanner({ kind: 'error', text: 'The terms were not accepted.' });
    }
    setTermsFor(null);
  };

  const save = async () => {
    setBanner(null);
    const res = await saveConfigurationsAction(partnerId, draft, {
      expectedVersion: ver,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (res.ok) {
      setSaved(draft);
      setVer(res.data.version);
      setNote('');
      setErrors({});
      toast.show({ kind: 'neutral', message: 'Saved' });
      const warn = (res.warnings ?? []).map((w: Issue) => w.message).join(' ');
      if (warn) setBanner({ kind: 'warning', text: warn });
      return;
    }
    if (res.code === 'CONFLICT')
      setBanner({
        kind: 'error',
        text: 'This partner was changed in another tab or window. Reload the page to see the latest values.',
      });
    else if (res.code === 'FORBIDDEN')
      setBanner({ kind: 'error', text: 'You need read and write access to the partner to save.' });
    else setErrors(errorMap(res.issues));
  };

  return (
    <>
      <SettingsPage title="Advertiser configurations" limited={initial.limitedAccess}>
        {banner ? (
          <DvBanner kind={banner.kind} level="inline">
            {banner.text}
          </DvBanner>
        ) : null}
        {CONFIG_CARDS.map((c) => {
          const f = draft[c.key];
          const readOnly = ro || (c.key === 'PRODUCT_IMPROVEMENT' && lockedProductImprovement);
          const err = errors[`flags.${c.key}`] ?? '';
          return (
            <Box key={c.key} data-testid={`config-${c.key}`}>
              <DvSectionCard title={c.title}>
                {c.recommended ? (
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    Recommended
                  </Typography>
                ) : null}
                <Typography variant="body2">{DESCRIPTION[c.key]}</Typography>
                <CheckRow
                  label={c.checkbox}
                  checked={f.enabled}
                  disabled={readOnly}
                  testId={`flag-${c.key}`}
                  onChange={(v) => toggle(c.key, v)}
                />
                {err ? (
                  <Typography variant="caption" color="error" role="alert">
                    {err}
                  </Typography>
                ) : null}
                {c.terms ? (
                  <Link component="button" type="button" onClick={() => setTermsFor(c.key)}>
                    View terms & conditions
                  </Link>
                ) : null}
                {c.key === 'PRODUCT_IMPROVEMENT' && lockedProductImprovement ? (
                  <Typography variant="caption">
                    This setting can&apos;t be changed while Enhanced automation is on.
                  </Typography>
                ) : null}
                {c.key !== 'PRODUCT_IMPROVEMENT' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2">
                      Enabled advertisers:{' '}
                      {f.scope === 'ALL_ADVERTISERS'
                        ? 'All advertisers'
                        : f.advertiserIds.length
                          ? f.advertiserIds.map(nameOf).join(', ')
                          : 'None selected'}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      disabled={ro}
                      onClick={() => setPicker(c.key)}
                    >
                      Select Advertisers
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      disabled={ro || (f.scope === 'SELECTED' && f.advertiserIds.length === 0)}
                      onClick={() => patch(c.key, { scope: 'SELECTED', advertiserIds: [] })}
                    >
                      Clear
                    </Button>
                  </Box>
                ) : null}
              </DvSectionCard>
            </Box>
          );
        })}
      </SettingsPage>
      {ro ? null : (
        <DvFormFooter
          mode="edit"
          dirty={dirty}
          onPrimary={() => void save()}
          onSecondary={() => undefined}
          onReset={() => {
            setDraft(saved);
            setErrors({});
          }}
          note={note}
          onNoteChange={setNote}
        />
      )}
      {picker ? (
        <DvPickerDialog
          open
          title="Select advertisers"
          items={initial.advertisers.map((a) => ({
            id: a.id,
            label: a.name,
            secondLine: a.publicId,
          }))}
          value={
            draft[picker].scope === 'ALL_ADVERTISERS'
              ? initial.advertisers.map((a) => a.id)
              : draft[picker].advertiserIds
          }
          onCancel={() => setPicker(null)}
          onApply={(ids) => {
            const all = ids.length === initial.advertisers.length && ids.length > 0;
            patch(picker, {
              scope: all ? 'ALL_ADVERTISERS' : 'SELECTED',
              advertiserIds: all ? [] : ids,
            });
            setPicker(null);
          }}
        />
      ) : null}
      <DvModal
        open={termsFor !== null}
        title="Terms & conditions"
        primary={{
          label: terms[termsFor ?? ''] || ro ? 'Close' : 'Accept',
          onClick: () => void acceptTerms(),
        }}
        {...(terms[termsFor ?? ''] || ro
          ? {}
          : { secondary: { label: 'Cancel', onClick: () => setTermsFor(null) } })}
        onClose={() => setTermsFor(null)}
      >
        <Typography variant="body2">{TERMS_TEXT}</Typography>
      </DvModal>
    </>
  );
}
