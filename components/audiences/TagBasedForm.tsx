'use client';

// Tag-based audience (module 14 S6): name, Floodlight activity with remarketing, custom variable rules, duration.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { DvSectionCard, DvSelect, DvTextField } from '@/components/dv';
import { DvIcon } from '@/components/icons';
import type { AudienceLookups, TagRuleDraft } from '@/lib/audiences/wire';
import { AudienceFormShell } from './FormShell';
import { useAudienceSave } from './useAudienceSave';

const OPERATORS = [
  { value: 'EQUALS', label: 'equals' },
  { value: 'NOT_EQUALS', label: 'does not equal' },
  { value: 'CONTAINS', label: 'contains' },
  { value: 'STARTS_WITH', label: 'starts with' },
  { value: 'GREATER_THAN', label: 'is greater than' },
  { value: 'LESS_THAN', label: 'is less than' },
];

export function TagBasedForm({
  partnerId,
  advertiserId,
  lookups,
}: {
  partnerId: string;
  advertiserId: string;
  lookups: AudienceLookups;
}) {
  const [name, setName] = useState('');
  const [activity, setActivity] = useState('');
  const [rules, setRules] = useState<TagRuleDraft[]>([]);
  const [days, setDays] = useState('30');
  const dirty = name !== '' || activity !== '' || rules.length > 0 || days !== '30';
  const s = useAudienceSave(partnerId, advertiserId, 'TAG_BASED', dirty);

  const patch = (i: number, p: Partial<TagRuleDraft>) =>
    setRules(rules.map((r, n) => (n === i ? { ...r, ...p } : r)));

  return (
    <AudienceFormShell
      dirty={dirty}
      pending={s.pending}
      warnings={s.warn}
      onCancel={s.cancel}
      onSave={() =>
        s.save({ kind: 'TAG_BASED', name, floodlightActivityId: activity || null, rules, membershipDays: days })
      }
    >
      <DvSectionCard title="Audience details" layout="settings">
        <DvTextField
          id="audience-name"
          label="Audience name"
          required
          maxLength={255}
          value={name}
          onChange={setName}
          error={s.err('name')}
        />
      </DvSectionCard>
      <DvSectionCard title="Floodlight activity" layout="settings">
        <DvSelect
          id="audience-activity"
          label="Floodlight activity"
          required
          searchable
          value={activity}
          onChange={setActivity}
          placeholder="Select a Floodlight activity"
          error={s.err('floodlightActivityId')}
          options={lookups.activities.map((a) => ({
            value: a.id,
            label: a.name,
            secondLine: `ID ${a.id} · ${a.type} · ${a.counting}${a.remarketing ? '' : ' · Remarketing is off'}`,
            disabled: !a.remarketing,
          }))}
        />
      </DvSectionCard>
      <DvSectionCard title="Custom variables" description="Narrow the list to people whose Floodlight variables match." layout="settings">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rules.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <DvSelect
                ariaLabel={`Variable ${i + 1}`}
                value={r.variableKey}
                placeholder="Select variable"
                onChange={(v) => patch(i, { variableKey: v })}
                options={lookups.variables.map((v) => ({ value: v.key, label: `${v.key} · ${v.name}` }))}
              />
              <DvSelect
                ariaLabel={`Operator ${i + 1}`}
                value={r.operator}
                onChange={(v) => patch(i, { operator: v as TagRuleDraft['operator'] })}
                options={OPERATORS}
              />
              <DvTextField
                ariaLabel={`Value ${i + 1}`}
                value={r.value}
                placeholder="Value"
                onChange={(v) => patch(i, { value: v })}
                error={s.err(`tagRules[${i}]`)}
              />
              <IconButton aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rules.filter((_, n) => n !== i))}>
                <DvIcon name="close" size={20} />
              </IconButton>
            </Box>
          ))}
          <Button
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setRules([...rules, { variableKey: '', operator: 'EQUALS', value: '' }])}
          >
            Add rule to narrow
          </Button>
        </Box>
      </DvSectionCard>
      <DvSectionCard title="Membership duration" layout="settings">
        <DvTextField
          id="audience-days"
          label="Membership duration (days)"
          type="number"
          value={days}
          onChange={setDays}
          error={s.err('membershipDays')}
          hint="1 to 540 days"
        />
      </DvSectionCard>
    </AudienceFormShell>
  );
}
