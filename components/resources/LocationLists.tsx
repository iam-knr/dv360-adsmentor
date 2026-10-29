'use client';

// Location lists (module 15 S6): the list page and the create / edit form. Type is locked on edit (LOC-002); the
// resolution preview (Line, Resolved as, Status) loads after the textarea loses focus.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvEmptyState,
  DvFormFooter,
  DvGrid,
  DvModal,
  DvPageHeader,
  DvRadioGroup,
  DvSectionCard,
  DvTextField,
  focusFirstInvalid,
  type DvColumn,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import {
  createLocationListAction,
  deleteLocationListAction,
  previewLocationsAction,
  updateLocationListAction,
} from '@/lib/resources/actions';
import { countLocationLines } from '@/lib/resources/location';
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import type {
  LocationListRow,
  LocationListTypeKey,
  LocationListView,
  ResolutionRow,
  WireIssue,
} from '@/lib/resources/wire';

export function LocationListsPage({
  partnerId,
  advertiserId,
  rows,
}: {
  partnerId: string;
  advertiserId: string;
  rows: LocationListRow[];
}) {
  const { viewer } = useViewer();
  const [page, setPage] = useState({ page: 1, size: 20 });
  const columns: DvColumn<LocationListRow>[] = [
    {
      id: 'name',
      header: 'Location list name',
      sticky: true,
      cell: (r) => (
        <AppLink href={advertiserPath(partnerId, advertiserId, 'll', r.id)}>{r.name}</AppLink>
      ),
    },
    { id: 'id', header: 'Id', accessor: (r) => r.id },
    {
      id: 'type',
      header: 'Type',
      accessor: (r) => (r.type === 'PROXIMITY' ? 'Proximity' : 'Regional'),
    },
    { id: 'count', header: 'Number of locations', type: 'number', align: 'right' },
    { id: 'lineItems', header: 'Line items', type: 'number', align: 'right' },
  ];
  return (
    <>
      <DvPageHeader
        title="Location lists"
        limitedAccess={viewer.limitedAccess}
        actions={
          <Button
            variant="contained"
            disabled={viewer.readOnly}
            href={advertiserPath(partnerId, advertiserId, 'll', 'new')}
          >
            Create new
          </Button>
        }
      />
      <DvGrid
        ariaLabel="Location lists"
        rows={rows.slice((page.page - 1) * page.size, page.page * page.size)}
        columns={columns}
        getRowId={(r) => r.id}
        page={page.page}
        pageSize={page.size}
        total={rows.length}
        onPageChange={(p, size) => setPage({ page: p, size })}
        emptyState={<DvEmptyState message="No location lists yet" />}
      />
    </>
  );
}

const TYPE_OPTIONS = [
  { value: 'REGIONAL', label: 'Regional Targeting', description: 'Postal codes or DMA regions' },
  {
    value: 'PROXIMITY',
    label: 'Proximity Targeting',
    description: 'Street addresses or latitude and longitude pairs',
  },
];

export function LocationListForm({
  partnerId,
  advertiserId,
  initial,
}: {
  partnerId: string;
  advertiserId: string;
  initial: LocationListView | null;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<LocationListTypeKey | null>(initial?.type ?? null);
  const [entries, setEntries] = useState(initial?.entries ?? '');
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [preview, setPreview] = useState<ResolutionRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = useMemo(
    () =>
      !saved &&
      (name !== (initial?.name ?? '') ||
        type !== (initial?.type ?? null) ||
        entries !== (initial?.entries ?? '')),
    [name, type, entries, initial, saved],
  );
  useUnsavedGuard(dirty);

  const count = countLocationLines(entries);
  const listPath = advertiserPath(partnerId, advertiserId, 'location-lists-v2');
  const refreshPreview = () => {
    if (!type || !entries.trim()) return setPreview([]);
    void previewLocationsAction(advertiserId, { type, entries }).then(setPreview);
  };
  useEffect(() => {
    if (editing) refreshPreview();
    // first paint of an existing list only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const err = (p: string) => issues.find((i) => i.severity === 'error' && i.path === p)?.message;
  const entryIssue = issues.find((i) => i.severity === 'error' && i.path.startsWith('entries'));

  const submit = () =>
    start(async () => {
      const res = editing
        ? await updateLocationListAction(
            initial.id,
            { name, type, entries },
            { expectedVersion: initial.version },
          )
        : await createLocationListAction(advertiserId, { name, type, entries });
      if (!res.ok) {
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setSaved(true);
      router.push(listPath);
      router.refresh();
    });

  const remove = (confirmed: boolean) =>
    start(async () => {
      const res = await deleteLocationListAction(initial!.id, confirmed);
      if (!res.ok) return setIssues(res.issues);
      if (!res.data.deleted) return setConfirmDelete(res.data.usedBy);
      setSaved(true);
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
      <DvSectionCard title="Location list" layout="settings">
        <DvTextField
          label="Location list name"
          required
          value={name}
          readOnly={viewer.readOnly}
          error={err('name')}
          onChange={setName}
          id="location-list-name"
        />
        <DvRadioGroup
          label="Location list"
          value={type ?? ''}
          options={TYPE_OPTIONS}
          disabled={editing || viewer.readOnly}
          error={err('type')}
          onChange={(v) => setType(v as LocationListTypeKey)}
        />
        <DvTextField
          label="Locations"
          multiline
          rows={10}
          placeholder={
            type === 'PROXIMITY'
              ? 'Paste in line separated addresses or latitude,longitude pairs, optionally followed by ; radius in km'
              : 'Paste in line separated postal codes or DMA regions.'
          }
          value={entries}
          readOnly={viewer.readOnly}
          error={
            entryIssue
              ? `Line ${Number(/\[(\d+)\]/.exec(entryIssue.path)?.[1] ?? 0) + 1}: ${entryIssue.message}`
              : undefined
          }
          hint={`${count.toLocaleString('en-US')} locations (up to ${RESOURCE_LIMITS.LOCATION_ENTRIES_MAX.toLocaleString('en-US')})`}
          onChange={setEntries}
          onBlur={refreshPreview}
          id="location-list-entries"
        />
        {preview.length > 0 ? (
          <Box
            component="table"
            aria-label="Resolution preview"
            sx={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <thead>
              <tr>
                <th align="left">Line</th>
                <th align="left">Resolved as</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.line}>
                  <td>{p.line}</td>
                  <td>{p.resolvedAs}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        ) : null}
        {editing && !viewer.readOnly ? (
          <Button color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => remove(false)}>
            Delete list
          </Button>
        ) : null}
      </DvSectionCard>
      {viewer.readOnly ? (
        <Typography variant="body2">You have view-only access to this location list.</Typography>
      ) : (
        <DvFormFooter
          mode={editing ? 'edit' : 'create'}
          dirty={dirty}
          primaryLabel="Save"
          onPrimary={submit}
          onSecondary={() => router.push(listPath)}
          onReset={() => {
            setName(initial?.name ?? '');
            setEntries(initial?.entries ?? '');
            setIssues([]);
          }}
        />
      )}
      <DvModal
        open={confirmDelete !== null}
        title="Delete location list"
        primary={{ label: 'Delete', tone: 'danger', onClick: () => remove(true) }}
        secondary={{ label: 'Cancel', onClick: () => setConfirmDelete(null) }}
        onClose={() => setConfirmDelete(null)}
      >
        {confirmDelete} line items use this list. Deleting it removes it from their targeting.
      </DvModal>
    </Box>
  );
}
