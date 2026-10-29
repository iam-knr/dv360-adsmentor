'use client';

// Deal page (module 13 S4): Overview · Access · Settings · History. The tab is `?activeTab=`. Students change the
// status, the frequency cap and the advertiser access; everything else is the seller's and read only (RC, C2).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvChartCard,
  DvEmptyState,
  DvEntityHeader,
  DvSectionCard,
  DvSelect,
  DvSparkBars,
  DvStatusDot,
  DvStatusSelect,
  DvTabs,
  DvTextField,
  useToast,
  type EntityStatus,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { updateDealAction } from '@/lib/inventory/actions';
import { FORMAT_LABEL } from '@/lib/inventory/format-compat';
import { INV_MSG } from '@/lib/inventory/messages';
import { dealPath, inventoryPath, type DealTab, type Scope } from '@/lib/inventory/paths';
import { dealActionsFor, DEAL_STATUS_LABEL, type DealStatusKey } from '@/lib/inventory/transitions';
import type { DealLineItemRow, DealView, FrequencyCapView } from '@/lib/inventory/types';
import { AppLink } from '@/lib/routes/AppLink';
import { AssignPackageDialog } from './AssignPackageDialog';
import { DealHistory } from './DealHistory';
import type { ComponentProps } from 'react';

const TABS = [
  { id: 'overviewTab', label: 'Overview' },
  { id: 'accessTab', label: 'Access' },
  { id: 'settingsTab', label: 'Settings' },
  { id: 'historyTab', label: 'History' },
];

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC' });
const dateTime = (iso: string) =>
  `${new Date(iso).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC`;
