'use client';

import { useMemo, useState } from 'react';
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
import { AudiencePicker, type PickerCategory } from './AudiencePicker';
import { ImpressionsSummaryPane } from './ImpressionsSummaryPane';
import { allItems, useAudienceCatalogue, type CatalogueItem } from './useAudienceCatalogue';

/** Create menu of the Custom lists section: the three create forms open in a new tab so the line item draft stays. */
function CreateCustomList({ base }: { base: string | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items = [
    { label: 'Custom affinity', href: `${base}/customaudience/affinity/new` },
    { label: 'Custom intent (Display, Video)', href: `${base}/customaudience/intent/new?surface=display` },
    { label: 'Custom intent (YouTube)', href: `${base}/customaudience/intent/new?surface=youtube` },
  ];
  return (
    <>
      <Button
        size="small"
        disabled={!base}
        aria-haspopup="menu"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Create
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {items.map((i) => (
          <MenuItem
            key={i.label}
            component="a"
            href={i.href}
            target="_blank"
            rel="noopener"
            onClick={() => setAnchor(null)}
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
  target: Exclude<PickTarget, { section: 'FIRST_PARTY'; side: 'INCLUDE' }>;
  source: 'firstParty' | 'google' | 'combined' | 'custom';
}

const INCLUDE: SectionDef[] = [
  {
    title: 'Google audiences',
    text: "Add affinity, in-market, and other audiences to 'OR' together.",
    target: { side: 'INCLUDE', section: 'GOOGLE' },
    source: 'google',
  },
  {
    title: 'Combined audiences',
    text: "Add previously created combined audiences to 'OR' together.",
    target: { side: 'INCLUDE', section: 'COMBINED' },
    source: 'combined',
  },
  {
    title: 'Custom lists',
    text: "Add (or create new) custom lists to 'OR' together.",
    target: { side: 'INCLUDE', section: 'CUSTOM' },
    source: 'custom',
  },
];
const EXCLUDE: SectionDef[] = [
  {
    title: 'First-party and partner audiences',
    text: 'Exclude people on these lists.',
    target: { side: 'EXCLUDE', section: 'FIRST_PARTY' },
    source: 'firstParty',
  },
  {
    title: 'Google audiences',
    text: 'Exclude people on these lists.',
    target: { side: 'EXCLUDE', section: 'GOOGLE' },
    source: 'google',
  },
];

/** Audience builder (module 10 2.5, RC-030): sections, first-party groups, exclusions, and the Impressions summary. */
export function DvAudienceBuilder({ criteria, onChange, lineItemType, readOnly }: EditorProps) {
  const lists = criteria.audienceLists ?? emptyAudienceLists();
  const ctx = useTargetingEditorContext();
  const catalogue = useAudienceCatalogue(ctx.advertiserId);
  const type = toLiType(lineItemType);
  const isYoutube = type === 'YT_VIDEO' || type === 'YT_AUDIO' || type === 'YT_ON_CTV';
  const byId = useMemo(() => new Map(allItems(catalogue).map((i) => [i.id, i])), [catalogue]);
  const [picking, setPicking] = useState<{
    target: PickTarget;
    title: string;
    source: SectionDef['source'];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (next: AudienceLists) => onChange({ audienceLists: next });
  const meta = (id: string): AudienceMeta | undefined => byId.get(id)?.meta;
  const issues = audienceIssues(lists, type, meta);
  const name = (id: string) => byId.get(id)?.name ?? id;

  const pathname = usePathname();
  const m = /^\/p\/(\d+)\/a\/(\d+)/.exec(pathname ?? '');
  const base = m ? `/p/${m[1]}/a/${m[2]}` : null;
  const open = (target: PickTarget, title: string, source: SectionDef['source']) => {
    setError(null);
    setPicking({ target, title, source });
  };
  const apply = (ids: string[]) => {
    if (!picking) return;
    const r = applyPick(lists, picking.target, ids);
    set(r.lists);
    setError(r.blocked.length > 0 ? AUDIENCE_MESSAGES.TGT_100 : null);
    setPicking(null);
  };
  const remove = (ref: AudienceRef) => set(removeAudience(lists, ref));

  // Links for the empty-state "create" hints of the picker; the Create menu itself is CreateCustomList above.
  const link = (...seg: string[]) =>
    ctx.partnerPublicId && ctx.advertiserPublicId
      ? advertiserPath(ctx.partnerPublicId, ctx.advertiserPublicId, ...seg)
      : base
        ? `${base}/${seg.join('/')}`
        : undefined;
  const createAffinity = link('customaudience', 'affinity', 'new');
  const createIntentDv = link('customaudience', 'intent', 'new');
  const createIntentYt = link('customaudience', 'intent', 'new');
  const withCreate = (value: string, href: string | undefined, query = ''): PickerCategory =>
    href ? { value, createHref: `${href}${query}` } : { value };
  /** Categories each picker always offers (module 14 S2, module 10 2.5). */
  const categoriesFor = (source: SectionDef['source']): PickerCategory[] => {
    switch (source) {
      case 'custom':
        return [
          withCreate('CUSTOM_AFFINITY', createAffinity),
          withCreate('CUSTOM_INTENT_DISPLAY_VIDEO', createIntentDv, '?surface=display'),
          ...(!type || isYoutube
            ? [withCreate('CUSTOM_INTENT_YOUTUBE', createIntentYt, '?surface=youtube')]
            : []),
        ];
      case 'google':
        return ['AFFINITY', 'IN_MARKET', 'LIFE_EVENT', 'DETAILED_DEMOGRAPHIC'].map((value) => ({
          value,
        }));
      case 'firstParty':
        return ['FIRST_PARTY', 'LOOKALIKE', 'PARTNER'].map((value) => ({ value }));
      default:
        return [];
    }
  };

  const itemsFor = (source: SectionDef['source']): CatalogueItem[] => catalogue[source];

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
    <Box
      key={`${side}-${def.title}`}
      component="section"
      aria-label={`${side === 'INCLUDE' ? 'Include' : 'Exclude'} ${def.title}`}
      sx={{ py: 1.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2">{def.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {def.text}
          </Typography>
        </Box>
        {def.target.section === 'CUSTOM' && def.target.side === 'INCLUDE' ? (
          <CreateCustomList base={base} />
        ) : null}
        <Button
          size="small"
          variant="outlined"
          disabled={readOnly}
          aria-label={`${def.target.section === 'CUSTOM' ? 'Select' : 'Add'} ${side === 'EXCLUDE' ? 'excluded ' : ''}${def.title}`}
          onClick={() => open(def.target, def.title, def.source)}
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

        <Typography variant="h4" component="h4">
          Include
        </Typography>
        <Box
          component="section"
          aria-label="Include First-party and partner audiences"
          sx={{ py: 1.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">First-party and partner audiences</Typography>
              <Typography variant="caption" color="text.secondary">
                Add first-party and partner audiences to &apos;AND &amp; OR&apos; together. Add
                lists to a group to expand it, add another group to intersect and narrow.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              disabled={readOnly}
              aria-label="Add first-party and partner audiences"
              onClick={() =>
                open(
                  { side: 'INCLUDE', section: 'FIRST_PARTY', group: 'new' },
                  'First-party and partner audiences',
                  'firstParty',
                )
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
                      open(
                        { side: 'INCLUDE', section: 'FIRST_PARTY', group: gi },
                        'First-party and partner audiences',
                        'firstParty',
                      )
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

        <Typography variant="h4" component="h4" sx={{ mt: 2 }}>
          Exclude
        </Typography>
        {EXCLUDE.map((d) =>
          section(
            d,
            d.target.section === 'GOOGLE' ? lists.exclude.google : lists.exclude.firstParty,
            'EXCLUDE',
          ),
        )}
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
          title={picking.title}
          items={itemsFor(picking.source)}
          lineItemType={type}
          initial={currentPick(lists, picking.target)}
          categories={categoriesFor(picking.source)}
          onApply={apply}
          onCancel={() => setPicking(null)}
        />
      ) : null}
    </Box>
  );
}
