'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvGrid, type DvColumn } from '@/components/dv/DvGrid';
import { DvModal } from '@/components/dv/DvModal';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvTextField } from '@/components/dv/DvTextField';
import Chip from '@mui/material/Chip';
import { bulkAccountsAction } from '@/lib/actions/accounts';
import { bulkSecurityAction } from '@/lib/actions/security';
import { SecurityUnreadLink } from './SecurityWatch';
import { OneTimeSecret } from './OneTimeSecret';

export interface AccountListRow {
  id: string;
  email: string;
  name: string;
  appRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
  cohortName: string | null;
  lastLogin: string;
  sandbox: string;
  isSelf: boolean;
  /** screenshot guard: access suspended after a screenshot attempt */
  suspended?: boolean;
  screenshotsAllowed?: boolean;
}

const ROLE = { USER: 'Student', ADMIN: 'Retired', SUPER_ADMIN: 'Super admin' } as const;
const STATUS = {
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  LOCKED: 'Locked',
  ARCHIVED: 'Archived',
} as const;

type Dialog =
  | null
  | 'disable'
  | 'enable'
  | 'reset'
  | 'delete'
  | 'allowShots'
  | 'disallowShots'
  | 'restoreAccess';

export interface AccountsListProps {
  rows: AccountListRow[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  showArchived: boolean;
  /** the "Suspended only" filter is on */
  suspendedOnly?: boolean;
}

export function AccountsList({
  rows,
  total,
  page,
  pageSize,
  search,
  showArchived,
  suspendedOnly = false,
}: AccountsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [typed, setTyped] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [q, setQ] = useState(search);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<{
    done: number;
    skipped: { id: string; message: string }[];
  } | null>(null);
  const [secrets, setSecrets] = useState<{ email: string; password: string }[] | null>(null);
  const wide = useMediaQuery('(min-width:1380px)', { noSsr: true });

  const go = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(showArchived ? { archived: '1' } : {}),
      ...(suspendedOnly ? { suspended: '1' } : {}),
      page: String(page),
      pageSize: String(pageSize),
    });
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    router.push(`${pathname}?${p.toString()}`);
  };

  const columns: DvColumn<AccountListRow>[] = [
    {
      id: 'name',
      header: 'Name',
      type: 'custom',
      width: 300,
      sticky: true,
      // the email sits under the name so that accounts with the same display name can be told apart
      cell: (r) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, py: 1 }}>
          <Link href={`/manage/accounts/${r.id}`} underline="hover">
            {r.name}
          </Link>
          <Typography variant="caption" color="text.secondary" data-testid="account-email" noWrap>
            {r.email}
          </Typography>
        </Box>
      ),
    },
    { id: 'appRole', header: 'Level', width: 100, accessor: (r) => ROLE[r.appRole] },
    {
      id: 'status',
      header: 'Status',
      width: 190,
      type: 'custom',
      cell: (r) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <span>{STATUS[r.status]}</span>
          {r.suspended ? (
            <Chip
              size="small"
              color="error"
              label="Suspended (screenshot)"
              data-testid="suspended-chip"
            />
          ) : null}
        </Box>
      ),
    },
    { id: 'sandbox', header: 'Sandbox', width: 110 },
    // secondary columns only when there is room: below about 1280 px the table fits without a sideways scroll
    ...(wide
      ? [
          { id: 'cohortName', header: 'Cohort', width: 150 },
          { id: 'lastLogin', header: 'Last sign in', width: 120 },
        ]
      : []),
  ];

  const ids = [...selection];
  const selectedRows = rows.filter((r) => selection.has(r.id));
  const close = () => {
    setDialog(null);
    setTyped('');
    setError(undefined);
  };

  const confirm = () => {
    if (!dialog) return;
    start(async () => {
      if (dialog === 'allowShots' || dialog === 'disallowShots' || dialog === 'restoreAccess') {
        const res = await bulkSecurityAction(
          ids,
          dialog === 'allowShots'
            ? 'ALLOW_SCREENSHOTS'
            : dialog === 'disallowShots'
              ? 'DISALLOW_SCREENSHOTS'
              : 'RESTORE_ACCESS',
        );
        if (!res.ok) {
          setError(res.error);
          return;
        }
        close();
        setSelection(new Set());
        setResult({ done: res.data.done.length, skipped: res.data.skipped });
        router.refresh();
        return;
      }
      const action =
        dialog === 'disable'
          ? ({ type: 'DISABLE' } as const)
          : dialog === 'enable'
            ? ({ type: 'ENABLE' } as const)
            : dialog === 'delete'
              ? ({ type: 'DELETE', confirm: typed } as const)
              : ({
                  type: 'RESET_PASSWORD',
                  mode: 'GENERATE',
                  mustChangePassword: mustChange,
                } as const);
      const res = await bulkAccountsAction(ids, action);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      close();
      setSelection(new Set());
      setResult({ done: res.data.done.length, skipped: res.data.skipped });
      if (res.data.secrets.length)
        setSecrets(res.data.secrets.map((s) => ({ email: s.email, password: s.password })));
      router.refresh();
    });
  };

  const titles: Record<Exclude<Dialog, null>, string> = {
    disable: `Disable ${ids.length} accounts?`,
    enable: `Enable ${ids.length} accounts?`,
    reset: `Reset ${ids.length} passwords?`,
    delete: `Delete ${ids.length} accounts?`,
    allowShots: `Allow screenshots for ${ids.length} accounts?`,
    disallowShots: `Disallow screenshots for ${ids.length} accounts?`,
    restoreAccess: `Restore access for ${ids.length} accounts?`,
  };

  return (
    <Box>
      <DvPageHeader
        title="Accounts"
        actions={
          <>
            <SecurityUnreadLink />
            <Button variant="outlined" href="/api/manage/accounts.csv">
              Export CSV
            </Button>
            <Button variant="contained" href="/manage/accounts/new">
              Add account
            </Button>
          </>
        }
      />
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end', mb: 3 }}>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q || undefined, page: '1' });
          }}
          sx={{ width: 320 }}
        >
          <DvTextField
            ariaLabel="Search accounts"
            placeholder="Search by name or email"
            value={q}
            onChange={setQ}
          />
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={showArchived}
              onChange={(e) => go({ archived: e.target.checked ? '1' : undefined, page: '1' })}
            />
          }
          label="Show archived"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={suspendedOnly}
              onChange={(e) => go({ suspended: e.target.checked ? '1' : undefined, page: '1' })}
            />
          }
          label="Suspended only"
        />
      </Box>
      {result ? (
        <Box sx={{ mb: 3 }}>
          <DvBanner
            kind={result.skipped.length ? 'warning' : 'success'}
            onDismiss={() => setResult(null)}
          >
            {result.done} done. {result.skipped.length} skipped.
            {result.skipped.length ? (
              <ul>
                {result.skipped.map((s) => (
                  <li key={s.id}>
                    {rows.find((r) => r.id === s.id)?.email ?? s.id}: {s.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </DvBanner>
        </Box>
      ) : null}
      {ids.length > 0 ? (
        <Box
          role="toolbar"
          aria-label="Bulk actions"
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            mb: 3,
            p: 2,
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2">{ids.length} selected</Typography>
          <Button size="small" onClick={() => setDialog('disable')}>
            Disable
          </Button>
          <Button size="small" onClick={() => setDialog('enable')}>
            Enable
          </Button>
          <Button size="small" onClick={() => setDialog('reset')}>
            Reset password
          </Button>
          <Button size="small" onClick={() => setDialog('allowShots')}>
            Allow screenshots
          </Button>
          <Button size="small" onClick={() => setDialog('disallowShots')}>
            Disallow screenshots
          </Button>
          <Button size="small" onClick={() => setDialog('restoreAccess')}>
            Restore access
          </Button>
          <Button size="small" color="error" onClick={() => setDialog('delete')}>
            Delete
          </Button>
          <Button size="small" onClick={() => setSelection(new Set())}>
            Clear
          </Button>
        </Box>
      ) : null}
      <DvGrid
        ariaLabel="Accounts"
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selection={selection}
        onSelectionChange={(s) => setSelection(new Set([...s].slice(0, 100)))}
        page={page}
        pageSize={pageSize}
        pageSizes={[20, 50, 100]}
        total={total}
        onPageChange={(p, size) => go({ page: String(p), pageSize: String(size) })}
        isArchived={(r) => r.status === 'ARCHIVED'}
        emptyState={
          <DvEmptyState
            variant="inline"
            message="No users yet."
            action={{
              label: 'Add account',
              onClick: () => router.push('/manage/accounts/new'),
              primary: true,
            }}
          />
        }
      />

      <DvModal
        open={dialog !== null}
        title={dialog ? titles[dialog] : ''}
        primary={{
          label:
            dialog === 'delete'
              ? 'Delete'
              : dialog === 'reset'
                ? 'Reset passwords'
                : dialog === 'enable'
                  ? 'Enable'
                  : dialog === 'allowShots'
                    ? 'Allow'
                    : dialog === 'disallowShots'
                      ? 'Disallow'
                      : dialog === 'restoreAccess'
                        ? 'Restore access'
                        : 'Disable',
          onClick: () => {
            if (dialog === 'delete' && typed !== 'DELETE') {
              setError('Type DELETE to confirm.');
              return;
            }
            confirm();
          },
          loading: pending,
          tone: dialog === 'delete' ? 'danger' : 'default',
        }}
        secondary={{ label: 'Cancel', onClick: close }}
        onClose={close}
        error={error}
      >
        {dialog === 'delete' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography>
              The accounts are archived: sign in stops and sandboxes are kept for 90 days. Type
              DELETE to confirm.
            </Typography>
            <DvTextField ariaLabel="Type DELETE" value={typed} onChange={setTyped} />
          </Box>
        ) : dialog === 'reset' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>
              New passwords are generated for{' '}
              {selectedRows
                .map((r) => r.email)
                .slice(0, 3)
                .join(', ')}
              {ids.length > 3 ? '…' : ''}.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
              }
              label="Ask for a new password at next sign in"
            />
          </Box>
        ) : (
          <Typography>
            {dialog === 'disable'
              ? 'These accounts cannot sign in until they are enabled again.'
              : dialog === 'allowShots'
                ? 'These students will not be watched for screenshots or printing.'
                : dialog === 'disallowShots'
                  ? 'These students will be signed out and suspended if a screenshot attempt is detected.'
                  : dialog === 'restoreAccess'
                    ? 'Suspended students can sign in again. Accounts that are not suspended are skipped.'
                    : 'These accounts can sign in again.'}
          </Typography>
        )}
      </DvModal>
      {secrets ? (
        <OneTimeSecret title="New passwords" rows={secrets} onDone={() => setSecrets(null)} />
      ) : null}
    </Box>
  );
}
