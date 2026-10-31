'use client';

// Advertiser Basic details (module 03 2.1 to 2.3, S1 to S3, S9): one long form of section cards, a sticky footer with
// Save, Reset and Schedule for deletion, and two slide-over panels (Ad server and attribution, Third-party services).
// The service validates again on save (ADV-001 to ADV-014, ADV-017, ADV-018) and answers with rule ids and messages.
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
  DvCheckboxGroup,
  DvModal,
  DvPageHeader,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvSlideOver,
  DvTextField,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import {
  cancelDeletionAction,
  scheduleDeletionAction,
  updateAdvertiserAction,
} from '@/lib/settings/actions';
import type { AdvertiserDetails } from '@/lib/settings/advertiser-details';
import {
  AUTHORIZATIONS,
  BUSINESS_NAME_MAX,
  SDF_VERSIONS,
  VENDOR_GROUPS,
} from '@/lib/settings/constants';

type Draft = Omit<AdvertiserDetails, 'id' | 'version'>;

const toDraft = (d: AdvertiserDetails): Draft => {
  const { id: _id, version: _version, ...rest } = d;
  return rest;
};

const AD_SERVER_LABEL = {
  THIRD_PARTY_ONLY: 'Third-party ad servers only',
  CM360_HYBRID: 'Campaign Manager 360',
} as const;

