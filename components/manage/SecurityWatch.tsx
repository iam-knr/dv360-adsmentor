'use client';

// Super admin alerts for the screenshot guard (docs/gaps/screenshot-guard.md): the Security link with its unread
// badge, the red banner while accounts are suspended, and a toast when a new suspension arrives while the Super
// admin is online. The numbers come from the server on every page load and from a 30 second poll (like the
// student bell). There is no email service: in-app notification and the audit log are the delivery.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import { DvBanner } from '@/components/dv/DvBanner';
import { screenshotMethodLabel } from '@/lib/security/screenshot-detect';

export const SECURITY_POLL_MS = 30_000;

export interface SecuritySummaryDto {
  open: number;
  unread: number;
  latest: { id: string; userName: string; method: string; occurredAt: string } | null;
}

interface Ctx {
  summary: SecuritySummaryDto;
  refresh: () => Promise<void>;
}

const EMPTY: SecuritySummaryDto = { open: 0, unread: 0, latest: null };
const SecurityContext = createContext<Ctx | null>(null);

/** Null safe: pages rendered without the provider (component tests) simply have nothing to show. */
export function useSecuritySummary(): Ctx {
  return useContext(SecurityContext) ?? { summary: EMPTY, refresh: () => Promise.resolve() };
}

export function SecurityWatchProvider({
  initial,
  pollMs = SECURITY_POLL_MS,
  children,
}: {
  initial: SecuritySummaryDto;
  pollMs?: number;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  // time of the newest suspension already known: a newer one means a new suspension arrived (restoring an older
  // one makes an older event the "latest" again, which must not toast)
  const known = useRef<number>(initial.latest ? Date.parse(initial.latest.occurredAt) : 0);

  // a page load brings fresh numbers from the server
  useEffect(() => {
    setSummary(initial);
    if (initial.latest)
      known.current = Math.max(known.current, Date.parse(initial.latest.occurredAt));
  }, [initial]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/manage/security', { cache: 'no-store' });
      if (!res.ok) return;
      const next = (await res.json()) as SecuritySummaryDto;
      setSummary(next);
      const at = next.latest ? Date.parse(next.latest.occurredAt) : 0;
      if (next.latest && at > known.current) {
        known.current = at;
        setToast(
          `${next.latest.userName} was signed out and suspended: screenshot attempt (${screenshotMethodLabel(next.latest.method)}).`,
        );
      }
    } catch {
      // offline or signed out: keep what is shown
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [refresh, pollMs]);

  const value = useMemo(() => ({ summary, refresh }), [summary, refresh]);
  return (
    <SecurityContext.Provider value={value}>
      {children}
      <Snackbar
        open={toast !== null}
        autoHideDuration={15_000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setToast(null)} role="alert">
          {toast}{' '}
          <Link href="/manage/security" color="inherit" underline="always">
            Review
          </Link>
        </Alert>
      </Snackbar>
    </SecurityContext.Provider>
  );
}

/** The Security entry of the manage navigation, with the unread count. */
export function SecurityNavLink() {
  const { summary } = useSecuritySummary();
  return (
    <Badge
      color="error"
      badgeContent={summary.unread}
      max={99}
      invisible={summary.unread === 0}
      slotProps={{ badge: { 'aria-label': `${summary.unread} unread security events` } as never }}
      sx={{ '& .MuiBadge-badge': { right: -14, top: 8 }, alignSelf: 'flex-start' }}
    >
      <Link href="/manage/security" underline="hover" color="inherit">
        Security
      </Link>
    </Badge>
  );
}

/** Red banner on every /manage page while at least one student is suspended. */
export function OpenSuspensionsBanner() {
  const { summary } = useSecuritySummary();
  if (summary.open === 0) return null;
  return (
    <div data-testid="open-suspensions-banner">
      <DvBanner
        kind="error"
        level="inline"
        links={[{ label: 'Review and restore access', href: '/manage/security' }]}
      >
        {summary.open === 1
          ? '1 student is suspended after a screenshot attempt.'
          : `${summary.open} students are suspended after a screenshot attempt.`}
      </DvBanner>
    </div>
  );
}

/** Small link with the unread count for the Accounts page. */
export function SecurityUnreadLink() {
  const { summary } = useSecuritySummary();
  if (summary.unread === 0) return null;
  return (
    <Link href="/manage/security" data-testid="accounts-security-badge" underline="hover">
      {summary.unread} unread security {summary.unread === 1 ? 'event' : 'events'}
    </Link>
  );
}

/** Marks the events as seen when the security page is opened, then refreshes the badge. */
export function MarkSecuritySeen({ markSeen }: { markSeen: () => Promise<unknown> }) {
  const { refresh } = useSecuritySummary();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markSeen().then(() => refresh());
  }, [markSeen, refresh]);
  return null;
}
