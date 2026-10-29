'use client';

// Floodlight group shell, the conversions list and the New / Edit conversion form (module 15 S3, 4.2).
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvCheckboxGroup,
  DvEmptyState,
  DvFormFooter,
  DvGrid,
  DvModal,
  DvPageHeader,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvTabs,
  DvTextField,
  focusFirstInvalid,
  type DvColumn,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import {
  archiveConversionAction,
  createConversionAction,
  updateConversionAction,
  validateConversionAction,
} from '@/lib/resources/actions';
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import { COUNTING_METHODS_BY_ACTIVITY } from '@/lib/validation/constants/conversions';
import type {
  FloodlightConversionInput,
  FloodlightConversionView,
  FloodlightRow,
  PlatformKey,
  WireIssue,
} from '@/lib/resources/wire';

export type FloodlightTab = 'details' | 'events' | 'google-tag' | 'history';

const TABS: { id: FloodlightTab; label: string }[] = [
  { id: 'details', label: 'Basic details' },
  { id: 'events', label: 'Floodlight conversions' },
  { id: 'google-tag', label: 'Google tag' },
  { id: 'history', label: 'History' },
];

/** Page title and tabs shared by the four Floodlight group tabs. */
export function FloodlightShell({
  partnerId,
  advertiserId,
  tab,
  actions,
  children,
}: {
  partnerId: string;
  advertiserId: string;
  tab: FloodlightTab;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  return (
    <>
      <DvPageHeader title="Floodlight group" limitedAccess={viewer.limitedAccess} actions={actions}>
        <DvTabs
          tabs={TABS}
          value={tab}
          onChange={(id) => router.push(advertiserPath(partnerId, advertiserId, 'fl', id))}
          ariaLabel="Floodlight group"
        />
      </DvPageHeader>
      {children}
    </>
  );
}

const PLATFORM_LABEL: Record<PlatformKey, string> = {
  WEB: 'Web',
  MOBILE_APP: 'Mobile app',
  CONNECTED_TV: 'Connected TV',
};

export function ConversionsList({
  partnerId,
  advertiserId,
  rows,
  status,
}: {
  partnerId: string;
  advertiserId: string;
  rows: FloodlightRow[];
  status: 'ACTIVE' | 'ARCHIVED' | 'ALL';
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [page, setPage] = useState({ page: 1, size: 20 });
  const columns: DvColumn<FloodlightRow>[] = [
    {
      id: 'name',
      header: 'Name',
      group: 'fl',
      sticky: true,
      cell: (r) => (
        <AppLink href={advertiserPath(partnerId, advertiserId, 'fl', 'events', r.id)}>
          {r.name}
          <Typography component="span" variant="caption" sx={{ ml: 1 }}>
            {r.id}
          </Typography>
        </AppLink>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      group: 'fl',
      accessor: (r) => (r.status === 'ACTIVE' ? 'Active' : 'Archived'),
    },
    { id: 'source', header: 'Source', group: 'fl' },
    {
      id: 'type',
      header: 'Type',
      group: 'fl',
      accessor: (r) => (r.type === 'SALE' ? 'Sale' : 'Counter'),
    },
    {
      id: 'countingMethod',
      header: 'Counting Method',
      group: 'fl',
      accessor: (r) =>
        r.countingMethod
          .toLowerCase()
          .replace('_', ' ')
          .replace(/^./, (c) => c.toUpperCase()),
    },
    {
      id: 'category',
      header: 'Category',
      group: 'fl',
      accessor: (r) => r.category?.replace(/_/g, ' ').toLowerCase() ?? '-',
    },
    {
      id: 'remarketing',
      header: 'Remarketing List',
      group: 'dv',
      accessor: (r) => (r.remarketing ? 'Yes' : 'No'),
    },
    {
      id: 'youtube',
      header: 'YouTube Conversion Tracking',
      group: 'dv',
      accessor: (r) => (r.youtubeTracking ? 'Yes' : 'No'),
    },
    { id: 'lineItems', header: 'Line Items', group: 'dv', type: 'number', align: 'right' },
    {
      id: 'impressionsYesterday',
      header: 'Impressions (Yesterday)',
      group: 'web',
      type: 'number',
      align: 'right',
    },
  ];
  return (
    <FloodlightShell
      partnerId={partnerId}
      advertiserId={advertiserId}
      tab="events"
      actions={
        <Button
          variant="contained"
          disabled={viewer.readOnly}
          href={advertiserPath(partnerId, advertiserId, 'fl', 'events', 'new')}
        >
          New Floodlight conversion
        </Button>
      }
    >
      <Box sx={{ mb: 2, maxWidth: 240 }}>
        <DvSelect
          ariaLabel="Status filter"
          value={status}
          options={[
            { value: 'ACTIVE', label: 'Status: Active' },
            { value: 'ARCHIVED', label: 'Status: Archived' },
            { value: 'ALL', label: 'Status: All' },
          ]}
          onChange={(v) =>
            router.push(advertiserPath(partnerId, advertiserId, 'fl', 'events') + `?status=${v}`)
          }
        />
      </Box>
      <DvGrid
        ariaLabel="Floodlight conversions"
        rows={rows.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        groups={[
          { id: 'fl', label: 'Floodlight Conversion' },
          { id: 'dv', label: 'DV360 Conversion' },
          { id: 'web', label: 'Web' },
        ]}
        getRowId={(r) => r.id}
        page={page.page}
        pageSize={page.size}
        total={rows.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<DvEmptyState message="No Floodlight conversions yet" />}
      />
    </FloodlightShell>
  );
}

// ---------------------------------------------------------------------------------------------
// New / Edit conversion
// ---------------------------------------------------------------------------------------------

const CATEGORIES = [
  'PURCHASE',
  'ADD_TO_CART',
  'BEGIN_CHECKOUT',
  'SUBSCRIBE_PAID',
  'CONTACT',
  'SUBMIT_LEAD_FORM',
  'BOOK_APPOINTMENT',
  'SIGN_UP',
  'REQUEST_QUOTE',
  'GET_DIRECTIONS',
  'OUTBOUND_CLICK',
  'QUALIFIED_LEAD',
  'PAGE_VIEW',
].map((c) => ({
  value: c,
  label: c
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (x) => x.toUpperCase()),
}));

const METHOD_LABEL: Record<string, string> = {
  STANDARD: 'Standard',
  UNIQUE: 'Unique',
  PER_SESSION: 'Per session',
  TRANSACTIONS: 'Transactions',
  ITEMS_SOLD: 'Items sold',
};

export function newConversionValue(platform: PlatformKey): FloodlightConversionInput {
  return {
    platform,
    name: '',
    format: 'GOOGLE_TAG',
    type: null,
    countingMethod: null,
    category: null,
    status: 'ACTIVE',
    remarketing: false,
    youtubeEnabled: false,
    valueBasedBidding: false,
    commercePartner: false,
    personalizedAdExclusion: 'DONT_EXCLUDE',
    customVariableKeys: [],
    appId: null,
    ctvAppId: null,
    conversionEventName: null,
  };
}

export function ConversionForm({
  partnerId,
  advertiserId,
  initial,
  existing,
  apps,
}: {
  partnerId: string;
  advertiserId: string;
  initial: FloodlightConversionInput | null;
  existing: FloodlightConversionView | null;
  apps: { value: string; label: string; platform: string }[];
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const editing = existing !== null;
  const [step, setStep] = useState<'type' | 'form'>(initial || editing ? 'form' : 'type');
  const [value, setValue] = useState<FloodlightConversionInput | null>(
    existing ? { ...existing } : initial,
  );
  const [saved, setSaved] = useState<FloodlightConversionInput | null>(
    existing ? { ...existing } : initial,
  );
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [archiveWarn, setArchiveWarn] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedGuard(dirty);
  const listPath = advertiserPath(partnerId, advertiserId, 'fl', 'events');

  if (step === 'type' || !value) {
    return (
      <DvSectionCard title="What do you want to measure?">
        <DvRadioGroup
          variant="cards"
          value=""
          onChange={(p) => {
            setValue(newConversionValue(p as PlatformKey));
            setSaved(newConversionValue(p as PlatformKey));
            setStep('form');
          }}
          options={[
            { value: 'WEB', label: 'Web', description: 'Visits and purchases on your website' },
            {
              value: 'MOBILE_APP',
              label: 'Mobile app',
              description: 'Installs and in-app conversions',
            },
            {
              value: 'CONNECTED_TV',
              label: 'Connected TV',
              description: 'Conversions in Connected TV apps',
            },
          ]}
        />
      </DvSectionCard>
    );
  }

  const set = (patch: Partial<FloodlightConversionInput>) => {
    const next = { ...value, ...patch };
    setValue(next);
    void validateConversionAction(advertiserId, next).then(setIssues);
  };
  const err = (p: string) =>
    submitted ? issues.find((i) => i.severity === 'error' && i.path === p)?.message : undefined;
  const info = (p: string) => issues.find((i) => i.severity === 'info' && i.path === p)?.message;
  const locked = editing; // FL-032
  const methods = value.type ? COUNTING_METHODS_BY_ACTIVITY[value.type] : [];
  const nonWeb = value.platform !== 'WEB';

  const submit = () =>
    start(async () => {
      setSubmitted(true);
      const res = editing
        ? await updateConversionAction(existing.id, value, { expectedVersion: existing.version })
        : await createConversionAction(advertiserId, value);
      if (!res.ok) {
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setSaved(value);
      router.push(listPath);
      router.refresh();
    });

  const archive = (confirmed: boolean) =>
    start(async () => {
      const res = await archiveConversionAction(existing!.id, confirmed);
      if (!res.ok) return setIssues(res.issues);
      if (!res.data.archived) return setArchiveWarn(res.data.usedBy);
      setSaved(value);
      router.push(listPath);
      router.refresh();
    });

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(e) => e.preventDefault()}
      sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <DvSectionCard title={`${PLATFORM_LABEL[value.platform!]} conversion`} layout="settings">
        <DvTextField
          label="Name"
          required
          value={value.name}
          readOnly={viewer.readOnly}
          error={err('name')}
          onChange={(name) => set({ name })}
          id="conversion-name"
        />
        {value.platform === 'WEB' ? (
          <DvSelect
            label="Format"
            value={value.format ?? ''}
            disabled={locked || viewer.readOnly}
            error={err('format')}
            options={[
              { value: 'GOOGLE_TAG', label: 'Google tag' },
              { value: 'IFRAME_TAG', label: 'Iframe tag' },
              { value: 'IMAGE_TAG', label: 'Image tag' },
            ]}
            onChange={(format) => set({ format: format as FloodlightConversionInput['format'] })}
          />
        ) : null}
        {nonWeb ? (
          <>
            <DvSelect
              label={value.platform === 'MOBILE_APP' ? 'App' : 'Connected TV app'}
              placeholder="Select an app"
              searchable
              value={(value.platform === 'MOBILE_APP' ? value.appId : value.ctvAppId) ?? ''}
              disabled={viewer.readOnly}
              error={err('appId') ?? err('ctvAppId')}
              options={apps
                .filter((a) =>
                  value.platform === 'MOBILE_APP' ? a.platform !== 'CTV' : a.platform === 'CTV',
                )
                .map((a) => ({ value: a.value, label: a.label }))}
              onChange={(v) =>
                set(value.platform === 'MOBILE_APP' ? { appId: v } : { ctvAppId: v })
              }
            />
            <DvTextField
              label="Conversion event name"
              maxLength={RESOURCE_LIMITS.EVENT_NAME_MAX}
              value={value.conversionEventName ?? ''}
              readOnly={viewer.readOnly}
              error={err('conversionEventName')}
              onChange={(conversionEventName) => set({ conversionEventName })}
              id="conversion-event"
            />
          </>
        ) : null}
        <DvRadioGroup
          label="Type"
          value={value.type ?? ''}
          disabled={locked || viewer.readOnly}
          error={err('type')}
          options={[
            { value: 'COUNTER', label: 'Counter' },
            { value: 'SALE', label: 'Sale' },
          ]}
          onChange={(type) =>
            set({ type: type as FloodlightConversionInput['type'], countingMethod: null })
          }
        />
        <DvSelect
          label="Counting method"
          placeholder="Choose method"
          value={value.countingMethod ?? ''}
          disabled={!value.type || viewer.readOnly}
          error={err('countingMethod')}
          options={methods.map((m) => ({ value: m, label: METHOD_LABEL[m]! }))}
          onChange={(m) =>
            set({ countingMethod: m as FloodlightConversionInput['countingMethod'] })
          }
        />
        <DvSelect
          label="Category"
          placeholder="Choose category"
          value={value.category ?? ''}
          disabled={viewer.readOnly}
          options={CATEGORIES}
          onChange={(category) => set({ category })}
        />
        {editing ? (
          <DvSelect
            label="Status"
            value={value.status}
            disabled={viewer.readOnly}
            error={err('status')}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
            onChange={(status) => set({ status: status as 'ACTIVE' | 'ARCHIVED' })}
          />
        ) : null}
        <DvCheckboxGroup
          values={[
            ...(value.remarketing ? ['remarketing'] : []),
            ...(value.youtubeEnabled ? ['youtube'] : []),
            ...(value.valueBasedBidding ? ['value'] : []),
            ...(value.commercePartner ? ['commerce'] : []),
          ]}
          readOnly={viewer.readOnly}
          error={err('valueBasedBidding')}
          hint={info('remarketing')}
          options={[
            { value: 'remarketing', label: 'Enable remarketing list' },
            { value: 'youtube', label: 'Enable YouTube conversion tracking' },
            { value: 'value', label: 'Use for value-based bidding' },
            { value: 'commerce', label: 'Commerce partner measurement' },
          ]}
          onChange={(vals) =>
            set({
              remarketing: vals.includes('remarketing'),
              youtubeEnabled: vals.includes('youtube'),
              valueBasedBidding: vals.includes('value'),
              commercePartner: vals.includes('commerce'),
            })
          }
        />
        {editing && !viewer.readOnly && value.status === 'ACTIVE' ? (
          <Button color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => archive(false)}>
            Archive conversion
          </Button>
        ) : null}
      </DvSectionCard>
      {viewer.readOnly ? null : (
        <DvFormFooter
          mode={editing ? 'edit' : 'create'}
          dirty={dirty}
          primaryLabel={editing ? 'Save' : 'Create'}
          onPrimary={submit}
          onSecondary={() => router.push(listPath)}
          onReset={() => {
            setValue(saved);
            setIssues([]);
          }}
        />
      )}
      <DvModal
        open={archiveWarn !== null}
        title="Archive conversion"
        primary={{ label: 'Archive', tone: 'danger', onClick: () => archive(true) }}
        secondary={{ label: 'Cancel', onClick: () => setArchiveWarn(null) }}
        onClose={() => setArchiveWarn(null)}
      >
        {archiveWarn} line items count this conversion.
      </DvModal>
    </Box>
  );
}
