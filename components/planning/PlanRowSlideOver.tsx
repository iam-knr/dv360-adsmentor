'use client';

// Plan line item slide-over (module 04 S4): name, buying method, deal, locations, dates, audience tags, budget, fee,
// max CPM. Apply validates with the PLN rules, then hands the row back to the page's draft.
import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DvSelect, DvSlideOver, DvTextField } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { listPlanDealsAction } from '@/lib/planning/actions';
import { PLAN_COUNTRIES } from '@/lib/planning/countries';
import { planRowIssues } from '@/lib/planning/rules';
import type { PlanDealChoice } from '@/lib/planning/service';
import {
  BUYING_METHODS,
  BUYING_METHOD_LABEL,
  DEAL_METHODS,
  LOCKED_CPM_METHODS,
  type PlanBuyingMethodKey,
  type PlanRowDto,
} from '@/lib/planning/types';
import { DateField } from './DateField';

const num = (s: string): number | null =>
  s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s);

export function PlanRowSlideOver({
  advertiserId,
  row,
  planStart,
  planEnd,
  fee,
  readOnly,
  onApply,
  onCancel,
  onDelete,
}: {
  advertiserId: string;
  row: PlanRowDto | null;
  planStart: string;
  planEnd: string;
  fee: number;
  readOnly: boolean;
  onApply: (row: PlanRowDto) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<PlanRowDto | null>(row);
  const [budget, setBudget] = useState('');
  const [maxCpm, setMaxCpm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deals, setDeals] = useState<PlanDealChoice[]>([]);

  useEffect(() => {
    setDraft(row);
    setBudget(row && row.budgetNet > 0 ? String(row.budgetNet) : '');
    setMaxCpm(row?.maxCpm ? String(row.maxCpm) : '');
    setErrors({});
  }, [row]);
  useEffect(() => {
    if (!row) return;
    let live = true;
    void listPlanDealsAction(advertiserId).then((d) => live && setDeals(d));
    return () => {
      live = false;
    };
  }, [advertiserId, row]);

  if (!draft)
    return (
      <DvSlideOver open={false} title="Plan line item" onCancel={onCancel}>
        {null}
      </DvSlideOver>
    );
  const set = (patch: Partial<PlanRowDto>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const method = draft.buyingMethod;
  const needsDeal = DEAL_METHODS.includes(method);
  const locked = LOCKED_CPM_METHODS.includes(method);

  const apply = () => {
    const issues = planRowIssues(
      {
        name: draft.name,
        buyingMethod: method,
        dealId: draft.dealId,
        start: draft.startDate,
        end: draft.endDate,
        budgetNet: num(budget),
        maxCpm: method === 'OPEN_AUCTION' ? num(maxCpm) : null,
        planStart,
        planEnd,
      },
      0,
    );
    if (issues.length) {
      setErrors(
        Object.fromEntries(issues.map((i) => [i.path.replace(/^rows\.0\./, ''), i.message])),
      );
      return;
    }
    const net = num(budget) ?? 0;
    onApply({
      ...draft,
      name: draft.name.trim(),
      budgetNet: net,
      budgetTotal: Math.round(net * (1 + fee) * 100) / 100,
      feePct: fee,
      maxCpm: method === 'OPEN_AUCTION' ? num(maxCpm) : null,
      isCpmLocked: locked,
      pricing: method === 'OPEN_AUCTION' || method === 'PRIVATE_AUCTION' ? 'Auction' : 'Fixed',
      dealId: needsDeal ? draft.dealId : null,
      locations: draft.locations,
    });
  };

  return (
    <DvSlideOver
      open
      width="wide"
      title="Plan line item"
      dirty
      onApply={readOnly ? undefined : apply}
      onCancel={onCancel}
      {...(readOnly ? {} : { onDelete })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 4 }}>
        <DvTextField
          label="Name"
          required
          value={draft.name}
          maxLength={200}
          disabled={readOnly}
          error={errors.name}
          onChange={(v) => set({ name: v })}
        />
        <DvSelect
          label="Buying method"
          value={method}
          disabled={readOnly}
          options={BUYING_METHODS.map((m) => ({ value: m, label: BUYING_METHOD_LABEL[m] }))}
          onChange={(v) => set({ buyingMethod: v as PlanBuyingMethodKey, dealId: null })}
        />
        {needsDeal ? (
          <DvSelect
            label="Deal"
            required
            value={draft.dealId ?? ''}
            disabled={readOnly}
            placeholder="Select a deal"
            error={errors.dealId}
            options={deals.map((d) => ({ value: d.id, label: d.name, secondLine: d.dealType }))}
            onChange={(v) => set({ dealId: v })}
          />
        ) : null}
        <Autocomplete
          multiple
          size="small"
          disabled={readOnly}
          options={PLAN_COUNTRIES.map((c) => c.code)}
          getOptionLabel={(c) => PLAN_COUNTRIES.find((x) => x.code === c)?.name ?? c}
          value={draft.locations}
          onChange={(_e, v) => set({ locations: v })}
          renderInput={(p) => <TextField {...p} label="Locations" />}
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <DateField
            label="Start date"
            value={draft.startDate}
            disabled={readOnly}
            error={errors['dates'] ?? errors['dates.start']}
            onChange={(v) => set({ startDate: v })}
          />
          <DateField
            label="End date"
            value={draft.endDate}
            disabled={readOnly}
            error={errors['dates.end']}
            onChange={(v) => set({ endDate: v })}
          />
        </Box>
        <DvTextField
          label="Audience tags"
          hint="Comma separated. Each tag narrows the addressable audience."
          value={draft.audienceRefs.join(', ')}
          disabled={readOnly}
          onChange={(v) =>
            set({
              audienceRefs: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <DvTextField
          label="Budget (net)"
          required
          numeric
          value={budget}
          disabled={readOnly}
          error={errors.budgetNet}
          onChange={setBudget}
        />
        <DvTextField
          label="Fee"
          value={`${(fee * 100).toFixed(0)}%`}
          readOnly
          hint="Media and platform fee used to calculate the gross budget."
        />
        {method === 'OPEN_AUCTION' ? (
          <DvTextField
            label="Max CPM"
            numeric
            value={maxCpm}
            disabled={readOnly}
            error={errors.maxCpm}
            onChange={setMaxCpm}
          />
        ) : null}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DvIcon name={locked ? 'lock' : 'tune'} size={18} />
          <Typography variant="body2">
            {locked ? 'CPM locked by the buying method.' : 'CPM follows the auction.'}
          </Typography>
        </Box>
      </Box>
    </DvSlideOver>
  );
}
