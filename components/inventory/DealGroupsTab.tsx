'use client';

// My inventory, Deal groups (module 13 S3) and the group slide-over (`?sim_panel=group:new` or `group:{id}`).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import {
  DvBanner,
  DvEmptyState,
  DvGrid,
  DvSelect,
  DvSlideOver,
  DvTextField,
  useToast,
  type DvColumn,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { createDealGroupAction, deleteDealGroupAction, updateDealGroupAction } from '@/lib/inventory/actions';
import type { DealGroupRow } from '@/lib/inventory/types';
import { InventoryHeader } from './InventoryHeader';
import { useParam } from './useParam';
import type { Scope } from '@/lib/inventory/paths';

export interface GroupCandidate {
  kind: 'DEAL' | 'PACKAGE';
  id: string;
  name: string;
}

const TYPE_LABEL = { DEAL_GROUP: 'Deal group', PREFERRED_DEAL_GROUP: 'Preferred deal group' } as const;

function GroupPanel({
  advertiserId,
  group,
  candidates,
  onClose,
}: {
  advertiserId: string;
  group: DealGroupRow | null;
  candidates: GroupCandidate[];
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(group?.name ?? '');
  const [type, setType] = useState<string>(group?.kind ?? '');
  const [members, setMembers] = useState<Set<string>>(new Set(group?.members.map((m) => `${m.kind}:${m.id}`) ?? []));
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | null>(null);

  const apply = async () => {
    const input = {
      name,
      type: (type || null) as 'DEAL_GROUP' | 'PREFERRED_DEAL_GROUP' | null,
      members: [...members].map((k) => {
        const [kind, id] = k.split(':') as ['DEAL' | 'PACKAGE', string];
        return { kind, id };
      }),
    };
    const res = group ? await updateDealGroupAction(advertiserId, group.id, input) : await createDealGroupAction(advertiserId, input);
    if (!res.ok) {
      setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
      return;
    }
    toast.show({ message: group ? `${name.trim()} was saved` : `${name.trim()} was created` });
    router.refresh();
    onClose();
  };

  const shown = candidates.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <DvSlideOver
      open
      title={group ? 'Edit deal group' : 'New deal group'}
      applyLabel={group ? 'Save' : 'Create'}
      onApply={apply}
      onCancel={onClose}
      onDelete={
        group
          ? async () => {
              const res = await deleteDealGroupAction(advertiserId, group.id);
              toast.show(res.ok ? { message: `${group.name} was deleted` } : { kind: 'error', message: res.issues[0]?.message ?? "Couldn't delete the group." });
              router.refresh();
              onClose();
            }
          : undefined
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DvTextField
          label="Name"
          value={name}
          maxLength={255}
          required
          error={errors.name}
          onChange={(v) => {
            setName(v);
            setWarning(null);
          }}
        />
        <DvSelect
          label="Type"
          value={type}
          onChange={setType}
          placeholder="Select a type"
          error={errors.type}
          options={[
            { value: 'DEAL_GROUP', label: TYPE_LABEL.DEAL_GROUP },
            { value: 'PREFERRED_DEAL_GROUP', label: TYPE_LABEL.PREFERRED_DEAL_GROUP },
          ]}
        />
        <Box>
          <DvTextField label="Deals and packages" placeholder="Search" value={search} onChange={setSearch} />
          <Box sx={{ maxHeight: 280, overflow: 'auto', mt: 1 }} role="group" aria-label="Deals and packages">
            {shown.map((c) => (
              <FormControlLabel
                key={`${c.kind}:${c.id}`}
                sx={{ display: 'flex' }}
                control={
                  <Checkbox
                    checked={members.has(`${c.kind}:${c.id}`)}
                    onChange={(e) => {
                      const next = new Set(members);
                      if (e.target.checked) next.add(`${c.kind}:${c.id}`);
                      else next.delete(`${c.kind}:${c.id}`);
                      setMembers(next);
                      setWarning(next.size === 0 ? 'This group has no deals.' : null);
                    }}
                  />
                }
                label={`${c.name} (${c.kind === 'DEAL' ? 'Deal' : 'Package'})`}
              />
            ))}
            {shown.length === 0 ? <Box sx={{ color: 'text.secondary', py: 2 }}>Nothing matches your search.</Box> : null}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{members.size} selected</Box>
        </Box>
        {warning ? <DvBanner kind="warning" level="inline">{warning}</DvBanner> : null}
        {errors.members ? <DvBanner kind="error" level="inline">{errors.members}</DvBanner> : null}
      </Box>
    </DvSlideOver>
  );
}

export function DealGroupsTab({
  scope,
  rows,
  candidates,
  canWrite,
}: {
  scope: Scope;
  rows: DealGroupRow[];
  candidates: GroupCandidate[];
  canWrite: boolean;
}) {
  const { viewer } = useViewer();
  const [panel, setPanel] = useParam('sim_panel');
  const writable = canWrite && !viewer.readOnly;
  const groupId = panel?.startsWith('group:') ? panel.slice('group:'.length) : null;
  const group = groupId && groupId !== 'new' ? (rows.find((r) => r.id === groupId || r.publicId === groupId) ?? null) : null;
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);

  const columns: DvColumn<DealGroupRow>[] = [
    {
      id: 'name',
      header: 'Groups',
      type: 'custom',
      sticky: true,
      width: 280,
      cell: (r) => (
        <Button variant="text" onClick={() => setPanel(`group:${r.id}`)} data-testid="group-link" sx={{ textTransform: 'none', p: 0 }}>
          {r.name}
        </Button>
      ),
    },
    { id: 'type', header: 'Type', accessor: (r) => TYPE_LABEL[r.kind] },
    { id: 'id', header: 'ID', accessor: (r) => r.publicId },
    { id: 'deals', header: 'Deals', type: 'number', accessor: (r) => r.members.length },
  ];

  return (
    <>
      <InventoryHeader
        scope={scope}
        active="groups"
        canWrite={canWrite}
        extraActions={
          writable ? (
            <Button variant="outlined" onClick={() => setPanel('group:new')}>
              New group
            </Button>
          ) : undefined
        }
      />
      <Box sx={{ px: 4, py: 3 }}>
        <DvGrid<DealGroupRow>
          ariaLabel="Deal groups"
          rows={rows.slice((page - 1) * size, page * size)}
          columns={columns}
          getRowId={(r) => r.id}
          page={page}
          pageSize={size}
          total={rows.length}
          onPageChange={(p, s) => {
            setPage(p);
            setSize(s);
          }}
          emptyState={<DvEmptyState variant="illustrated" title="No deal groups yet" message="Create a group to assign several deals to line items at once." />}
        />
      </Box>
      {writable && (groupId === 'new' || group) ? (
        <GroupPanel key={group?.id ?? 'new'} advertiserId={scope.advertiserId} group={group} candidates={candidates} onClose={() => setPanel(null)} />
      ) : null}
    </>
  );
}
