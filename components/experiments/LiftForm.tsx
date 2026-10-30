'use client';

// New lift study and Review and fix (module 17 S7, S9): name, insertion orders with the eligible-only picker, lift types,
// Brand lift survey fields, study strength, search term groups and the Measurement eligibility rail.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputBase from '@mui/material/InputBase';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { DvBanner, DvRadioGroup, DvSectionCard, DvTextField, focusFirstInvalid, useToast } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import {
  createLiftStudyAction,
  eligibleIosAction,
  liftEligibilityAction,
  updateLiftStudyAction,
} from '@/lib/experiments/actions';
import { LS_MAX_GROUPS, LS_NAME_MAX } from '@/lib/experiments/constants';
import { liftStudiesPath } from '@/lib/experiments/paths';
import { lsIssues } from '@/lib/experiments/rules';
import type { EligibilityResult, EligibleIo } from '@/lib/experiments/lift-service';
import type { BrandLiftInput, LiftStudyInput, LiftStudyView } from '@/lib/experiments/types';
import { confirmLeave, useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { MSG } from '@/lib/validation/messages';
import { BrandLiftFields, emptyBrandLift } from './BrandLiftFields';
import { fmtDay, money } from './format';

type LiftType = 'BRAND_LIFT' | 'SEARCH_LIFT';

export function LiftForm({
  partnerId,
  advertiserId,
  mode,
  initial,
}: {
  partnerId: string;
  advertiserId: string;
  mode: 'create' | 'edit';
  initial?: LiftStudyView;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [group, setGroup] = useState<'YOUTUBE_PG' | 'OTHER'>(initial?.ioGroup ?? 'OTHER');
  const [ios, setIos] = useState<{ id: string; publicId: string; name: string }[]>(initial?.ios ?? []);
  const [types, setTypes] = useState<LiftType[]>(initial?.liftTypes ?? []);
  const [brand, setBrand] = useState<BrandLiftInput>(initial?.brandLift ?? emptyBrandLift());
  const [strength, setStrength] = useState<'STANDARD' | 'ENHANCED'>(initial?.strength ?? 'STANDARD');
  const [groups, setGroups] = useState<string[]>(initial?.searchGroups.map((g) => g.join(', ')) ?? ['']);
  const [elig, setElig] = useState<EligibilityResult | null>(null);
  const [picker, setPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [busy, start] = useTransition();
  useUnsavedGuard(dirty);
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setDirty(true);
    set(v);
  };

  const ioIds = ios.map((i) => i.id);
  useEffect(() => {
    if (ioIds.length === 0) return setElig(null);
    let live = true;
    void liftEligibilityAction(advertiserId, { ioIds, types: ['BRAND_LIFT', 'SEARCH_LIFT'], strength }).then((r) => live && setElig(r));
    return () => {
      live = false;
    };
  }, [advertiserId, ioIds.join(','), strength]); // eslint-disable-line react-hooks/exhaustive-deps

  const per = (t: LiftType) => elig?.perType.find((p) => p.type === t);
  const eligibleIos = (elig?.eligibleIoCount ?? 0) > 0;
  const locked = mode === 'edit';

  const input = (): LiftStudyInput => ({
    name,
    ioIds,
    ioGroup: group,
    liftTypes: types,
    brandLift: brand,
    strength,
    searchGroups: groups.map((g) => g.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)).filter((g) => g.length),
    ...(initial ? { version: initial.version } : {}),
  });

  const apply = (issues: { path: string; severity: string; message: string }[]) => {
    const errs: Record<string, string> = {};
    for (const i of issues.filter((x) => x.severity === 'error')) if (!errs[i.path]) errs[i.path] = i.message;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () =>
    start(async () => {
      setFormError(undefined);
      const local = lsIssues(input(), {
        mode,
        groups: { yt: group === 'YOUTUBE_PG' ? ioIds.length : 0, other: group === 'OTHER' ? ioIds.length : 0 },
        eligibleIoCount: elig?.eligibleIoCount ?? 0,
        perType: (elig?.perType ?? []).map((p) => ({ type: p.type, measurableLis: p.measurableLis, eligible: p.eligible })),
        allMeasurableYoutube: elig?.allMeasurableYoutube ?? false,
        ...(initial ? { originalTypes: initial.liftTypes } : {}),
      });
      if (!apply(local)) {
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      const res =
        mode === 'create'
          ? await createLiftStudyAction(advertiserId, input())
          : await updateLiftStudyAction(advertiserId, initial?.publicId ?? '', input());
      if (!res.ok) {
        apply(res.issues);
        setFormError(res.issues[0]?.message);
        return;
      }
      setDirty(false);
      toast.show({ message: mode === 'create' ? 'Lift study created.' : 'Changes saved.' });
      router.push(liftStudiesPath(partnerId, advertiserId));
    });

  const typeRow = (t: LiftType, label: string, supported: string, tip?: string) => {
    const e = per(t);
    const disabled = locked || !eligibleIos || (e?.measurableLis ?? 0) === 0;
    return (
      <Box component="tr" key={t}>
        <td>
          <FormControlLabel
            control={
              <Checkbox
                checked={types.includes(t)}
                disabled={disabled}
                onChange={(_e, v) => touch(setTypes)(v ? [...types, t] : types.filter((x) => x !== t))}
              />
            }
            label={label}
          />
        </td>
        <td>{supported}</td>
        <td data-testid={`measurable-${t}`}>{e ? e.measurableLis : '-'}</td>
        {tip ? <td /> : null}
      </Box>
    );
  };

  const rail = (
    <Box component="aside" aria-label="Measurement eligibility" sx={{ width: 300, flexShrink: 0, border: 1, borderColor: 'divider', borderRadius: 1, p: 2, alignSelf: 'flex-start', display: { xs: 'none', lg: 'block' } }} data-testid="eligibility-rail">
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Measurement eligibility
      </Typography>
      {!elig ? (
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          <li>At least one insertion order with YouTube, Demand Gen, Display, Audio or Video line items</li>
          <li>Enough media cost for the lift window</li>
        </Box>
      ) : (
        (['BRAND_LIFT', 'SEARCH_LIFT'] as LiftType[]).map((t) => {
          const e = per(t);
          if (!e) return null;
          return (
            <Box key={t} sx={{ mb: 2 }} data-testid={`elig-${t}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">{t === 'BRAND_LIFT' ? 'Brand lift' : 'Search lift'}</Typography>
                <Chip size="small" color={e.eligible ? 'success' : 'warning'} label={e.eligible ? 'Eligible' : 'Not eligible'} />
              </Box>
              <Typography variant="body2" data-testid={`required-${t}`}>{`Required media cost: ${money(e.requiredMediaCost, elig.currency)}`}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{`Spend between ${fmtDay(e.window[0])} and ${fmtDay(e.window[1])}`}</Typography>
              <Typography variant="body2" data-testid={`yours-${t}`}>{`Your media cost: ${money(e.yourMediaCost, elig.currency)}`}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{`Based on ${ios.length} Insertion Order${ios.length === 1 ? '' : 's'}`}</Typography>
            </Box>
          );
        })
      )}
      {types.includes('SEARCH_LIFT') ? (
        <Typography variant="caption" color="text.secondary">
          To increase the potential of detecting search lift, follow budget recommendations. Review search lift budget recommendations.
        </Typography>
      ) : null}
    </Box>
  );

  const dyn = useMemo(() => groups, [groups]);
  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }} data-testid="lift-form">
        {formError ? (
          <DvBanner kind="error" level="inline">
            {formError}
          </DvBanner>
        ) : null}
        <DvSectionCard title="Lift study name" layout="stacked">
          <Box sx={{ maxWidth: 560 }}>
            <DvTextField label="Lift study name" required value={name} maxLength={LS_NAME_MAX} onChange={touch(setName)} {...(errors.name ? { error: errors.name } : {})} />
          </Box>
        </DvSectionCard>
        <DvSectionCard title="Insertion orders" layout="stacked">
          <Button variant="outlined" onClick={() => setPicker(true)}>
            Select insertion orders
          </Button>
          {errors.ioIds ? (
            <Typography role="alert" color="error" variant="body2" sx={{ mt: 1 }} data-testid="io-error">
              {errors.ioIds}
            </Typography>
          ) : null}
          {ios.length ? (
            <Box component="table" aria-label="Selected insertion orders" sx={{ mt: 2, width: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' } }}>
              <thead>
                <tr>
                  <th scope="col">Insertion orders</th>
                  <th scope="col">ID</th>
                </tr>
              </thead>
              <tbody>
                {ios.map((io) => (
                  <tr key={io.id}>
                    <td>{io.name}</td>
                    <td>{io.publicId}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          ) : null}
        </DvSectionCard>
        <DvSectionCard title="Lift types" layout="stacked">
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' } }}>
            <thead>
              <tr>
                <th scope="col">Lift type</th>
                <th scope="col">Measurable line item types</th>
                <th scope="col">Measurable line items</th>
              </tr>
            </thead>
            <tbody>
              {typeRow('BRAND_LIFT', 'Brand lift', 'YouTube, Demand Gen, Display, Audio, Video')}
              {typeRow('SEARCH_LIFT', 'Search lift', 'YouTube, Demand Gen')}
            </tbody>
          </Box>
          {errors.liftTypes ? (
            <Typography role="alert" color="error" variant="body2" sx={{ mt: 1 }}>
              {errors.liftTypes}
            </Typography>
          ) : null}
          {!eligibleIos ? (
            <Typography variant="caption" color="text.secondary">
              {MSG.LS_SELECT_IO}
            </Typography>
          ) : null}
        </DvSectionCard>
        {types.length ? (
          <>
            <BrandLiftFields value={brand} onChange={touch(setBrand)} errors={errors} />
            <DvSectionCard title="Study strength" layout="stacked">
              <DvRadioGroup
                label="Study strength"
                value={strength}
                onChange={(v) => touch(setStrength)(v as 'STANDARD' | 'ENHANCED')}
                options={[
                  { value: 'STANDARD', label: 'Standard lift', description: 'Measures lift of 2% and above' },
                  { value: 'ENHANCED', label: 'Enhanced lift', description: 'YouTube only, requires 3× budget. Detects lift of 1.2% and above' },
                ]}
                {...(errors.strength ? { error: errors.strength } : {})}
              />
            </DvSectionCard>
          </>
        ) : null}
        {types.includes('SEARCH_LIFT') ? (
          <DvSectionCard title="Search lift" layout="stacked">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Search terms will be generated from your Brand Lift survey above.
            </Typography>
            {dyn.map((g, i) => (
              <Box key={i} sx={{ mb: 1, maxWidth: 560 }}>
                <DvTextField
                  label={`Group ${i + 1}: search terms (separate with a comma)`}
                  value={g}
                  onChange={(v) => touch(setGroups)(groups.map((x, j) => (j === i ? v : x)))}
                  {...(i === 0 && errors.searchGroups ? { error: errors.searchGroups } : {})}
                />
              </Box>
            ))}
            <Button disabled={groups.length >= LS_MAX_GROUPS} startIcon={<DvIcon name="add" size={18} />} onClick={() => touch(setGroups)([...groups, ''])}>
              Add another group
            </Button>
          </DvSectionCard>
        ) : null}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={submit} disabled={busy}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
          <Button onClick={() => confirmLeave(() => router.push(liftStudiesPath(partnerId, advertiserId)))} disabled={busy}>
            Cancel
          </Button>
        </Box>
      </Box>
      {rail}
      {picker ? (
        <IoPicker
          advertiserId={advertiserId}
          group={group}
          selected={ios}
          onCancel={() => setPicker(false)}
          onSelect={(g, rows) => {
            setDirty(true);
            setGroup(g);
            setIos(rows);
            setPicker(false);
          }}
        />
      ) : null}
    </Box>
  );
}

function IoPicker({
  advertiserId,
  group,
  selected,
  onSelect,
  onCancel,
}: {
  advertiserId: string;
  group: 'YOUTUBE_PG' | 'OTHER';
  selected: { id: string; publicId: string; name: string }[];
  onSelect: (g: 'YOUTUBE_PG' | 'OTHER', rows: { id: string; publicId: string; name: string }[]) => void;
  onCancel: () => void;
}) {
  const [g, setG] = useState(group);
  const [only, setOnly] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<EligibleIo[]>([]);
  const [picked, setPicked] = useState(selected);
  useEffect(() => {
    let live = true;
    void eligibleIosAction(advertiserId, { group: g, onlyEligible: only, q }).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [advertiserId, g, only, q]);
  const has = (id: string) => picked.some((p) => p.id === id);
  return (
    <Dialog open onClose={onCancel} maxWidth="md" fullWidth aria-labelledby="lift-io-picker">
      <DialogTitle id="lift-io-picker">Select insertion orders</DialogTitle>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, minHeight: 340 }}>
        <Box>
          <Typography variant="subtitle2">Insertion order containing</Typography>
          <RadioGroup
            value={g}
            onChange={(e) => {
              setG(e.target.value as 'YOUTUBE_PG' | 'OTHER');
              setPicked([]);
            }}
            aria-label="Insertion order containing"
          >
            <FormControlLabel value="YOUTUBE_PG" control={<Radio />} label="YouTube programmatic guaranteed" />
            <FormControlLabel value="OTHER" control={<Radio />} label="All other insertion orders" />
          </RadioGroup>
          <FormControlLabel control={<Switch checked={only} onChange={(_e, v) => setOnly(v)} />} label="Show only eligible insertion orders" />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, my: 1 }}>
            <DvIcon name="search" size={18} />
            <InputBase fullWidth placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} inputProps={{ 'aria-label': 'Search' }} />
          </Box>
          <Box role="group" aria-label="Insertion orders" sx={{ maxHeight: 220, overflow: 'auto' }}>
            {rows.map((r) => (
              <FormControlLabel
                key={r.id}
                sx={{ display: 'flex' }}
                control={<Checkbox checked={has(r.id)} onChange={() => setPicked((p) => (has(r.id) ? p.filter((x) => x.id !== r.id) : [...p, { id: r.id, publicId: r.publicId, name: r.name }]))} />}
                label={`${r.name} (${r.publicId})`}
              />
            ))}
            {rows.length === 0 ? <Typography color="text.secondary">No results.</Typography> : null}
          </Box>
        </Box>
        <Box sx={{ borderLeft: 1, borderColor: 'divider', pl: 3 }}>
          <Typography variant="subtitle2">{picked.length ? `${picked.length} selected` : 'None selected'}</Typography>
          {picked.map((p) => (
            <Typography key={p.id} variant="body2">{`${p.name} (${p.publicId})`}</Typography>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onSelect(g, picked)}>
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
}
