'use client';

// Dialogs of the plan page: Modify columns (S3), Make a copy (S5), Create campaign from plan (S6), Remove plan.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvModal, DvRadioGroup, DvSelect, DvTextField } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import {
  PLAN_COLUMNS,
  PLAN_COLUMN_GROUPS,
  DEFAULT_PLAN_COLUMNS,
  normalizePlanColumns,
} from '@/lib/planning/columns';
import type { PlanCampaignChoice } from '@/lib/planning/service';
import { AD_FORMATS, DEAL_METHODS, type PlanRowDto } from '@/lib/planning/types';
import { PlanDateRange } from './PlanDateRange';

// ---- Modify columns -----------------------------------------------------------------------------

export function ModifyColumnsDialog({
  open,
  value,
  onApply,
  onCancel,
}: {
  open: boolean;
  value: string[];
  onApply: (order: string[]) => void;
  onCancel: () => void;
}) {
  const [order, setOrder] = useState<string[]>(() => normalizePlanColumns(value));
  const [drag, setDrag] = useState<string | null>(null);
  const label = (id: string) => PLAN_COLUMNS.find((c) => c.id === id)?.label ?? id;
  const toggle = (id: string) =>
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const move = (id: string, to: number) =>
    setOrder((o) => {
      const from = o.indexOf(id);
      if (from < 1 || to < 1 || to >= o.length) return o;
      const next = [...o];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  const selectable = PLAN_COLUMNS.filter((c) => !c.locked);

  return (
    <DvModal
      open={open}
      title="Modify columns"
      size="lg"
      onClose={onCancel}
      primary={{ label: 'Apply', onClick: () => onApply(normalizePlanColumns(order)) }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, minHeight: 360 }}>
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button size="small" onClick={() => setOrder(['name', ...selectable.map((c) => c.id)])}>
              Select all
            </Button>
            <Button size="small" onClick={() => setOrder(['name'])}>
              Clear all
            </Button>
            <Button size="small" onClick={() => setOrder([...DEFAULT_PLAN_COLUMNS])}>
              Reset
            </Button>
          </Box>
          {PLAN_COLUMN_GROUPS.map((g) => {
            const cols = selectable.filter((c) => c.group === g.id);
            if (!cols.length) return null;
            return (
              <Box key={g.id} role="group" aria-label={g.label} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2">{g.label}</Typography>
                {cols.map((c) => (
                  <FormControlLabel
                    key={c.id}
                    sx={{ display: 'flex' }}
                    control={
                      <Checkbox
                        size="small"
                        checked={order.includes(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    }
                    label={c.label}
                  />
                ))}
              </Box>
            );
          })}
        </Box>
        <Box>
          <Typography variant="subtitle2">Your columns</Typography>
          <Typography variant="caption" color="text.secondary">
            Drag and drop to reorder
          </Typography>
          <Box
            component="ul"
            aria-label="Your columns"
            sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}
          >
            {order.map((id, i) => (
              <Box
                component="li"
                key={id}
                data-testid="your-column"
                draggable={id !== 'name'}
                onDragStart={() => setDrag(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drag && move(drag, i)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <DvIcon name={id === 'name' ? 'lock' : 'drag_indicator'} size={18} />
                <Typography sx={{ flex: 1 }}>{label(id)}</Typography>
                {id !== 'name' ? (
                  <>
                    <IconButton
                      size="small"
                      aria-label={`Move ${label(id)} up`}
                      disabled={i <= 1}
                      onClick={() => move(id, i - 1)}
                    >
                      <DvIcon name="expand_more" size={18} sx={{ transform: 'rotate(180deg)' }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Move ${label(id)} down`}
                      disabled={i === order.length - 1}
                      onClick={() => move(id, i + 1)}
                    >
                      <DvIcon name="expand_more" size={18} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${label(id)}`}
                      onClick={() => toggle(id)}
                    >
                      <DvIcon name="close" size={18} />
                    </IconButton>
                  </>
                ) : null}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </DvModal>
  );
}

// ---- Copy -----------------------------------------------------------------------------------------

export function CopyPlanDialog({
  open,
  today,
  defaults,
  busy,
  error,
  onCopy,
  onCancel,
}: {
  open: boolean;
  today: string;
  defaults: { name: string; start: string; end: string };
  busy: boolean;
  error?: string | undefined;
  onCopy: (v: { name: string; start: string; end: string }) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(defaults);
  return (
    <DvModal
      open={open}
      title="Make a copy"
      size="md"
      onClose={onCancel}
      {...(error ? { error } : {})}
      primary={{ label: 'Copy', loading: busy, onClick: () => onCopy(v) }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DvTextField
          label="Plan name"
          value={v.name}
          maxLength={100}
          onChange={(name) => setV((s) => ({ ...s, name }))}
        />
        <PlanDateRange
          label="Dates"
          start={v.start}
          end={v.end}
          today={today}
          onChange={(start, end) => setV((s) => ({ ...s, start, end }))}
        />
      </Box>
    </DvModal>
  );
}

// ---- Convert --------------------------------------------------------------------------------------

export function ConvertPlanDialog({
  open,
  planName,
  rowCount,
  campaigns,
  busy,
  error,
  onCreate,
  onCancel,
}: {
  open: boolean;
  planName: string;
  rowCount: number;
  campaigns: PlanCampaignChoice[];
  busy: boolean;
  error?: string | undefined;
  onCreate: (v: { target: 'CAMPAIGN' | 'IO'; campaignId?: string }) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState<'CAMPAIGN' | 'IO'>('CAMPAIGN');
  const [campaignId, setCampaignId] = useState('');
  return (
    <DvModal
      open={open}
      title="Create campaign from plan"
      size="md"
      onClose={onCancel}
      {...(error ? { error } : {})}
      primary={{
        label: 'Create',
        loading: busy,
        onClick: () => onCreate(target === 'IO' ? { target, campaignId } : { target }),
      }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DvRadioGroup
          label="Create"
          value={target}
          onChange={(v) => setTarget(v as 'CAMPAIGN' | 'IO')}
          options={[
            { value: 'CAMPAIGN', label: 'New campaign' },
            {
              value: 'IO',
              label: 'New insertion order in an existing campaign',
              disabled: campaigns.length === 0,
            },
          ]}
        />
        {target === 'IO' ? (
          <DvSelect
            label="Campaign"
            value={campaignId}
            placeholder="Select a campaign"
            options={campaigns.map((c) => ({ value: c.publicId, label: c.name }))}
            onChange={setCampaignId}
          />
        ) : null}
        <Typography variant="body2" data-testid="convert-summary">
          {`${target === 'CAMPAIGN' ? `Campaign "${planName}", ` : ''}insertion order "${planName} IO" and ${rowCount} line item draft${rowCount === 1 ? '' : 's'} will be created.`}
        </Typography>
      </Box>
    </DvModal>
  );
}

// ---- Remove ---------------------------------------------------------------------------------------

export function RemovePlanDialog({
  open,
  name,
  busy,
  onRemove,
  onCancel,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  onRemove: () => void;
  onCancel: () => void;
}) {
  return (
    <DvModal
      open={open}
      title="Remove plan?"
      size="sm"
      onClose={onCancel}
      primary={{ label: 'Remove', tone: 'danger', loading: busy, onClick: onRemove }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Typography>{name} will be removed. This can&apos;t be undone.</Typography>
    </DvModal>
  );
}

// ---- Add ad formats ------------------------------------------------------------------------------

interface FormatLine {
  key: number;
  formatId: string;
  budget: string;
  cpm: string;
}

const FORMATS = AD_FORMATS.filter((f) => !DEAL_METHODS.includes(f.buyingMethod));

/** "Select ad formats" (explore 19 section 3): pricing, ad format, budget, CPM (optional) and share per line. */
export function AdFormatsDialog({
  open,
  currency,
  planStart,
  planEnd,
  location,
  fee,
  onApply,
  onCancel,
}: {
  open: boolean;
  currency: string;
  planStart: string;
  planEnd: string;
  location: string;
  fee: number;
  onApply: (rows: PlanRowDto[]) => void;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState<FormatLine[]>([
    { key: 1, formatId: FORMATS[0]!.id, budget: '', cpm: '' },
  ]);
  const [error, setError] = useState<string | undefined>();
  const set = (key: number, patch: Partial<FormatLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const total = lines.reduce((s, l) => s + (num(l.budget) ?? 0), 0);

  const apply = () => {
    if (lines.some((l) => !((num(l.budget) ?? 0) > 0))) {
      setError('Enter a number greater than 0');
      return;
    }
    onApply(
      lines.map((l, i) => {
        const f = AD_FORMATS.find((x) => x.id === l.formatId)!;
        const net = num(l.budget) ?? 0;
        return {
          id: `fmt-${i}`,
          ordinal: i,
          name: f.label,
          buyingMethod: f.buyingMethod,
          dealId: null,
          locations: [location],
          startDate: planStart,
          endDate: planEnd,
          targeting: {},
          audienceRefs: [],
          budgetNet: net,
          budgetTotal: Math.round(net * (1 + fee) * 100) / 100,
          feePct: fee,
          maxCpm: f.buyingMethod === 'OPEN_AUCTION' ? num(l.cpm) : null,
          isCpmLocked: f.buyingMethod !== 'OPEN_AUCTION',
          pricing: 'Auction',
        } satisfies PlanRowDto;
      }),
    );
  };

  return (
    <DvModal
      open={open}
      title="Select ad formats"
      size="lg"
      onClose={onCancel}
      {...(error ? { error } : {})}
      primary={{ label: 'Apply', onClick: apply }}
      secondary={{ label: 'Cancel', onClick: onCancel }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {lines.map((l) => {
          const share = total > 0 ? Math.round(((num(l.budget) ?? 0) / total) * 100) : 0;
          return (
            <Box
              key={l.key}
              role="group"
              aria-label={`Ad format ${l.key}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 1fr 1fr 80px 40px',
                gap: 2,
                alignItems: 'start',
              }}
            >
              <DvSelect
                label="Ad format"
                value={l.formatId}
                options={FORMATS.map((f) => ({ value: f.id, label: f.label, secondLine: f.group }))}
                onChange={(v) => set(l.key, { formatId: v })}
              />
              <DvTextField
                label={`Budget (${currency})`}
                numeric
                value={l.budget}
                onChange={(v) => set(l.key, { budget: v })}
              />
              <DvTextField
                label={`CPM (Optional)`}
                numeric
                value={l.cpm}
                onChange={(v) => set(l.key, { cpm: v })}
              />
              <Typography variant="body2" sx={{ pt: 4 }}>
                {share}% share
              </Typography>
              <IconButton
                aria-label={`Remove ad format ${l.key}`}
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                sx={{ mt: 3 }}
              >
                <DvIcon name="delete" size={20} />
              </IconButton>
            </Box>
          );
        })}
        <Box>
          <Button
            startIcon={<DvIcon name="add" size={18} />}
            onClick={() =>
              setLines((ls) => [
                ...ls,
                {
                  key: Math.max(...ls.map((x) => x.key)) + 1,
                  formatId: FORMATS[1]!.id,
                  budget: '',
                  cpm: '',
                },
              ])
            }
          >
            Add ad format
          </Button>
        </Box>
        <Typography variant="body2" data-testid="formats-total">
          Total added budget: {total > 0 ? '100%' : '0%'} · Total plan budget {currency}
          {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
      </Box>
    </DvModal>
  );
}
