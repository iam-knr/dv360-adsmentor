'use client';

// Audience details (module 14 S13, S14): read-only facts, three editable fields (name, description, membership
// duration), the size table, archive, and "Add data" for a customer match list created without a source.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvEntityHeader,
  DvFormFooter,
  DvModal,
  DvSectionCard,
  DvTabs,
  DvTextField,
  focusFirstInvalid,
  useToast,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { advertiserPath } from '@/lib/routes/paths';
import {
  addCustomerMatchDataAction,
  archiveAudienceAction,
  bulkAudienceActionAction,
  updateAudienceAction,
} from '@/lib/audiences/actions';
import { countryName } from '@/lib/audiences/countries';
import { YT_ACTION_LABEL, type AudienceView, type WireIssue, type YtUserAction } from '@/lib/audiences/wire';
import { hashCsv } from './CustomerMatchForm';
import { AudienceStatus, SizeBar } from './shared';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 2, py: 1 }}>
      <Typography variant="subtitle2" component="dt">
        {label}
      </Typography>
      <Typography variant="body1" component="dd" sx={{ m: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-');

export function AudienceDetails({
  partnerId,
  advertiserId,
  audience: a,
}: {
  partnerId: string;
  advertiserId: string;
  audience: AudienceView;
}) {
  const router = useRouter();
  const toast = useToast();
  const { viewer } = useViewer();
  const [name, setName] = useState(a.name);
  const [description, setDescription] = useState(a.description ?? '');
  const [days, setDays] = useState(a.membershipDays === null ? '' : String(a.membershipDays));
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, start] = useTransition();
  const hasDuration = a.membershipDays !== null && a.type !== 'LOOKALIKE';
  const dirty =
    !saved && (name !== a.name || description !== (a.description ?? '') || (hasDuration && days !== String(a.membershipDays)));
  useUnsavedGuard(dirty);
  const canEdit = !viewer.readOnly && a.status !== 'ARCHIVED' && a.type !== 'PARTNER' && !a.externalSource;
  const err = (p: string) => issues.find((i) => i.severity === 'error' && i.path === p)?.message;
  const base = (...seg: string[]) => advertiserPath(partnerId, advertiserId, ...seg);

  const save = () =>
    start(async () => {
      const res = await updateAudienceAction(
        a.id,
        {
          name,
          description,
          ...(hasDuration ? { membershipDays: days } : {}),
        },
        { expectedVersion: a.version },
      );
      if (!res.ok) {
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setSaved(true);
      toast.show({ message: 'Audience saved.' });
      router.refresh();
    });

  const archive = (confirmed: boolean) =>
    start(async () => {
      const res = await archiveAudienceAction(a.id, confirmed);
      if (!res.ok) return setIssues(res.issues);
      if (!res.data.archived) return setConfirm(res.data.lineItems);
      setConfirm(null);
      toast.show({ message: 'Audience archived.' });
      router.push(base('first-party-audiences'));
      router.refresh();
    });

  const unarchive = () =>
    start(async () => {
      await bulkAudienceActionAction({ ids: [a.id], action: 'UNARCHIVE' });
      router.refresh();
    });

  const addData = () =>
    start(async () => {
      if (!file) return setIssues([{ path: 'file', severity: 'error', code: 'AUD-021', message: 'Upload a CSV file with at least one identifier column.' }]);
      const res = await addCustomerMatchDataAction(a.id, {
        fileName: file.name,
        fileText: file.text,
        contactType: 'EMAIL',
        consentAck: consent,
      });
      if (!res.ok) return setIssues(res.issues);
      toast.show({ message: 'Data added. The list will be available in about 4 hours.' });
      router.refresh();
    });

  const entityHeader = (
    <DvEntityHeader
      crumbs={[{ label: 'All audiences', href: base('first-party-audiences') }]}
      title={`${a.name} (${a.id})`}
      status={<AudienceStatus status={a.status} availableInHours={a.availableInHours} />}
      actions={
        !viewer.readOnly && a.type !== 'PARTNER' ? (
          a.status === 'ARCHIVED' ? (
            <Button onClick={unarchive}>Unarchive</Button>
          ) : (
            <Button color="error" onClick={() => archive(false)} disabled={pending}>
              Archive
            </Button>
          )
        ) : null
      }
    >
      {viewer.limitedAccess ? <Typography variant="caption">Limited Access</Typography> : null}
      <DvTabs
        ariaLabel="Audience"
        value="details"
        tabs={[
          { id: 'details', label: 'Audience details', disabled: a.externalSource },
          { id: 'lis', label: 'Line items' },
        ]}
        onChange={(id) => {
          if (id === 'lis') router.push(base('audience', a.id, 'explorerlis'));
        }}
      />
    </DvEntityHeader>
  );

  if (a.externalSource)
    return (
      <>
        {entityHeader}
        <DvBanner kind="info">
          This tag-based audience is created outside of Display &amp; Video 360 Audience Manager. Audience details page
          is not supported.
        </DvBanner>
      </>
    );

  return (
    <>
      {entityHeader}
      {a.status === 'PROCESSING' && a.availableInHours > 0 ? (
        <DvBanner kind="info">
          Available in about {a.availableInHours} {a.availableInHours === 1 ? 'hour' : 'hours'}.
        </DvBanner>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 3 }}>
        <DvSectionCard title="Audience details" layout="settings">
          {canEdit ? (
            <>
              <DvTextField id="audience-name" label="Name" maxLength={255} value={name} onChange={setName} error={err('name')} />
              <DvTextField id="audience-description" label="Description" value={description} onChange={setDescription} />
              {hasDuration ? (
                <DvTextField
                  id="audience-days"
                  label="Membership duration (days)"
                  type="number"
                  value={days}
                  onChange={setDays}
                  error={err('membershipDays')}
                />
              ) : null}
            </>
          ) : (
            <Box component="dl" sx={{ m: 0 }}>
              <Row label="Name">{a.name}</Row>
              <Row label="Description">{a.description ?? '-'}</Row>
              {a.membershipDays !== null ? <Row label="Membership duration">{a.membershipDays} days</Row> : null}
            </Box>
          )}
          <Box component="dl" sx={{ m: 0 }}>
            <Row label="Type">{a.typeLabel}</Row>
            <Row label="Source">{a.source}</Row>
            <Row label="Status">
              {a.status === 'ACTIVE' ? `Active, available since ${when(a.availableAt)}` : a.status === 'PROCESSING' ? 'Processing' : a.status === 'INACTIVE' ? 'Inactive' : 'Archived'}
            </Row>
            <Row label="Created">{when(a.createdAt)}</Row>
            <Row label="Last modified">{when(a.updatedAt)}</Row>
          </Box>
        </DvSectionCard>
        {a.floodlight ? (
          <DvSectionCard title="Floodlight activity" layout="settings">
            <Box component="dl" sx={{ m: 0 }}>
              <Row label="Activity">
                {a.floodlight.name} ({a.floodlight.id})
              </Row>
              {a.floodlight.rules.map((r, i) => (
                <Row key={i} label={`Rule ${i + 1}`}>
                  {r.variableKey} {r.operator.toLowerCase().replace('_', ' ')} {r.value}
                </Row>
              ))}
            </Box>
          </DvSectionCard>
        ) : null}
        {a.lookalike ? (
          <DvSectionCard title="Lookalike settings" layout="settings">
            <Box component="dl" sx={{ m: 0 }}>
              <Row label="Seed lists">
                {a.lookalike.seeds.map((s) => `${s.name} (${s.users.toLocaleString('en-US')} users)`).join(', ') || '-'}
              </Row>
              <Row label="Audience reach">{a.lookalike.reachPct}%</Row>
              <Row label="Geography">{a.lookalike.countries.map(countryName).join(', ')}</Row>
            </Box>
          </DvSectionCard>
        ) : null}
        {a.customerMatch ? (
          <DvSectionCard title="Customer match" layout="settings">
            <Box component="dl" sx={{ m: 0 }}>
              <Row label="Contact type">{a.customerMatch.contactType ?? '-'}</Row>
              <Row label="Data source">{a.customerMatch.dataSource ?? 'Not set up yet'}</Row>
              {a.customerMatch.uploads.map((u, i) => (
                <Row key={i} label={u.fileName}>
                  {u.rows.toLocaleString('en-US')} rows, {u.matched.toLocaleString('en-US')} matched ({u.matchRatePct ?? 0}%)
                </Row>
              ))}
            </Box>
            {a.status === 'INACTIVE' && canEdit ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Button variant="outlined" component="label" sx={{ alignSelf: 'flex-start' }}>
                  Choose CSV file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    data-testid="cm-add-file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void f.text().then(hashCsv).then((text) => setFile({ name: f.name, text }));
                    }}
                  />
                </Button>
                <label>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I confirm I have
                  permission to use this data
                </label>
                {err('file') || err('consentAck') ? (
                  <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
                    {err('file') ?? err('consentAck')}
                  </Typography>
                ) : null}
                <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={addData} disabled={pending}>
                  Add data
                </Button>
              </Box>
            ) : null}
          </DvSectionCard>
        ) : null}
        {a.combined ? (
          <DvSectionCard title="Members" layout="settings">
            <Box component="dl" sx={{ m: 0 }}>
              <Row label="Expression">{a.combined.expression}</Row>
              {a.combined.include.map((g, i) => (
                <Row key={i} label={i === 0 ? 'Include' : 'And include'}>
                  {g.map((m) => m.name).join(' or ')}
                </Row>
              ))}
              {a.combined.exclude.length ? <Row label="Exclude">{a.combined.exclude.map((m) => m.name).join(', ')}</Row> : null}
            </Box>
          </DvSectionCard>
        ) : null}
        {a.entries.length > 0 ? (
          <DvSectionCard title="Entries" layout="settings">
            <Box component="dl" sx={{ m: 0 }}>
              {(['INTEREST', 'KEYWORD', 'URL', 'APP'] as const).map((k) => {
                const vals = a.entries.filter((e) => e.kind === k).map((e) => e.value);
                return vals.length ? (
                  <Row key={k} label={k === 'INTEREST' ? 'Interests' : k === 'KEYWORD' ? 'Keywords' : k === 'URL' ? 'URLs' : 'Apps'}>
                    {vals.join(', ')}
                  </Row>
                ) : null;
              })}
            </Box>
          </DvSectionCard>
        ) : null}
        {a.youtube ? (
          <DvSectionCard title="YouTube users" layout="settings">
            <Box component="dl" sx={{ m: 0 }}>
              <Row label="Channel">{a.youtube.channel ?? '-'}</Row>
              <Row label="User action">{a.youtube.action ? YT_ACTION_LABEL[a.youtube.action as YtUserAction] : '-'}</Row>
              {a.youtube.videoIds.length ? <Row label="Video IDs">{a.youtube.videoIds.join(', ')}</Row> : null}
            </Box>
          </DvSectionCard>
        ) : null}
        <DvSectionCard title="Size" layout="settings">
          <Box component="table" aria-label="Audience size" sx={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Inventory</th>
                <th align="left">Size</th>
              </tr>
            </thead>
            <tbody>
              {a.sizes.map((s) => (
                <tr key={s.label}>
                  <td style={{ padding: '4px 24px 4px 0' }}>{s.label}</td>
                  <td>
                    <SizeBar cell={s.cell} label={s.label} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Line items using this list: {a.lineItemCount}
          </Typography>
        </DvSectionCard>
        {canEdit ? (
          <DvFormFooter
            mode="edit"
            dirty={dirty}
            primaryLabel="Save"
            onPrimary={save}
            onSecondary={() => router.push(base('first-party-audiences'))}
            onReset={() => {
              setName(a.name);
              setDescription(a.description ?? '');
              setDays(a.membershipDays === null ? '' : String(a.membershipDays));
              setIssues([]);
            }}
          />
        ) : null}
      </Box>
      <DvModal
        open={confirm !== null}
        title="Archive audience"
        primary={{ label: 'Archive', tone: 'danger', onClick: () => archive(true), loading: pending }}
        secondary={{ label: 'Cancel', onClick: () => setConfirm(null) }}
        onClose={() => setConfirm(null)}
      >
        {confirm} active line items target this audience. They keep the reference and will show a conflict.
      </DvModal>
    </>
  );
}
