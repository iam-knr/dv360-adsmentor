'use client';

// Partner Basic details (module 02 2.3, S3) with the Exchanges slide-over (2.4, S4). Save is disabled until a change;
// the exchange draft is saved with the page (RT 5.4 draft-bound rule).
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvFormFooter,
  DvModal,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvSlideOver,
  DvTabs,
  DvTextField,
  DvTooltip,
  focusFirstInvalid,
  useToast,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { acceptAppMediationFeesAction, updatePartnerAction } from '@/lib/settings/actions';
import {
  CONTACT_ROLES,
  NAME_MAX,
  PARTNER_STATUS_OPTIONS,
  SDF_VERSIONS,
  TERMS_TEXT,
  type ContactKey,
} from '@/lib/settings/constants';
import type { ExchangeRow, PartnerDetails } from '@/lib/settings/partner';
import { CheckRow, errorMap, NIELSEN_COUNTRIES, SettingsPage, type Issue } from './shared';

interface ExchangeDraft {
  enabled: boolean;
  networkId: string;
  agencyId: string;
  seatId: string;
}
type Contacts = Record<ContactKey, { name: string; email: string; address: string; phone: string }>;

interface Draft {
  name: string;
  status: string;
  nielsenCountry: string;
  includeDataInCmTransfer: boolean;
  reportCostToCm: boolean;
  autoEnableNewExchanges: boolean;
  sdfVersion: string;
  sdfAdminEmail: string;
  accepted: boolean;
  contacts: Contacts;
  contactPerson: string;
  exchanges: Record<string, ExchangeDraft>;
}

const exchangeDraftOf = (rows: ExchangeRow[]): Draft['exchanges'] =>
  Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        enabled: r.enabled,
        networkId: r.networkId ?? '',
        agencyId: r.agencyId ?? '',
        seatId: r.seatId ?? '',
      },
    ]),
  );

const draftOf = (d: PartnerDetails, rows: ExchangeRow[]): Draft => ({
  name: d.name,
  status: d.status,
  nielsenCountry: d.nielsenCountry ?? '',
  includeDataInCmTransfer: d.includeDataInCmTransfer,
  reportCostToCm: d.reportCostToCm,
  autoEnableNewExchanges: d.autoEnableNewExchanges,
  sdfVersion: d.sdfVersion,
  sdfAdminEmail: d.sdfAdminEmail ?? '',
  accepted: d.dataTermsAccepted,
  contacts: structuredClone(d.contacts) as Contacts,
  contactPerson: d.contactPerson,
  exchanges: exchangeDraftOf(rows),
});

