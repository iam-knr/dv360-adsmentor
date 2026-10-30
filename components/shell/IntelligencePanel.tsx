'use client';

// Body of the Intelligence panel (module 01 4.8, module 11 2.8): open alerts of the scope, optimization suggestions
// with Investigate / Apply / Dismiss, and the Investigate drawer for conflicting-settings rows.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvHealthList, DvSlideOver, type HealthRow } from '@/components/dv';
import type { ScopeLevel } from '@/lib/routes/paths';
import { useViewer } from './ViewerProvider';
import type { IntelligenceData } from '@/lib/optimisation/service';

type Level = Exclude<ScopeLevel, 'global' | 'partner'>;
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: IntelligenceData };

interface InvestigateResp {
  title: string;
  conflicts: { code: string; text: string; href: string; fix: { label: string } }[];
}

export function IntelligencePanelBody({
  level,
  scopeId,
  onState,
}: {
  level: Level;
  scopeId: string;
  onState?: (s: 'ready' | 'loading' | 'error', retry: () => void) => void;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [drawer, setDrawer] = useState<InvestigateResp | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(
        `/api/dv/intelligence?scope=${level}&id=${encodeURIComponent(scopeId)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data: IntelligenceData };
      setState({ kind: 'ready', data: body.data });
    } catch {
      setState({ kind: 'error' });
    }
  }, [level, scopeId]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    onState?.(state.kind, () => void load());
  }, [state.kind, load, onState]);

  const act = async (id: string, action: 'apply' | 'dismiss') => {
    await fetch(`/api/dv/recommendations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    router.refresh();
    await load();
  };

  const investigate = async (scope: 'io' | 'li', id: string) => {
    const res = await fetch(
      `/api/dv/intelligence/investigate?scope=${scope}&id=${encodeURIComponent(id)}`,
    );
    if (!res.ok) return;
    setDrawer(((await res.json()) as { data: InvestigateResp }).data);
  };

  if (state.kind !== 'ready') return null;
  const d = state.data;
  const alerts: HealthRow[] = d.alerts.map((a) => ({
    id: a.id,
    severity: a.severity,
    text: a.text,
    onInvestigate: () =>
      a.drawer ? void investigate(a.drawer.scope, a.drawer.id) : router.push(a.investigateHref),
  }));
  const suggestions: HealthRow[] = d.suggestions.map((s) => ({
    id: s.id,
    severity: 'suggestion',
    text: s.text,
    onInvestigate: () => router.push(s.investigateHref),
    ...(s.applicable && !viewer.readOnly ? { onApply: () => void act(s.id, 'apply') } : {}),
    ...(s.dismissable && !viewer.readOnly ? { onDismiss: () => void act(s.id, 'dismiss') } : {}),
  }));
  return (
    <>
      <DvHealthList
        healthTitle={d.healthTitle}
        alerts={alerts}
        suggestions={suggestions}
        {...(d.alertsHref ? { onGoToAlerts: () => router.push(d.alertsHref as string) } : {})}
      />
      <DvSlideOver open={drawer !== null} title="Investigate" onCancel={() => setDrawer(null)}>
        {drawer ? (
          <Box>
            <Typography variant="h6" sx={{ mb: 3 }}>
              {drawer.title}
            </Typography>
            {drawer.conflicts.length === 0 ? (
              <Typography variant="body2">There are no conflicting settings.</Typography>
            ) : (
              drawer.conflicts.map((c) => (
                <Box key={c.code} sx={{ mb: 4 }} data-conflict={c.code}>
                  <Typography variant="body1">{c.text}</Typography>
                  <Link href={c.href}>{c.fix.label}</Link>
                </Box>
              ))
            )}
          </Box>
        ) : null}
      </DvSlideOver>
    </>
  );
}
