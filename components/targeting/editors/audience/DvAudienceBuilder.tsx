'use client';

import { lazy, Suspense, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import {
  AUDIENCE_MESSAGES,
  applyPick,
  audienceIssues,
  currentPick,
  emptyAudienceLists,
  removeAudience,
  type AudienceLists,
  type AudienceMeta,
  type AudienceRef,
  type PickTarget,
} from '@/lib/targeting/audience';
import { toLiType } from '@/lib/targeting';
import type { EditorProps } from '../editors';
import { useTargetingEditorContext } from '../apps-urls/context';
import { advertiserPath } from '@/lib/routes/paths';
import { AudiencePicker, type PickerKind } from './AudiencePicker';

// Loaded when the first Create is chosen: the panel pulls in the audience server actions.
const CustomListPanel = lazy(() =>
  import('@/components/audiences/CustomListPanel').then((m) => ({ default: m.CustomListPanel })),
);
import { ImpressionsSummaryPane } from './ImpressionsSummaryPane';
import { allItems, useAudienceCatalogue, type AudienceCatalogue } from './useAudienceCatalogue';

/** Create menu of the Custom lists section: two items, each opens a stacked side panel in this page (LIT-001, LIT-002). */
function CreateCustomList({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (surface: 'affinity' | 'display') => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items: { label: string; surface: 'affinity' | 'display' }[] = [
    { label: 'Custom affinity', surface: 'affinity' },
    { label: 'Custom Intent', surface: 'display' },
  ];
  return (
    <>
      <Button
        size="small"
        variant="text"
        disabled={disabled}
        aria-haspopup="menu"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Create
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {items.map((i) => (
          <MenuItem
            key={i.label}
            onClick={() => {
              setAnchor(null);
              onPick(i.surface);
            }}
          >
            {i.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Apply is blocked while the same list is on both sides (TGT-100). */
export function audienceError(lists: AudienceLists | undefined): string | null {
  if (!lists) return null;
  return audienceIssues(lists, null, () => undefined).some((i) => i.ruleId === 'TGT-100')
    ? AUDIENCE_MESSAGES.TGT_100
    : null;
}

interface SectionDef {
  title: string;
  text: string;
  /** Help text in the right-hand column of the row. */
  help: string;
  target: Exclude<PickTarget, { section: 'FIRST_PARTY'; side: 'INCLUDE' }>;
  source: PickerKind;
}

const INCLUDE: SectionDef[] = [
  {
    title: 'Google audiences',
    text: "Add affinity, in-market, and other audiences to 'OR' together.",
    help: 'Reach people by their interests and by what they are actively researching.',
    target: { side: 'INCLUDE', section: 'GOOGLE' },
    source: 'google',
  },
  {
    title: 'Combined audiences',
    text: "Add previously created combined audiences to 'OR' together.",
    help: 'Combined audiences are built from other audiences in the Audiences module.',
    target: { side: 'INCLUDE', section: 'COMBINED' },
    source: 'combined',
  },
  {
    title: 'Custom lists',
    text: "Add (or create new) custom lists to 'OR' together.",
    help: 'Custom lists reach people by the topics, keywords, URLs and apps you give.',
    target: { side: 'INCLUDE', section: 'CUSTOM' },
    source: 'custom',
  },
];
const EXCLUDE: SectionDef[] = [
  {
    title: 'First-party and partner audiences',
    text: 'Exclude people on these lists.',
    help: 'People on these lists will not see ads from this line item.',
    target: { side: 'EXCLUDE', section: 'FIRST_PARTY' },
    source: 'firstParty',
  },
  {
    title: 'Google audiences',
    text: 'Exclude people on these lists.',
    help: 'People on these lists will not see ads from this line item.',
    target: { side: 'EXCLUDE', section: 'GOOGLE' },
    source: 'google',
  },
];

const FIRST_PARTY_HELP =
  'Add audiences to combine into a new one. Expand the size by adding in a group. Intersect groups to narrow.';

/** A card (Include, Exclude) with its heading; rows inside have a right-hand help column. */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 2, overflow: 'hidden' }}
    >
      <Typography variant="h4" component="h4" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** One row of a card: label and Add on the left, help text on the right. */
function RowShell({
  help,
  children,
}: {
  help: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
        columnGap: 2,
        px: 2,
        py: 1.5,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>{children}</Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
        {help}
      </Typography>
    </Box>
  );
}

/** Audience builder (module 10 2.5, RC-030): Include and Exclude cards with a help column, and the Impressions summary. */
export function DvAudienceBuilder({ criteria, onChange, lineItemType, readOnly }: EditorProps) {
  const lists = criteria.audienceLists ?? emptyAudienceLists();
  const ctx = useTargetingEditorContext();
  const catalogue = useAudienceCatalogue(ctx.advertiserId);
  const type = toLiType(lineItemType);
  const byId = useMemo(() => new Map(allItems(catalogue).map((i) => [i.id, i])), [catalogue]);
  const [picking, setPicking] = useState<{ target: PickTarget; source: PickerKind } | null>(null);
  const [creating, setCreating] = useState<'affinity' | 'display' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (next: AudienceLists) => onChange({ audienceLists: next });
  const meta = (id: string): AudienceMeta | undefined => byId.get(id)?.meta;
  const issues = audienceIssues(lists, type, meta);
  const name = (id: string) => byId.get(id)?.name ?? id;

  const pathname = usePathname();
  const m = /^\/p\/(\d+)\/a\/(\d+)/.exec(pathname ?? '');
  const partnerPublicId = ctx.partnerPublicId ?? m?.[1];
  const advertiserPublicId = ctx.advertiserPublicId ?? m?.[2];
  const campaignSettingsHref =
    partnerPublicId && advertiserPublicId
      ? advertiserPath(partnerPublicId, advertiserPublicId, 'campaigns')
      : undefined;

  const open = (target: PickTarget, source: PickerKind) => {
    setError(null);
    setPicking({ target, source });
  };
  const apply = (ids: string[]) => {
    if (!picking) return;
    const r = applyPick(lists, picking.target, ids);
    set(r.lists);
    setError(r.blocked.length > 0 ? AUDIENCE_MESSAGES.TGT_100 : null);
    setPicking(null);
  };
  const remove = (ref: AudienceRef) => set(removeAudience(lists, ref));

  const Item = ({ id, r }: { id: string; r: AudienceRef }) => (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', py: 0.25 }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {name(id)}
      </Typography>
      {!readOnly ? (
        <IconButton size="small" aria-label={`Remove ${name(id)}`} onClick={() => remove(r)}>
          ×
        </IconButton>
      ) : null}
    </Box>
  );

  const section = (def: SectionDef, ids: string[], side: 'INCLUDE' | 'EXCLUDE') => (
    <RowShell key={`${side}-${def.title}`} help={def.help}>
      <Box component="section" aria-label={`${side === 'INCLUDE' ? 'Include' : 'Exclude'} ${def.title}`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">{def.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {def.text}
            </Typography>
          </Box>
          {def.target.section === 'CUSTOM' && def.target.side === 'INCLUDE' ? (
            <CreateCustomList
              disabled={Boolean(readOnly) || !advertiserPublicId}
              onPick={setCreating}
            />
          ) : null}
          <Button
            size="small"
            variant="text"
            disabled={readOnly}
            aria-label={`${def.target.section === 'CUSTOM' ? 'Select' : 'Add'} ${side === 'EXCLUDE' ? 'excluded ' : ''}${def.title}`}
            onClick={() => open(def.target, def.source)}
          >
            {def.target.section === 'CUSTOM' ? 'Select' : 'Add'}
          </Button>
        </Box>
        {ids.length > 0 ? (
          <Box
            component="ul"
            aria-label={`${side === 'INCLUDE' ? 'Included' : 'Excluded'} ${def.title}`}
            sx={{ m: 0, pl: 0, listStyle: 'none' }}
          >
            {ids.map((id) => (
              <Item key={id} id={id} r={{ id, side, section: def.target.section }} />
            ))}
          </Box>
        ) : null}
      </Box>
    </RowShell>
  );

  const groups = lists.include.firstPartyGroups;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
        gap: 3,
      }}
    >
      <Box>
        {error ? (
          <Typography role="alert" variant="body2" color="error" sx={{ mb: 1 }}>
            {error}
          </Typography>
        ) : null}
        {issues.map((i) => (
          <Typography
            key={`${i.ruleId}-${i.id}`}
            role={i.severity === 'error' ? 'alert' : 'status'}
            variant="body2"
            color={i.severity === 'error' ? 'error' : 'warning.main'}
          >
            {name(i.id)}: {i.message}
          </Typography>
        ))}

        <Card title="Include">
          <RowShell help={FIRST_PARTY_HELP}>
            <Box component="section" aria-label="Include First-party and partner audiences">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">First-party and partner audiences</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add first-party and partner audiences to &apos;AND &amp; OR&apos; together.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="text"
                  disabled={readOnly}
                  aria-label="Add first-party and partner audiences"
                  onClick={() =>
                    open({ side: 'INCLUDE', section: 'FIRST_PARTY', group: 'new' }, 'firstParty')
                  }
                >
                  Add
                </Button>
              </Box>
              {groups.map((g, gi) => (
                <Box key={gi} sx={{ mt: 1 }}>
                  {gi > 0 ? (
                    <Typography variant="overline" color="text.secondary">
                      AND
                    </Typography>
                  ) : null}
                  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ flex: 1 }}>
                        Group {gi + 1}: any of (OR)
                      </Typography>
                      <Button
                        size="small"
                        disabled={readOnly}
                        aria-label={`Add to group ${gi + 1}`}
                        onClick={() =>
                          open({ side: 'INCLUDE', section: 'FIRST_PARTY', group: gi }, 'firstParty')
                        }
                      >
                        Add to group
                      </Button>
                    </Box>
                    <Box
                      component="ul"
                      aria-label={`Group ${gi + 1}`}
                      sx={{ m: 0, pl: 0, listStyle: 'none' }}
                    >
                      {g.map((id) => (
                        <Item
                          key={id}
                          id={id}
                          r={{ id, side: 'INCLUDE', section: 'FIRST_PARTY', group: gi }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </RowShell>
          {INCLUDE.map((d) =>
            section(
              d,
              d.target.section === 'GOOGLE'
                ? lists.include.google
                : d.target.section === 'COMBINED'
                  ? lists.include.combined
                  : lists.include.custom,
              'INCLUDE',
            ),
          )}
        </Card>

        <Card title="Exclude">
          {EXCLUDE.map((d) =>
            section(
              d,
              d.target.section === 'GOOGLE' ? lists.exclude.google : lists.exclude.firstParty,
              'EXCLUDE',
            ),
          )}
        </Card>
      </Box>

      <ImpressionsSummaryPane
        lists={lists}
        lineItemType={lineItemType}
        criteria={criteria}
        {...(ctx.advertiserId ? { advertiserId: ctx.advertiserId } : {})}
        {...(ctx.flightDays ? { flightDays: ctx.flightDays } : {})}
      />

      {picking ? (
        <AudiencePicker
          open
          kind={picking.source}
          items={catalogue[SOURCE_KEY[picking.source]]}
          lineItemType={type}
          initial={currentPick(lists, picking.target)}
          {...(campaignSettingsHref ? { campaignSettingsHref } : {})}
          onApply={apply}
          onCancel={() => setPicking(null)}
        />
      ) : null}

      {creating && advertiserPublicId ? (
        <Suspense fallback={null}>
          <CustomListPanel
            surface={creating}
            advertiserId={advertiserPublicId}
            level={1}
            onClose={(created) => {
              setCreating(null);
              if (created) catalogue.reload();
            }}
          />
        </Suspense>
      ) : null}
    </Box>
  );
}

const SOURCE_KEY = {
  firstParty: 'firstParty',
  google: 'google',
  combined: 'combined',
  custom: 'custom',
} as const satisfies Record<PickerKind, keyof AudienceCatalogue>;
