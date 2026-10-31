'use client';

// Users (module 02 2.8, S8): "Your profile" and the Users grid (page size 100). New user is for people who hold
// `user.manage`; everyone else sees it disabled.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvGrid, DvSelect, DvTextField, DvTooltip, type DvColumn } from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { DV_ROLE_LABEL, DV_ROLE_ORDER } from '@/lib/settings/constants';
import type { UserRow, UsersPage } from '@/lib/settings/users';
import { SettingsPage } from './shared';

const ALL = 'ALL';

export function userHref(id: string): string {
  return `/users/${encodeURIComponent(id)}`;
}

export function UsersView({ data }: { data: UsersPage }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState(ALL);
  const [page, setPage] = useState({ page: 1, size: 100 });
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (!needle ||
          r.name.toLowerCase().includes(needle) ||
          r.email.toLowerCase().includes(needle)) &&
        (role === ALL || r.access.some((a) => a.role === role)),
    );
  }, [data.rows, q, role]);

  const columns: DvColumn<UserRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sticky: true,
      cell: (r) => <AppLink href={userHref(r.id)}>{r.name}</AppLink>,
    },
    { id: 'email', header: 'Email', accessor: (r) => r.email },
    { id: 'role', header: 'Role', accessor: (r) => r.roles },
    { id: 'partners', header: 'Partners', accessor: (r) => r.partners },
    { id: 'advertisers', header: 'Advertisers', accessor: (r) => r.advertisers },
  ];
  const profileColumns = columns.map((c) =>
    c.id === 'name' ? { ...c, cell: (r: UserRow) => <span>{r.name}</span> } : c,
  );
  const start = (page.page - 1) * page.size;
  return (
    <SettingsPage title="Users" limited={data.limitedAccess}>
      <Box component="section" aria-label="Your profile">
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          Your profile
        </Typography>
        <DvGrid
          rows={[data.profile]}
          columns={profileColumns}
          ariaLabel="Your profile"
          getRowId={(r) => r.id}
          page={1}
          pageSize={1}
          total={1}
          onPageChange={() => undefined}
        />
      </Box>
      <Box component="section" aria-label="Users">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h2">
              Users
            </Typography>
            <Typography variant="body2">
              Review users who have access to your partners and advertisers.
            </Typography>
          </Box>
          <DvTooltip title={data.canManage ? '' : 'You need admin access to add users.'}>
            <span>
              <Button
                variant="contained"
                disabled={!data.canManage}
                component={data.canManage ? AppLink : 'button'}
                {...(data.canManage ? { href: '/users/new' } : {})}
              >
                New user
              </Button>
            </span>
          </DvTooltip>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box sx={{ width: 320 }}>
            <DvTextField
              ariaLabel="Search users"
              placeholder="Search by name or email"
              value={q}
              onChange={setQ}
            />
          </Box>
          <Box sx={{ width: 200 }}>
            <DvSelect
              ariaLabel="Role"
              value={role}
              onChange={setRole}
              options={[
                { value: ALL, label: 'All roles' },
                ...DV_ROLE_ORDER.map((r) => ({ value: r, label: DV_ROLE_LABEL[r] })),
              ]}
            />
          </Box>
        </Box>
        <DvGrid
          rows={rows.slice(start, start + page.size)}
          columns={columns}
          ariaLabel="Users"
          getRowId={(r) => r.id}
          page={page.page}
          pageSize={page.size}
          pageSizes={[20, 50, 100]}
          total={rows.length}
          onPageChange={(p, size) => setPage({ page: p, size })}
          emptyState={<Typography sx={{ p: 4 }}>No other users have access</Typography>}
        />
      </Box>
    </SettingsPage>
  );
}