export function AdvertiserDetailsForm({ details }: { details: AdvertiserDetails }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Draft>(() => toDraft(details));
  const [draft, setDraft] = useState<Draft>(saved);
  const [version, setVersion] = useState(details.version);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{
    kind: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'adserver' | 'vendors' | null>(null);
  const [panelDraft, setPanelDraft] = useState<Draft>(draft);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const scheduled = details.status === 'SCHEDULED_FOR_DELETION';
  const canEdit = details.canEdit && !scheduled;
  const canEditAdmin = details.canEditAdmin && !scheduled;
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  useUnsavedGuard(dirty);

  const set = (patch: Partial<Draft>) => {
    setBanner(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const err = (p: string) => errors[p] ?? '';

  const save = async () => {
    setBusy(true);
    const res = await updateAdvertiserAction(
      details.publicId,
      {
        name: draft.name,
        status: draft.status,
        website: draft.website,
        currencyCode: draft.currencyCode,
        timeZone: draft.timeZone,
        sdfVersion: draft.sdfVersion,
        sdfAdminEmail: draft.sdfAdminEmail,
        adServer: draft.adServer,
        attributionFloodlightGroupId: draft.attributionFloodlightGroupId,
        authorizations: draft.authorizations,
        euPoliticalAds: draft.euPoliticalAds,
        demandGenFloodlightOptimization: draft.demandGenFloodlightOptimization,
        businessName: draft.businessName,
        integrationCode: draft.integrationCode,
        iasClientId: draft.iasClientId,
        vendors: draft.selectedVendors,
        rateCards: draft.rateCards,
      },
      { expectedVersion: version, ...(note.trim() ? { note: note.trim() } : {}) },
    );
    setBusy(false);
    if (res.ok) {
      setSaved(draft);
      setVersion((v) => v + 1);
      setErrors({});
      setNote('');
      const warning = res.warnings?.[0]?.message;
      setBanner(
        warning
          ? { kind: 'warning', text: warning }
          : { kind: 'success', text: 'Advertiser details saved.' },
      );
      router.refresh();
      return;
    }
    setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
    setBanner({
      kind: 'error',
      text:
        res.code === 'CONFLICT'
          ? 'This advertiser was changed elsewhere. Reload the page and try again.'
          : res.issues.length === 0
            ? 'The details were not saved.'
            : `Fix the highlighted fields and save again. ${[...new Set(res.issues.map((i) => i.message))].join(' ')}`,
    });
  };

  const openPanel = (which: 'adserver' | 'vendors') => {
    setPanelDraft(draft);
    setPanel(which);
  };
  const applyPanel = () => {
    setDraft(panelDraft);
    setPanel(null);
  };
  const toggleVendor = (key: string, on: boolean) =>
    setPanelDraft((d) => {
      const vendor = d.vendors.find((v) => v.key === key);
      const selectedVendors = on
        ? [...new Set([...d.selectedVendors, key])]
        : d.selectedVendors.filter((k) => k !== key);
      let rateCards = d.rateCards.filter((r) => r.vendorKey !== key);
      if (on && vendor && vendor.feePct !== null)
        rateCards = [...rateCards, { vendorKey: key, selected: true, affirmed: false }];
      return { ...d, selectedVendors, rateCards };
    });

  const eu = draft.euPoliticalAds ?? '';
  const groups = [...new Set(AUTHORIZATIONS.map((a) => a.group))];
  const floodlightLabel =
    draft.floodlightGroups.find((g) => g.id === draft.attributionFloodlightGroupId)?.name ??
    'None selected';

  return (
    <Box sx={{ pb: 12 }}>
      <DvPageHeader title="Basic details" limitedAccess={details.limitedAccess} />
      {scheduled ? (
        <DvBanner kind="warning" level="inline">
          This advertiser is scheduled for deletion
          {details.scheduledDeletionAt
            ? ` on ${new Date(details.scheduledDeletionAt).toLocaleDateString('en-GB')}`
            : ''}
          . Its details are read only.{' '}
          {details.canSchedule ? (
            <Button
              size="small"
              onClick={() =>
                void (async () => {
                  const res = await cancelDeletionAction(details.publicId);
                  if (res.ok) router.refresh();
                })()
              }
            >
              Cancel deletion
            </Button>
          ) : null}
        </DvBanner>
      ) : null}
      {banner ? (
        <DvBanner kind={banner.kind} level="inline">
          {banner.text}
        </DvBanner>
      ) : null}
      <Box sx={{ p: 4, maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <DvSectionCard title="Advertiser" layout="settings">
          <DvTextField
            label="Advertiser name"
            required
            value={draft.name}
            readOnly={!canEdit}
            error={err('name')}
            onChange={(name) => set({ name })}
          />
          <DvSelect
            label="Status"
            value={draft.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'}
            disabled={!canEdit}
            error={err('status')}
            onChange={(status) => set({ status: status as Draft['status'] })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PAUSED', label: 'Paused' },
            ]}
          />
          <DvTextField
            label="Website"
            required
            value={draft.website}
            readOnly={!canEdit}
            error={err('website')}
            help="The advertiser's main website."
            onChange={(website) => set({ website })}
          />
          <DvTextField label="Currency" value={draft.currencyCode} locked />
          <DvTextField label="Timezone" value={draft.timeZone} locked />
          <DvTextField label="Advertiser ID" value={draft.publicId} readOnly />
        </DvSectionCard>

        <DvSectionCard title="Structured Data Files" layout="settings">
          <DvSelect
            label="SDF version"
            value={draft.sdfVersion}
            disabled={!canEdit}
            error={err('sdfVersion')}
            onChange={(sdfVersion) => set({ sdfVersion })}
            options={SDF_VERSIONS.map((v) => ({ value: v.label, label: v.label }))}
          />
          <DvTextField
            label="Administrator email"
            value={draft.sdfAdminEmail ?? ''}
            readOnly={!canEdit}
            error={err('sdfAdminEmail')}
            onChange={(sdfAdminEmail) => set({ sdfAdminEmail })}
          />
        </DvSectionCard>

        <DvSectionCard title="Ad server and attribution" layout="settings">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="body1">Ad server: {AD_SERVER_LABEL[draft.adServer]}</Typography>
              <Typography variant="body1">Attribution settings: {floodlightLabel}</Typography>
            </Box>
            <IconButton
              aria-label="Edit ad server and attribution"
              onClick={() => openPanel('adserver')}
            >
              <DvIcon name="edit" size={20} />
            </IconButton>
          </Box>
        </DvSectionCard>

        <DvSectionCard title="Authorizations" layout="settings">
          {groups.map((g) => (
            <Box key={g}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {g}
              </Typography>
              {AUTHORIZATIONS.filter((a) => a.group === g).map((a) => (
                <Box key={a.key}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={draft.authorizations[a.key]}
                        disabled={!canEdit}
                        onChange={(e) =>
                          set({
                            authorizations: { ...draft.authorizations, [a.key]: e.target.checked },
                          })
                        }
                      />
                    }
                    label={a.label}
                  />
                  {err(a.key) ? (
                    <Typography variant="caption" color="error" role="alert">
                      {err(a.key)}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Box>
          ))}
        </DvSectionCard>

        <DvSectionCard title="EU political ads" layout="settings">
          <DvRadioGroup
            label="Does this advertiser's advertising contain EU political ads?"
            value={eu}
            disabled={!canEdit}
            error={err('euPoliticalAds')}
            onChange={(v) => set({ euPoliticalAds: v as 'YES' | 'NO' })}
            options={[
              { value: 'YES', label: 'Yes, it contains EU political ads' },
              { value: 'NO', label: "No, it doesn't contain EU political ads" },
            ]}
          />
          <Typography variant="body2" color="text.secondary">
            EU regulation on transparency and targeting of political advertising requires this
            declaration for ads that serve in the European Union.
          </Typography>
        </DvSectionCard>

        <DvSectionCard title="YouTube and Demand Gen" layout="settings">
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.demandGenFloodlightOptimization}
                disabled={!canEdit}
                onChange={(e) => set({ demandGenFloodlightOptimization: e.target.checked })}
              />
            }
            label="Use Floodlight data for conversion optimization on Demand Gen line items."
          />
          <DvBanner kind="info" level="inline">
            Floodlight data lets Demand Gen line items optimize towards your conversions. Turning it
            off affects {details.demandGenLineItems} Demand Gen line item
            {details.demandGenLineItems === 1 ? '' : 's'} of this advertiser.
          </DvBanner>
          <DvTextField
            label="Business name"
            value={draft.businessName ?? ''}
            maxLength={BUSINESS_NAME_MAX}
            readOnly={!canEdit}
            error={err('businessName')}
            onChange={(businessName) => set({ businessName })}
          />
        </DvSectionCard>

        <DvSectionCard
          title="Additional settings"
          layout="settings"
          collapsible
          defaultOpen={false}
        >
          <DvTextField
            label="Integration code"
            value={draft.integrationCode ?? ''}
            readOnly={!canEdit}
            error={err('integrationCode')}
            onChange={(integrationCode) => set({ integrationCode })}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1">
              Third-party services: {draft.selectedVendors.length} selected, IAS client ID{' '}
              {draft.iasClientId}
            </Typography>
            <IconButton aria-label="Edit third-party services" onClick={() => openPanel('vendors')}>
              <DvIcon name="edit" size={20} />
            </IconButton>
          </Box>
        </DvSectionCard>
      </Box>

      <Box
        component="footer"
        sx={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {canEdit ? (
          <>
            <Button variant="contained" disabled={!dirty || busy} onClick={() => void save()}>
              Save
            </Button>
            <Button
              variant="text"
              disabled={!dirty || busy}
              onClick={() => {
                setDraft(saved);
                setErrors({});
                setBanner(null);
              }}
            >
              Reset
            </Button>
            <Box sx={{ width: 320 }}>
              <DvTextField
                ariaLabel="Change note"
                placeholder="Optional: Enter a note about this change"
                value={note}
                onChange={setNote}
              />
            </Box>
          </>
        ) : null}
        <Box sx={{ flex: 1 }} />
        {details.canSchedule && !scheduled ? (
          <Button variant="text" color="error" onClick={() => setConfirmDelete(true)}>
            Schedule for deletion
          </Button>
        ) : null}
      </Box>

      <DvSlideOver
        open={panel === 'adserver'}
        title="Ad server and attribution"
        onCancel={() => setPanel(null)}
        onApply={applyPanel}
        applyDisabled={!canEditAdmin}
      >
        {!canEditAdmin && !scheduled ? (
          <DvBanner kind="info" level="inline">
            Only an Admin can change these settings. You can view them here.
          </DvBanner>
        ) : null}
        <DvSelect
          label="Ad server"
          value={panelDraft.adServer}
          disabled={!canEditAdmin}
          onChange={(adServer) =>
            setPanelDraft({ ...panelDraft, adServer: adServer as Draft['adServer'] })
          }
          options={[
            { value: 'THIRD_PARTY_ONLY', label: AD_SERVER_LABEL.THIRD_PARTY_ONLY },
            { value: 'CM360_HYBRID', label: AD_SERVER_LABEL.CM360_HYBRID },
          ]}
        />
        <DvSelect
          label="Attribution settings"
          value={panelDraft.attributionFloodlightGroupId ?? ''}
          disabled={!canEditAdmin}
          placeholder="Select a Floodlight group"
          onChange={(v) =>
            setPanelDraft({ ...panelDraft, attributionFloodlightGroupId: v || null })
          }
          options={panelDraft.floodlightGroups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </DvSlideOver>

      <DvSlideOver
        open={panel === 'vendors'}
        title="Third-party services"
        width="wide"
        onCancel={() => setPanel(null)}
        onApply={applyPanel}
        applyDisabled={!canEditAdmin}
      >
        {!canEditAdmin && !scheduled ? (
          <DvBanner kind="info" level="inline">
            Only an Admin can change these settings. You can view them here.
          </DvBanner>
        ) : null}
        <DvTextField
          label="Integral Ad Science client ID"
          type="number"
          value={String(panelDraft.iasClientId)}
          readOnly={!canEditAdmin}
          error={err('iasClientId')}
          onChange={(v) => setPanelDraft({ ...panelDraft, iasClientId: Number(v) || 0 })}
        />
        {VENDOR_GROUPS.map((g) => {
          const vendors = panelDraft.vendors.filter((v) => v.group === g.group);
          if (vendors.length === 0) return null;
          return (
            <DvCheckboxGroup
              key={g.group}
              label={g.title}
              disabled={!canEditAdmin}
              values={panelDraft.selectedVendors.filter((k) => vendors.some((v) => v.key === k))}
              onChange={(values) => {
                for (const v of vendors) {
                  const on = values.includes(v.key);
                  if (on !== panelDraft.selectedVendors.includes(v.key)) toggleVendor(v.key, on);
                }
              }}
              options={vendors.map((v) => ({
                value: v.key,
                label: v.feePct === null ? v.name : `${v.name} (rate ${v.feePct}%)`,
              }))}
            />
          );
        })}
        {panelDraft.rateCards.map((r, i) => {
          const vendor = panelDraft.vendors.find((v) => v.key === r.vendorKey);
          return (
            <Box key={r.vendorKey}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={r.affirmed}
                    disabled={!canEditAdmin}
                    onChange={(e) =>
                      setPanelDraft({
                        ...panelDraft,
                        rateCards: panelDraft.rateCards.map((c, j) =>
                          j === i ? { ...c, affirmed: e.target.checked } : c,
                        ),
                      })
                    }
                  />
                }
                label={`I affirm with the rate below and have read the ${vendor?.name ?? r.vendorKey} Terms and Conditions`}
              />
              {err(`rateCards[${i}]`) ? (
                <Typography variant="caption" color="error" role="alert">
                  {err(`rateCards[${i}]`)}
                </Typography>
              ) : null}
            </Box>
          );
        })}
      </DvSlideOver>

      <DvModal
        open={confirmDelete}
        title="Schedule for deletion"
        onClose={() => setConfirmDelete(false)}
        secondary={{ label: 'Cancel', onClick: () => setConfirmDelete(false) }}
        primary={{
          label: 'Schedule for deletion',
          tone: 'danger',
          onClick: () =>
            void (async () => {
              const res = await scheduleDeletionAction(details.publicId);
              setConfirmDelete(false);
              if (res.ok) router.refresh();
              else
                setBanner({ kind: 'error', text: res.issues[0]?.message ?? 'Could not schedule.' });
            })(),
        }}
      >
        <Typography>
          This advertiser and everything in it will be deleted in 7 days. You can cancel the
          deletion until then.
        </Typography>
      </DvModal>
    </Box>
  );
}
