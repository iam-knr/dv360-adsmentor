'use client';

// Combined audience (module 14 S9): Include groups (OR inside a group, AND between groups), one Exclude group and a
// summary card with the expression and the estimate. Available at once after Save (AUD-060).
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { DvPickerDialog, DvSectionCard, DvTextField, type PickerItem } from '@/components/dv';
import { estimateAudienceAction, searchPickerAction } from '@/lib/audiences/actions';
import type { CombinedMemberDraft, PickerRow, SizeCell } from '@/lib/audiences/wire';
import { AudienceFormShell } from './FormShell';
import { SizeBar } from './shared';
import { useAudienceSave } from './useAudienceSave';

const KINDS: { type: Parameters<typeof searchPickerAction>[1]['type']; kind: CombinedMemberDraft['kind']; label: string }[] = [
  { type: 'FIRST_PARTY', kind: 'AUDIENCE', label: 'First-party' },
  { type: 'GOOGLE', kind: 'GOOGLE_AUDIENCE', label: 'Google' },
  { type: 'CUSTOM', kind: 'CUSTOM_LIST', label: 'Custom list' },
  { type: 'COMBINED', kind: 'AUDIENCE', label: 'Combined' },
  { type: 'PARTNER', kind: 'AUDIENCE', label: 'Partner' },
];

type Target = { side: 'INCLUDE'; group: number } | { side: 'EXCLUDE' };
type Summary = { sizes: Record<'display' | 'youtube' | 'mobileApp' | 'ctv', SizeCell>; expression?: string } | 'na' | null;

const key = (m: CombinedMemberDraft) => `${m.kind}:${m.id}`;

export function CombinedForm({ partnerId, advertiserId }: { partnerId: string; advertiserId: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [include, setInclude] = useState<CombinedMemberDraft[][]>([[]]);
  const [exclude, setExclude] = useState<CombinedMemberDraft[]>([]);
  const [catalogue, setCatalogue] = useState<(PickerItem & { member: CombinedMemberDraft })[] | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [summary, setSummary] = useState<Summary>(null);
  const dirty = name !== '' || include.some((g) => g.length) || exclude.length > 0;
  const s = useAudienceSave(partnerId, advertiserId, 'COMBINED', dirty);

  const labels = useMemo(() => new Map((catalogue ?? []).map((c) => [key(c.member), c.label])), [catalogue]);
  const label = (m: CombinedMemberDraft) => labels.get(key(m)) ?? m.id;

  const openPicker = async (t: Target) => {
    if (!catalogue) {
      const lists = await Promise.all(KINDS.map((k) => searchPickerAction(advertiserId, { type: k.type })));
      setCatalogue(
        lists.flatMap((rows: PickerRow[], i) =>
          rows.map((r) => {
            const k = KINDS[i]!;
            const member: CombinedMemberDraft = { kind: k.kind, id: r.id };
            return {
              id: key(member),
              label: r.name,
              secondLine: `${k.label} · ${r.path.slice(0, -1).join(' » ') || r.sizeBucket}`.trim(),
              member,
            };
          }),
        ),
      );
    }
    setTarget(t);
  };

  const apply = (ids: string[]) => {
    const picked = (catalogue ?? []).filter((c) => ids.includes(c.id)).map((c) => c.member);
    if (target?.side === 'INCLUDE') setInclude(include.map((g, i) => (i === target.group ? picked : g)));
    else setExclude(picked);
    setTarget(null);
  };

  useEffect(() => {
    let live = true;
    if (!include.some((g) => g.length)) {
      setSummary('na');
      return;
    }
    void estimateAudienceAction(advertiserId, { kind: 'COMBINED', draft: { include, exclude } }).then((r) => {
      if (live) setSummary('unavailable' in r ? 'na' : r);
    });
    return () => {
      live = false;
    };
  }, [advertiserId, include, exclude]);

  const current: string[] =
    target?.side === 'INCLUDE' ? (include[target.group] ?? []).map(key) : target?.side === 'EXCLUDE' ? exclude.map(key) : [];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 4, alignItems: 'start' }}>
      <AudienceFormShell
        dirty={dirty}
        pending={s.pending}
        warnings={s.warn}
        onCancel={s.cancel}
        onSave={() => s.save({ kind: 'COMBINED', name, description, draft: { include, exclude } })}
      >
        <DvSectionCard title="Audience details" layout="settings">
          <DvTextField id="audience-name" label="Name" required maxLength={255} value={name} onChange={setName} error={s.err('name')} />
          <DvTextField id="audience-description" label="Description" value={description} onChange={setDescription} />
        </DvSectionCard>
        <DvSectionCard
          title="Include"
          description="Add audiences to combine them. Expand by adding more to a group; intersect groups to narrow."
          layout="stacked"
        >
          {include.map((g, i) => (
            <Box key={i} data-testid="include-group" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
              <Typography variant="subtitle1">{i === 0 ? 'Include' : 'And include'}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                {g.map((m) => (
                  <Chip
                    key={key(m)}
                    size="small"
                    label={label(m)}
                    onDelete={() => setInclude(include.map((x, n) => (n === i ? x.filter((y) => key(y) !== key(m)) : x)))}
                  />
                ))}
              </Box>
              <Button onClick={() => void openPicker({ side: 'INCLUDE', group: i })}>Add</Button>
            </Box>
          ))}
          {s.err('includeGroups') ? (
            <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
              {s.err('includeGroups')}
            </Typography>
          ) : null}
          <Button onClick={() => setInclude([...include, []])}>Add group to narrow</Button>
        </DvSectionCard>
        <DvSectionCard title="Exclude" layout="stacked">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            {exclude.map((m) => (
              <Chip key={key(m)} size="small" label={label(m)} onDelete={() => setExclude(exclude.filter((y) => key(y) !== key(m)))} />
            ))}
          </Box>
          {s.err('excludeIds') ? (
            <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
              {s.err('excludeIds')}
            </Typography>
          ) : null}
          <Button data-testid="exclude-add" onClick={() => void openPicker({ side: 'EXCLUDE' })}>
            Add to exclude
          </Button>
        </DvSectionCard>
      </AudienceFormShell>
      <Box component="aside" aria-label="Summary" data-testid="combined-summary">
        <DvSectionCard title="Summary" layout="stacked">
          {summary && summary !== 'na' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" data-testid="expression">
                {summary.expression}
              </Typography>
              <SizeBar cell={summary.sizes.display} label="Display" />
              <SizeBar cell={summary.sizes.youtube} label="YouTube" />
            </Box>
          ) : (
            <Typography variant="body2">Add audiences to see summary</Typography>
          )}
        </DvSectionCard>
      </Box>
      <DvPickerDialog
        open={target !== null}
        title={target?.side === 'EXCLUDE' ? 'Exclude audiences' : 'Include audiences'}
        items={catalogue ?? []}
        value={current}
        onApply={apply}
        onCancel={() => setTarget(null)}
        searchPlaceholder="Search audiences"
      />
    </Box>
  );
}
