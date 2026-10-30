'use client';

// Right rail (routes.md 4.6, design-system 2.3). One panel at a time; the active icon closes it. The open panel is
// client state of the (app) layout, so it survives navigation inside (app) and is gone after a (full) page.
// Intelligence opens by default the first time a person reaches the Campaigns list, a campaign tab, or an IO or LI
// page (`sim.rail` in localStorage remembers that it happened). `?sim_rail=` opens a panel once.
// Panel contents are stubs in Phase 3 (Ask Advisor, Quick help and Intelligence data are module 01 Phase 4).
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Typography from '@mui/material/Typography';
import { DvPanel, DvRightRail, type RailPanelId } from '@/components/dv';
import { IntelligencePanelBody } from './IntelligencePanel';
import { sizes } from '@/lib/theme/tokens';
import { advertiserPath } from '@/lib/routes/paths';
import { usePageScope } from '@/lib/scope/context';
import { readStorage, savePrefsQuietly, writeStorage } from './ChromeState';
import { useViewer } from './ViewerProvider';

export const RAIL_KEY = 'sim.rail';
const PANELS: RailPanelId[] = ['advisor', 'help', 'intelligence', 'exercise'];

interface RailMemory {
  intelligenceSeen?: boolean;
  last?: RailPanelId | null;
}

function readMemory(): RailMemory {
  try {
    return (JSON.parse(readStorage(RAIL_KEY) ?? '{}') as RailMemory) ?? {};
  } catch {
    return {};
  }
}

export function RailHost() {
  const { scope, ids, level } = usePageScope();
  const { viewer } = useViewer();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState<RailPanelId | null>(null);
  const deepLinked = useRef<string | null>(null);

  const intelligence =
    level === 'advertiser' || level === 'campaign' || level === 'io' || level === 'li';
  const available: RailPanelId[] = intelligence
    ? ['advisor', 'help', 'intelligence']
    : ['advisor', 'help'];

  // Intelligence by default on the first visit to [A]/cs, a campaign tab, or an IO or LI page.
  useEffect(() => {
    const onCampaigns =
      level === 'advertiser' && ids.partnerId && ids.advertiserId
        ? pathname === advertiserPath(ids.partnerId, ids.advertiserId, 'cs')
        : false;
    const defaultPage = onCampaigns || level === 'campaign' || level === 'io' || level === 'li';
    if (!defaultPage) return;
    const memory = readMemory();
    if (memory.intelligenceSeen) return;
    writeStorage(RAIL_KEY, JSON.stringify({ ...memory, intelligenceSeen: true }));
    setOpen('intelligence');
  }, [pathname, level, ids.partnerId, ids.advertiserId]);

  // ?sim_rail=advisor|help|intelligence|exercise opens a panel once (scenarios).
  const railParam = search?.get('sim_rail') ?? null;
  useEffect(() => {
    if (!railParam || deepLinked.current === railParam) return;
    deepLinked.current = railParam;
    if ((PANELS as string[]).includes(railParam)) setOpen(railParam as RailPanelId);
  }, [railParam]);

  const change = (next: RailPanelId | null) => {
    setOpen(next);
    writeStorage(RAIL_KEY, JSON.stringify({ ...readMemory(), last: next }));
    savePrefsQuietly({ railLastPanel: next });
  };

  const shown = open && available.includes(open) ? open : null;
  const intelligenceScope = scope.li
    ? { level: 'li' as const, id: scope.li.id }
    : scope.io
      ? { level: 'io' as const, id: scope.io.id }
      : scope.campaign
        ? { level: 'campaign' as const, id: scope.campaign.id }
        : scope.advertiser
          ? { level: 'advertiser' as const, id: scope.advertiser.id }
          : null;
  const first = viewer.name.split(/\s+/)[0] ?? '';
  const scopeName =
    scope.li?.name ?? scope.io?.name ?? scope.campaign?.name ?? scope.advertiser?.name;

  return (
    <>
      {shown === 'advisor' ? (
        <DvPanel
          title="Ask Advisor"
          beta
          width={sizes.advisorPanelWidth}
          onClose={() => change(null)}
        >
          <Typography variant="caption" component="p">
            Tutor
          </Typography>
          <Typography variant="h5" component="p" sx={{ mt: 2 }}>{`Hi ${first}`}</Typography>
          <Typography variant="body1">What can I help you with today?</Typography>
          <Typography variant="body2" sx={{ mt: 4 }}>
            The tutor is not built yet (module 01, Phase 4).
          </Typography>
        </DvPanel>
      ) : null}
      {shown === 'help' ? (
        <DvPanel title="Quick help" beta onClose={() => change(null)}>
          <Typography variant="body2">
            Help articles are not built yet (module 01, Phase 4).
          </Typography>
        </DvPanel>
      ) : null}
      {shown === 'intelligence' ? (
        <DvPanel
          title="Intelligence"
          subtitle={scopeName}
          tone="primary"
          onClose={() => change(null)}
        >
          {intelligenceScope ? (
            <IntelligencePanelBody
              key={`${intelligenceScope.level}:${intelligenceScope.id}`}
              level={intelligenceScope.level}
              scopeId={intelligenceScope.id}
            />
          ) : null}
        </DvPanel>
      ) : null}
      <DvRightRail available={available} open={shown} onChange={change} />
    </>
  );
}