export function PartnerDetailsForm({
  partnerId,
  details,
  exchanges,
}: {
  partnerId: string;
  details: PartnerDetails;
  exchanges: ExchangeRow[];
}) {
  const toast = useToast();
  const [saved, setSaved] = useState<Draft>(() => draftOf(details, exchanges));
  const [draft, setDraft] = useState<Draft>(saved);
  const [ver, setVer] = useState(details.version);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null);
  const [contactTab, setContactTab] = useState<string>('PRIMARY');
  const [panel, setPanel] = useState<Draft['exchanges'] | null>(null);
  const [panelQuery, setPanelQuery] = useState('');
  const [feesOpen, setFeesOpen] = useState(false);
  const [feesAccepted, setFeesAccepted] = useState(details.appMediationFeesAccepted);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  useUnsavedGuard(dirty);
  const ro = !details.canWrite;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setContact = (k: string, f: string, v: string) =>
    setDraft((d) => ({
      ...d,
      contacts: { ...d.contacts, [k]: { ...d.contacts[k as ContactKey], [f]: v } },
    }));

  const enabledCount = Object.values(draft.exchanges).filter((e) => e.enabled).length;
  const exchangesDirty = JSON.stringify(saved.exchanges) !== JSON.stringify(draft.exchanges);

  const save = async () => {
    setSaving(true);
    setBanner(null);
    const picks = Object.entries(draft.exchanges)
      .filter(([, e]) => e.enabled)
      .map(([exchangeId, e]) => ({
        exchangeId,
        networkId: e.networkId || null,
        agencyId: e.agencyId || null,
        seatId: e.seatId || null,
      }));
    const res = await updatePartnerAction(
      partnerId,
      {
        name: draft.name,
        status: draft.status,
        currencyCode: details.currencyCode,
        timeZone: details.timeZone,
        nielsenCountry: draft.nielsenCountry || null,
        includeDataInCmTransfer: draft.includeDataInCmTransfer,
        reportCostToCm: draft.reportCostToCm,
        autoEnableNewExchanges: draft.autoEnableNewExchanges,
        sdfVersion: draft.sdfVersion,
        sdfAdminEmail: draft.sdfAdminEmail || null,
        dataProtection: {
          accepted: draft.accepted,
          contacts: draft.contacts,
          contactPerson: draft.contactPerson,
        },
        ...(exchangesDirty ? { exchanges: picks } : {}),
      },
      { expectedVersion: ver, ...(note.trim() ? { note: note.trim() } : {}) },
    );
    setSaving(false);
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
    if (res.code === 'CONFLICT') {
      setBanner({
        kind: 'error',
        text: 'This partner was changed in another tab or window. Reload the page to see the latest values.',
      });
    } else if (res.code === 'FORBIDDEN') {
      setBanner({ kind: 'error', text: 'You need read and write access to the partner to save.' });
    } else {
      setErrors(errorMap(res.issues));
      requestAnimationFrame(() => focusFirstInvalid());
    }
  };

  const acceptFees = async () => {
    const res = await acceptAppMediationFeesAction(partnerId);
    setFeesOpen(false);
    if (res.ok) {
      setFeesAccepted(true);
      toast.show({ kind: 'neutral', message: 'Fees accepted' });
    } else setBanner({ kind: 'error', text: 'The fees were not accepted.' });
  };

  const reset = () => {
    setDraft(saved);
    setErrors({});
    setBanner(null);
  };

  const groups = useMemo(() => {
    const q = panelQuery.trim().toLowerCase();
    const list = exchanges.filter((e) => !q || e.name.toLowerCase().includes(q));
    return {
      plain: list.filter((e) => !e.appMediation),
      mediation: list.filter((e) => e.appMediation),
    };
  }, [exchanges, panelQuery]);
  const mediationAll = exchanges.filter((e) => e.appMediation);

  // Exchange errors come back as `enabled[i].field` (i = position among the ticked exchanges).
  const exchangeErrors: Record<string, string> = {};
  {
    const picks = Object.entries(draft.exchanges).filter(([, e]) => e.enabled);
    for (const [path, msg] of Object.entries(errors)) {
      const m = /^enabled\[(\d+)\]\.(\w+)$/.exec(path);
      const id = m ? picks[Number(m[1])]?.[0] : undefined;
      if (m && id) exchangeErrors[`${id}.${m[2]}`] = msg;
    }
  }
  const hasExchangeErrors = Object.keys(exchangeErrors).length > 0;
  const panelErrors = (id: string, f: string) => exchangeErrors[`${id}.${f}`] ?? '';

  const exchangeRow = (e: ExchangeRow) => {
    const d = panel?.[e.id];
    if (!d || !panel) return null;
    const upd = (patch: Partial<ExchangeDraft>) =>
      setPanel({ ...panel, [e.id]: { ...d, ...patch } });
    return (
      <Box key={e.id} sx={{ py: 0.5 }}>
        <CheckRow
          label={e.name}
          checked={d.enabled}
          disabled={ro}
          onChange={(v) => upd({ enabled: v })}
          testId={`exchange-${e.code}`}
        />
        {d.enabled && e.needsNetworkId ? (
          <Box sx={{ display: 'flex', gap: 2, ml: 6, mb: 1 }}>
            <DvTextField
              label="Network ID"
              value={d.networkId}
              disabled={ro}
              error={panelErrors(e.id, 'networkId')}
              onChange={(v) => upd({ networkId: v })}
            />
            <DvTextField
              label="Agency ID"
              value={d.agencyId}
              disabled={ro}
              error={panelErrors(e.id, 'agencyId')}
              onChange={(v) => upd({ agencyId: v })}
            />
          </Box>
        ) : null}
        {d.enabled && e.needsSeatId ? (
          <Box sx={{ ml: 6, mb: 1, maxWidth: 280 }}>
            <DvTextField
              label="Seat ID"
              value={d.seatId}
              disabled={ro}
              error={panelErrors(e.id, 'seatId')}
              onChange={(v) => upd({ seatId: v })}
            />
          </Box>
        ) : null}
      </Box>
    );
  };

  const contactKey = contactTab as ContactKey;
  const sdf9 = draft.sdfVersion === '9';

  return (
    <>
      <SettingsPage title="Basic details" limited={details.limitedAccess}>
        {banner ? (
          <DvBanner kind={banner.kind} level="inline">
            {banner.text}
          </DvBanner>
        ) : null}
        {draft.status === 'PAUSED' ? (
          <DvBanner kind="warning" level="inline">
            This partner is currently paused. None of its advertisers are serving.
          </DvBanner>
        ) : null}
        <DvSectionCard title="Partner" layout="settings">
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <DvTextField
                label="Name"
                required
                value={draft.name}
                maxLength={NAME_MAX}
                disabled={ro}
                error={errors.name ?? ''}
                onChange={(v) => set({ name: v })}
              />
            </Box>
            <Box sx={{ width: 160 }}>
              <DvSelect
                label="Status"
                value={draft.status}
                disabled={ro}
                error={errors.status ?? ''}
                options={PARTNER_STATUS_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
                onChange={(v) => set({ status: v })}
              />
            </Box>
          </Box>
          <DvTextField label="Timezone" value={details.timeZone} locked />
          <DvTextField label="Currency" value={details.currencyCode} locked />
          <DvSelect
            label="Nielsen contract country"
            value={draft.nielsenCountry}
            disabled={ro}
            placeholder="Not set"
            options={NIELSEN_COUNTRIES.filter((c) => c.value).map((c) => ({
              value: c.value,
              label: c.label,
            }))}
            onChange={(v) => set({ nielsenCountry: v })}
          />
          <Box>
            <Typography variant="subtitle2">Measurement settings</Typography>
            <CheckRow
              label="Include DV360 data in CM360 Data Transfer reports"
              checked={draft.includeDataInCmTransfer}
              disabled={ro}
              onChange={(v) => set({ includeDataInCmTransfer: v })}
            />
            <CheckRow
              label="Report DV360 cost to CM360"
              checked={draft.reportCostToCm}
              disabled={ro}
              onChange={(v) => set({ reportCostToCm: v })}
            />
          </Box>
          <DvTextField label="Partner ID" value={details.publicId} readOnly help="Partner ID" />
        </DvSectionCard>

        <DvSectionCard title="Exchanges" layout="settings">
          <CheckRow
            label="Automatically enable new exchanges"
            checked={draft.autoEnableNewExchanges}
            disabled={ro}
            onChange={(v) => set({ autoEnableNewExchanges: v })}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography data-testid="exchange-count">{enabledCount} Exchanges enabled</Typography>
            <DvTooltip
              title={
                ro
                  ? 'You need read and write access to the partner to change exchanges.'
                  : 'Edit exchanges'
              }
            >
              <span>
                <IconButton
                  aria-label="Edit exchanges"
                  onClick={() => setPanel(structuredClone(draft.exchanges))}
                >
                  <DvIcon name="edit" size={20} />
                </IconButton>
              </span>
            </DvTooltip>
          </Box>
          {hasExchangeErrors ? (
            <Typography color="error" variant="caption" role="alert">
              Enter a value for the exchange IDs in the Exchanges panel.
            </Typography>
          ) : null}
          <DvBanner
            kind="info"
            level="inline"
            action={
              feesAccepted || ro
                ? undefined
                : { label: 'Review fees', onClick: () => setFeesOpen(true) }
            }
          >
            App mediation partners need the add-on fee terms to be accepted.
            {feesAccepted ? ' The terms are accepted.' : ''}
          </DvBanner>
        </DvSectionCard>

        <DvSectionCard title="Structured Data Files" layout="settings">
          <DvSelect
            label="SDF version"
            value={draft.sdfVersion}
            disabled={ro}
            error={errors.sdfVersion ?? ''}
            options={SDF_VERSIONS.map((v) => ({ value: v.label, label: v.label }))}
            onChange={(v) => set({ sdfVersion: v })}
          />
          {sdf9 ? (
            <DvBanner kind="info" level="inline">
              SDF version 9 files do not include newer line item fields.
            </DvBanner>
          ) : null}
          <DvTextField
            label="SDF Administrator email"
            type="email"
            value={draft.sdfAdminEmail}
            disabled={ro}
            error={errors.sdfAdminEmail ?? ''}
            onChange={(v) => set({ sdfAdminEmail: v })}
          />
        </DvSectionCard>

        <DvSectionCard title="Data protection" layout="settings">
          <CheckRow
            label="I accept the Google Ads Data Processing Terms"
            checked={draft.accepted}
            disabled={ro || saved.accepted}
            onChange={(v) => set({ accepted: v })}
            helper={saved.accepted ? 'Accepted. This cannot be changed.' : undefined}
          />
          {errors['dataProtection.accepted'] ? (
            <Typography color="error" variant="caption" role="alert">
              {errors['dataProtection.accepted']}
            </Typography>
          ) : null}
          <DvTabs
            variant="card"
            ariaLabel="Contacts"
            value={contactTab}
            onChange={setContactTab}
            tabs={CONTACT_ROLES.map((r) => ({ id: r.key, label: r.label }))}
          />
          <DvTextField
            label="Name"
            value={draft.contacts[contactKey].name}
            disabled={ro}
            onChange={(v) => setContact(contactKey, 'name', v)}
          />
          <DvTextField
            label="Email address"
            type="email"
            value={draft.contacts[contactKey].email}
            disabled={ro}
            error={errors[`dataProtection.contacts.${contactKey}.email`] ?? ''}
            onChange={(v) => setContact(contactKey, 'email', v)}
          />
          <DvTextField
            label="Address"
            value={draft.contacts[contactKey].address}
            disabled={ro}
            onChange={(v) => setContact(contactKey, 'address', v)}
          />
          <DvTextField
            label="Phone number"
            value={draft.contacts[contactKey].phone}
            disabled={ro}
            onChange={(v) => setContact(contactKey, 'phone', v)}
          />
          <DvRadioGroup
            label="Person to be contacted"
            value={draft.contactPerson}
            disabled={ro}
            error={errors['dataProtection.contactPerson'] ?? ''}
            options={CONTACT_ROLES.map((r) => ({ value: r.key, label: r.label }))}
            onChange={(v) => set({ contactPerson: v })}
          />
        </DvSectionCard>

        <DvSectionCard title="Additional settings" collapsible defaultOpen={false}>
          <Typography variant="subtitle2">Third-party rate cards</Typography>
          {details.rateCards.length === 0 ? (
            <Typography variant="body2">No third-party rate cards added</Typography>
          ) : (
            details.rateCards.map((c) => (
              <Typography key={c.id} variant="body2">
                {c.vendorName}: {c.ratePct}% media fee{c.accepted ? '' : ' (terms not accepted)'}
              </Typography>
            ))
          )}
        </DvSectionCard>
      </SettingsPage>

      {ro ? null : (
        <DvFormFooter
          mode="edit"
          dirty={dirty && !saving}
          onPrimary={() => void save()}
          onSecondary={reset}
          onReset={reset}
          note={note}
          onNoteChange={setNote}
        />
      )}

      {panel ? (
        <DvSlideOver
          open
          title="Exchanges"
          dirty={JSON.stringify(panel) !== JSON.stringify(draft.exchanges)}
          onCancel={() => {
            setPanel(null);
            setPanelQuery('');
          }}
          onApply={
            ro
              ? undefined
              : () => {
                  set({ exchanges: panel });
                  setPanel(null);
                  setPanelQuery('');
                }
          }
        >
          <Typography variant="body2" sx={{ mb: 2 }}>
            Partner Read and write permission is needed to modify.
          </Typography>
          <DvTextField
            ariaLabel="Search exchanges"
            placeholder="Search"
            value={panelQuery}
            onChange={setPanelQuery}
          />
          {groups.plain.length === 0 && groups.mediation.length === 0 ? (
            <Typography sx={{ mt: 2 }}>No exchanges match</Typography>
          ) : null}
          {groups.plain.map(exchangeRow)}
          {groups.mediation.length ? (
            <DvSectionCard
              collapsible
              title={`App mediation partners (${
                mediationAll.filter((e) => panel[e.id]?.enabled).length
              } of ${mediationAll.length})`}
            >
              {groups.mediation.map(exchangeRow)}
            </DvSectionCard>
          ) : null}
        </DvSlideOver>
      ) : null}

      <DvModal
        open={feesOpen}
        title="Review fees"
        primary={{
          label: 'Accept',
          onClick: () => void acceptFees(),
        }}
        secondary={{ label: 'Cancel', onClick: () => setFeesOpen(false) }}
        onClose={() => setFeesOpen(false)}
      >
        <Typography variant="body2">{TERMS_TEXT}</Typography>
      </DvModal>
    </>
  );
}