const num = (n: number | null) => (n === null ? '-' : n.toLocaleString('en-IN'));
const money = (n: number | null, code: string) =>
  n === null
    ? '-'
    : `${code === 'INR' ? '₹' : `${code} `}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Box>
  );
}

const STATUS_ENTITY: Partial<Record<DealStatusKey, EntityStatus>> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
};
const ENTITY_ACTION: Partial<Record<EntityStatus, 'ACTIVE' | 'PAUSED' | 'ARCHIVED'>> = {
  active: 'ACTIVE',
  paused: 'PAUSED',
  archived: 'ARCHIVED',
};
const ACTION_ENTITY = {
  ACTIVATE: 'active',
  PAUSE: 'paused',
  ARCHIVE: 'archived',
  UNARCHIVE: 'paused',
} as const;

function capText(cap: FrequencyCapView | null): string {
  if (!cap?.enabled) return 'No frequency cap';
  return `${cap.maxImpressions} impressions per ${cap.periodCount} ${cap.period?.toLowerCase()}`;
}

export function DealPage({
  scope,
  deal,
  lineItems,
  tab,
  history,
  canWrite,
}: {
  scope: Scope;
  deal: DealView;
  lineItems: DealLineItemRow[];
  tab: DealTab;
  history: ComponentProps<typeof DealHistory>;
  canWrite: boolean;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const toast = useToast();
  const r = deal.row;
  const writable = canWrite && !viewer.readOnly && !deal.viewOnly;
  const [assign, setAssign] = useState(false);

  const save = async (input: Parameters<typeof updateDealAction>[2], done: string) => {
    const res = await updateDealAction(scope.advertiserId, r.id, {
      ...input,
      expectedVersion: deal.version,
    });
    if (!res.ok) {
      toast.show({ kind: 'error', message: res.issues[0]?.message ?? "Couldn't save the deal." });
      return false;
    }
    toast.show(
      res.warnings?.length
        ? { kind: 'warning', message: res.warnings[0]?.message ?? done }
        : { message: done },
    );
    router.refresh();
    return true;
  };

  const entity = STATUS_ENTITY[r.status];
  const options: EntityStatus[] = entity
    ? [entity, ...dealActionsFor(r.status).map((a) => ACTION_ENTITY[a])].filter(
        (v, i, a) => a.indexOf(v) === i,
      )
    : [];
  const statusNode = entity ? (
    <DvStatusSelect
      value={entity}
      options={options}
      disabled={!writable}
      onChange={(v) => {
        const target = ENTITY_ACTION[v];
        if (target) void save({ status: target }, `${r.name} is now ${v}`);
      }}
    />
  ) : (
    <DvStatusDot
      status={r.status === 'COMPLETED' ? 'completed' : 'notServable'}
      label={DEAL_STATUS_LABEL[r.status]}
    />
  );

  return (
    <>
      <DvEntityHeader
        crumbs={[{ label: 'My inventory', href: inventoryPath(scope) }]}
        title={r.name}
        status={statusNode}
        actions={
          writable ? (
            <Button variant="outlined" onClick={() => setAssign(true)}>
              Assign to line items
            </Button>
          ) : undefined
        }
      >
        <DvTabs
          tabs={TABS}
          value={tab}
          ariaLabel="Deal"
          onChange={(id) => router.replace(dealPath(scope, r.publicId, id as DealTab))}
        />
      </DvEntityHeader>
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {tab === 'overviewTab' ? (
          <Overview
            deal={deal}
            lineItems={lineItems}
            onAssign={writable ? () => setAssign(true) : undefined}
          />
        ) : null}
        {tab === 'accessTab' ? <Access deal={deal} writable={writable} onSave={save} /> : null}
        {tab === 'settingsTab' ? <Settings deal={deal} writable={writable} onSave={save} /> : null}
        {tab === 'historyTab' ? <DealHistory {...history} /> : null}
      </Box>
      {assign ? (
        <AssignPackageDialog
          kind="DEAL"
          advertiserId={scope.advertiserId}
          pkg={{ id: r.id, name: r.name, format: r.format }}
          onClose={() => {
            setAssign(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function Overview({
  deal,
  lineItems,
  onAssign,
}: {
  deal: DealView;
  lineItems: DealLineItemRow[];
  onAssign?: (() => void) | undefined;
}) {
  const r = deal.row;
  const pg = r.commitment === 'GUARANTEED' && deal.committed !== null;
  const pct =
    pg && deal.committed
      ? Math.min(100, Math.round(((deal.delivered ?? 0) / deal.committed) * 100))
      : 0;
  return (
    <>
      <Box
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}
      >
        <DvChartCard
          title="Delivery over time"
          period="(last 30 days)"
          empty={
            deal.dailySeries.length === 0 ? (
              <DvEmptyState variant="inline" message="No delivery yet" />
            ) : undefined
          }
        >
          <DvSparkBars
            label="Impressions per day"
            data={deal.dailySeries.map((d) => ({ label: d.date, value: d.impressions }))}
          />
        </DvChartCard>
        <DvChartCard title="Win rate">
          <Typography variant="h5" data-testid="win-rate">
            {r.winRate === null ? '-' : `${r.winRate}%`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Impressions {num(r.impressions)} · Spend {money(r.spend, deal.currencyCode)}
          </Typography>
        </DvChartCard>
        <DvChartCard title="Frequency cap (date range)">
          <Typography variant="body2">{capText(deal.frequencyCap)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {date(r.startAt)} to {date(r.endAt)}
          </Typography>
        </DvChartCard>
      </Box>
      {pg ? (
        <Box data-testid="pg-progress">
          <Typography variant="subtitle2">Delivered vs committed</Typography>
          <Box
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            sx={{ height: 8, bgcolor: 'surface.sunken', borderRadius: 1, my: 1 }}
          >
            <Box
              sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 1 }}
            />
          </Box>
          <Typography variant="body2">
            {num(deal.delivered ?? 0)} of {num(deal.committed)} impressions
            {deal.shortfall ? ` · shortfall ${num(deal.shortfall)}` : ''}
          </Typography>
        </Box>
      ) : null}
      <Typography variant="caption" color="text.secondary">
        The line item information below only applies to this deal and is based on the UTC time zone.
      </Typography>
      {lineItems.length === 0 ? (
        <DvEmptyState
          variant="inline"
          message="No line items are using this deal"
          action={onAssign ? { label: 'Assign', onClick: onAssign } : undefined}
        />
      ) : (
        <Box
          component="table"
          aria-label="Line items using this deal"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': {
              textAlign: 'left',
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <thead>
            <tr>
              <th>Line item</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Impressions</th>
              <th style={{ textAlign: 'right' }}>Spend</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((l) => (
              <tr key={l.id} data-testid="deal-line-item">
                <td>
                  <AppLink href={l.href}>{l.name}</AppLink>
                </td>
                <td>{l.type}</td>
                <td>{l.status}</td>
                <td style={{ textAlign: 'right' }}>{num(l.impressions)}</td>
                <td style={{ textAlign: 'right' }}>{money(l.spend, deal.currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}
    </>
  );
}

function Access({
  deal,
  writable,
  onSave,
}: {
  deal: DealView;
  writable: boolean;
  onSave: (i: { advertiserAccess: string[] | null }, done: string) => Promise<boolean>;
}) {
  const a = deal.advertiserAccess;
  const [all, setAll] = useState(a.allAdvertisers);
  const [picked, setPicked] = useState<Set<string>>(new Set(a.advertisers.map((x) => x.id)));
  const [error, setError] = useState<string | null>(null);
  return (
    <DvSectionCard title="Access" layout="stacked">
      <Fact label="Write access" value={`Partner: ${a.partnerName}`} />
      {writable ? (
        <Box sx={{ mt: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={all} onChange={(e) => setAll(e.target.checked)} />}
            label="All advertisers permissioned"
          />
          {!all ? (
            <Box role="group" aria-label="Advertisers" sx={{ pl: 3 }}>
              {deal.allAdvertisers.map((x) => (
                <FormControlLabel
                  key={x.id}
                  sx={{ display: 'flex' }}
                  control={
                    <Checkbox
                      checked={picked.has(x.id)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(x.id);
                        else next.delete(x.id);
                        setPicked(next);
                        setError(null);
                      }}
                    />
                  }
                  label={x.name}
                />
              ))}
            </Box>
          ) : null}
          {error ? <Typography color="error">{error}</Typography> : null}
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => {
              void (async () => {
                if (!all && picked.size === 0) return setError(INV_MSG.SELECT_ADVERTISER);
                await onSave(
                  { advertiserAccess: all ? null : [...picked] },
                  'Advertiser access was saved',
                );
              })();
            }}
          >
            Save
          </Button>
        </Box>
      ) : (
        <Fact
          label="Partners and Advertisers"
          value={
            a.allAdvertisers
              ? 'All advertisers permissioned'
              : a.advertisers.map((x) => x.name).join(', ') || '-'
          }
        />
      )}
      <Fact label="Default advertiser" value={a.advertisers[0]?.name ?? '-'} />
    </DvSectionCard>
  );
}

function Settings({
  deal,
  writable,
  onSave,
}: {
  deal: DealView;
  writable: boolean;
  onSave: (i: { frequencyCap: FrequencyCapView }, done: string) => Promise<boolean>;
}) {
  const r = deal.row;
  const code = deal.currencyCode;
  const [cap, setCap] = useState<FrequencyCapView>(
    deal.frequencyCap ?? { enabled: false, maxImpressions: null, periodCount: null, period: null },
  );
  const [error, setError] = useState<string | null>(null);
  const asNumber = (v: string) => (v.trim() === '' ? null : Number(v));
  return (
    <>
      {deal.viewOnly ? (
        <DvBanner kind="info" level="inline">
          Inventory is view only. It is editable by users with write access to all advertisers
          assigned to this deal.
        </DvBanner>
      ) : null}
      <DvSectionCard title="Product" layout="stacked">
        <Fact label="Name" value={r.name} />
        <Fact label="Deal ID" value={r.dealId} />
        <Fact label="Status" value={DEAL_STATUS_LABEL[r.status]} />
        <Fact label="Exchange" value={deal.exchangeName} />
        <Fact label="Seller name" value={deal.sellerName} />
        <Fact label="Description" value={deal.description ?? '-'} />
        <Fact label="Allow Pausing" value={r.allowPausing ? 'Yes' : 'No'} />
      </DvSectionCard>
      <DvSectionCard title="Delivery" layout="stacked">
        <Fact label="Delivery method" value={r.deliveryMethod} />
        <Fact
          label="Commitment"
          value={
            r.commitment === 'GUARANTEED'
              ? 'Guaranteed. You and the seller negotiate a price and terms for inventory that is reserved only for you.'
              : 'Non-guaranteed. You receive potential inventory with no reservation.'
          }
        />
        <Fact
          label="Programmatic Guaranteed Direct (BETA)"
          value={deal.pgDirect ? 'On (locked once started)' : 'Off'}
        />
      </DvSectionCard>
      <DvSectionCard title="Rate and volume" layout="stacked">
        <Fact label="Rate type" value={`${r.rateType === 'FIXED' ? 'CPM (Fixed)' : r.rateType}`} />
        <Fact label="Rate" value={`${money(r.rate, code)} CPM`} />
        <Fact label="Cost" value={money(deal.cost, code)} />
        <Fact
          label="Quantity"
          value={r.quantity === null ? '-' : `${num(r.quantity)} impressions`}
        />
      </DvSectionCard>
      <DvSectionCard title="Dates" layout="stacked">
        <Fact label="Start" value={dateTime(r.startAt)} />
        <Fact label="End" value={dateTime(r.endAt)} />
        <Fact label="Day and time" value="No restrictions" />
        <Fact
          label="Frequency cap"
          value={
            writable ? undefined : `${capText(deal.frequencyCap)} (Advanced Frequency Management)`
          }
        />
        {writable ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420, mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={cap.enabled}
                  onChange={(e) => setCap({ ...cap, enabled: e.target.checked })}
                />
              }
              label="Limit impressions per person"
            />
            {cap.enabled ? (
              <>
                <DvTextField
                  label="Max impressions"
                  type="number"
                  value={cap.maxImpressions === null ? '' : String(cap.maxImpressions)}
                  onChange={(v) => setCap({ ...cap, maxImpressions: asNumber(v) })}
                />
                <DvTextField
                  label="Every"
                  type="number"
                  value={cap.periodCount === null ? '' : String(cap.periodCount)}
                  onChange={(v) => setCap({ ...cap, periodCount: asNumber(v) })}
                />
                <DvSelect
                  label="Period"
                  value={cap.period ?? ''}
                  onChange={(v) => setCap({ ...cap, period: v as FrequencyCapView['period'] })}
                  options={[
                    { value: 'DAYS', label: 'Days' },
                    { value: 'WEEKS', label: 'Weeks' },
                    { value: 'MONTHS', label: 'Months' },
                  ]}
                />
              </>
            ) : null}
            {error ? <Typography color="error">{error}</Typography> : null}
            <Box>
              <Button
                variant="contained"
                onClick={() => {
                  void (async () => {
                    const ok = await onSave({ frequencyCap: cap }, 'Frequency cap was saved');
                    setError(ok ? null : 'Check the frequency cap values.');
                  })();
                }}
              >
                Save frequency cap
              </Button>
            </Box>
          </Box>
        ) : null}
      </DvSectionCard>
      <DvSectionCard title="Format" layout="stacked">
        <Fact label="Format" value={FORMAT_LABEL[r.format]} />
        <Fact
          label="Duration"
          value={deal.durationSeconds ? `${deal.durationSeconds} seconds` : '-'}
        />
        <Fact label="Creative source" value={deal.creativeSource} />
        <Fact label="Sizes" value={r.sizes.join(', ') || '-'} />
      </DvSectionCard>
    </>
  );
}
