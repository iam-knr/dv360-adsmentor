'use client';

// New user and Edit user (module 02 2.9, S9 and S10): name, email, type and an Access list. Each access row is a
// partner or advertiser with its own role. Edit adds "Remove user" (confirm dialog).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvFormFooter,
  DvModal,
  DvPickerDialog,
  DvSectionCard,
  DvSelect,
  DvTextField,
  focusFirstInvalid,
  useToast,
} from '@/components/dv';
import { DvIcon } from '@/components/icons';
import { confirmLeave, useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { createUserAction, deleteUserAction, updateUserAction } from '@/lib/settings/actions';
import { DV_ROLE_LABEL, DV_ROLE_ORDER } from '@/lib/settings/constants';
import type { UserRow, UsersPage } from '@/lib/settings/users';
import { errorMap, SettingsPage } from './shared';

type Scopes = Pick<UsersPage, 'partners' | 'advertisers' | 'canManage' | 'limitedAccess'>;
interface Row {
  key: string; // "p:<id>" or "a:<id>"
  role: string;
}

const keyOf = (a: { partnerId: string | null; advertiserId: string | null }) =>
  a.advertiserId ? `a:${a.advertiserId}` : `p:${a.partnerId}`;

export function UserForm({ page, user }: { page: Scopes; user?: UserRow }) {
  const router = useRouter();
  const toast = useToast();
  const edit = Boolean(user);
  const initialRows: Row[] = (user?.access ?? []).map((a) => ({ key: keyOf(a), role: a.role }));
  const [saved] = useState({ name: user?.name ?? '', email: user?.email ?? '', rows: initialRows });
  const [name, setName] = useState(saved.name);
  const [email, setEmail] = useState(saved.email);
  const [rows, setRows] = useState<Row[]>(saved.rows);
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(
    () => JSON.stringify({ name, email, rows }) !== JSON.stringify(saved),
    [name, email, rows, saved],
  );
  useUnsavedGuard(dirty && !saving);
  const ro = !page.canManage;
  const valid = rows.length > 0 && rows.every((r) => r.role);

  const items = [
    ...page.partners.map((p) => ({
      id: `p:${p.id}`,
      label: p.name,
      secondLine: `Partner ${p.publicId}`,
    })),
    ...page.advertisers.map((a) => ({
      id: `a:${a.id}`,
      label: a.name,
      secondLine: `Advertiser ${a.publicId}`,
    })),
  ];
  const labelOf = (key: string) => items.find((i) => i.id === key);
  const leave = () => confirmLeave(() => router.push('/users'));

  const submit = async () => {
    setSaving(true);
    setBanner(null);
    const access = rows.map((r) => ({
      partnerId: r.key.startsWith('p:') ? r.key.slice(2) : null,
      advertiserId: r.key.startsWith('a:') ? r.key.slice(2) : null,
      role: r.role,
    }));
    const res = user
      ? await updateUserAction(user.id, { name, access }, note.trim() || undefined)
      : await createUserAction({ name, email, access }, note.trim() || undefined);
    if (res.ok) {
      setErrors({});
      toast.show({ kind: 'neutral', message: edit ? 'User saved' : 'User added' });
      // Leave without the unsaved prompt: the form is saved.
      setSaving(true);
      router.push('/users');
      return;
    }
    setSaving(false);
    if (res.code === 'FORBIDDEN') setBanner('You need admin access to manage users.');
    else if (res.code === 'NOT_FOUND') setBanner('This user no longer exists.');
    else {
      setErrors(errorMap(res.issues));
      requestAnimationFrame(() => focusFirstInvalid());
    }
  };

  const remove = async () => {
    if (!user) return;
    const res = await deleteUserAction(user.id);
    setConfirmRemove(false);
    if (res.ok) {
      setSaving(true);
      toast.show({ kind: 'neutral', message: 'User removed' });
      router.push('/users');
    } else if (res.code === 'INVALID') {
      setErrors(errorMap(res.issues));
    } else setBanner('The user was not removed.');
  };

  return (
    <>
      <SettingsPage title={edit ? 'Edit user' : 'New user'} limited={page.limitedAccess}>
        {banner ? (
          <DvBanner kind="error" level="inline">
            {banner}
          </DvBanner>
        ) : null}
        {errors.access && rows.length > 0 ? (
          <DvBanner kind="error" level="inline">
            {errors.access}
          </DvBanner>
        ) : null}
        <DvSectionCard title="User" layout="settings">
          <DvTextField
            label="Name"
            required
            value={name}
            disabled={ro}
            error={errors.name ?? ''}
            onChange={setName}
          />
          <DvTextField
            label="Email"
            type="email"
            placeholder="name@example.com"
            required
            value={email}
            locked={edit}
            disabled={ro}
            error={errors.email ?? ''}
            onChange={setEmail}
          />
          <DvTextField label="Type" value="Partner & advertiser" locked />
        </DvSectionCard>
        <DvSectionCard title="Access" layout="settings">
          {rows.length === 0 ? (
            <Typography
              variant="body2"
              role={errors.access ? 'alert' : undefined}
              color={errors.access ? 'error' : undefined}
            >
              You can give users different roles for each advertiser or partner they have access to
            </Typography>
          ) : (
            rows.map((r, i) => {
              const item = labelOf(r.key);
              return (
                <Box
                  key={r.key}
                  data-testid="access-row"
                  sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1">{item?.label ?? r.key}</Typography>
                    <Typography variant="caption">{item?.secondLine}</Typography>
                  </Box>
                  <Box sx={{ width: 200 }}>
                    <DvSelect
                      ariaLabel={`Role for ${item?.label ?? r.key}`}
                      value={r.role}
                      placeholder="Select a role"
                      disabled={ro}
                      error={errors[`access[${i}].role`] ?? ''}
                      options={DV_ROLE_ORDER.map((v) => ({ value: v, label: DV_ROLE_LABEL[v] }))}
                      onChange={(v) =>
                        setRows((all) => all.map((x, j) => (j === i ? { ...x, role: v } : x)))
                      }
                    />
                  </Box>
                  <IconButton
                    aria-label={`Remove access to ${item?.label ?? r.key}`}
                    disabled={ro}
                    onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                  >
                    <DvIcon name="delete" size={20} />
                  </IconButton>
                </Box>
              );
            })
          )}
          <Box>
            <Button variant="outlined" disabled={ro} onClick={() => setPicker(true)}>
              Add partners or advertisers
            </Button>
          </Box>
        </DvSectionCard>
        {edit && !ro ? (
          <Box>
            <Button color="error" variant="outlined" onClick={() => setConfirmRemove(true)}>
              Remove user
            </Button>
          </Box>
        ) : null}
      </SettingsPage>
      {ro ? null : (
        <DvFormFooter
          mode="create"
          primaryLabel="Save"
          primaryDisabled={!valid || saving}
          dirty={dirty}
          onPrimary={() => void submit()}
          onSecondary={leave}
          note={note}
          onNoteChange={setNote}
        />
      )}
      {picker ? (
        <DvPickerDialog
          open
          title="Select partners and advertisers"
          items={items}
          value={rows.map((r) => r.key)}
          applyLabel="Select"
          onCancel={() => setPicker(false)}
          onApply={(ids) => {
            setRows((old) =>
              ids.map((id) => old.find((r) => r.key === id) ?? { key: id, role: '' }),
            );
            setPicker(false);
          }}
        />
      ) : null}
      <DvModal
        open={confirmRemove}
        title="Remove user"
        primary={{ label: 'Remove', tone: 'danger', onClick: () => void remove() }}
        secondary={{ label: 'Cancel', onClick: () => setConfirmRemove(false) }}
        onClose={() => setConfirmRemove(false)}
      >
        <Typography variant="body2">
          {user?.name} will lose access to the partners and advertisers in this sandbox.
        </Typography>
      </DvModal>
    </>
  );
}
