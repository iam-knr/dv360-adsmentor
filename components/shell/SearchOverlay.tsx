'use client';

// Search overlay S3 (module 01 2.3, design-system 2.1): a centred 640 px panel over a scrim. States: closed, open with
// the 7 chips, typing (250 ms debounce, "Searching" spinner), result (interpretation line + Open), no match, error.
// Chips are saved filter links and navigate at once; typed text goes through POST …/search (rule-based resolver
// plus direct name/ID hits). Partner pages search advertisers by name or ID only. Esc closes; the Dialog traps focus
// and gives it back to the trigger. The same component serves TopBar (live) and DvAppBar (static / controlled).
import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import InputBase from '@mui/material/InputBase';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { AppLink } from '@/lib/routes/AppLink';
import { NO_MATCH_LEAD, SEARCH_QUERY_MAX, targetHref } from '@/lib/search/resolve';
import { SEARCH_SUGGESTIONS } from '@/lib/search/suggestions';
import type { SearchResponse } from '@/lib/search/types';

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_PLACEHOLDER = "Search the advertiser with phrases like 'paused line items'";

export type SearchOverlayScope =
  | { kind: 'advertiser'; partnerId: string; advertiserId: string }
  | { kind: 'partner'; partnerId: string }
  | null;

type Phase =
  | { name: 'idle' }
  | { name: 'searching' }
  | { name: 'result'; data: SearchResponse }
  | { name: 'nomatch'; data: SearchResponse }
  | { name: 'error'; message: string };

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Live mode: where the chips and the search API are. Null = no advertiser or partner in scope. */
  scope?: SearchOverlayScope;
  /** Navigate to `href` (the shell asks the unsaved-changes guard first). */
  onNavigate?: (href: string) => void;
  /** Static mode (design-system primitive): plain chip labels and a submit callback, no API. */
  suggestions?: string[];
  onSearch?: (query: string) => void;
}

function apiPath(scope: Exclude<SearchOverlayScope, null>): string {
  return scope.kind === 'advertiser'
    ? `/api/dv/advertisers/${scope.advertiserId}/search`
    : `/api/dv/partners/${scope.partnerId}/search`;
}

export function SearchOverlay({
  open,
  onClose,
  scope = null,
  onNavigate,
  suggestions,
  onSearch,
}: SearchOverlayProps) {
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const live = !onSearch && suggestions === undefined;

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    controller.current?.abort();
    controller.current = null;
    seq.current += 1;
  }, []);

  // Closed overlay forgets the text (state "closed" → "open with chips")
  useEffect(() => {
    if (!open) {
      cancel();
      setQ('');
      setPhase({ name: 'idle' });
    }
  }, [open, cancel]);
  useEffect(() => cancel, [cancel]);

  const go = (href: string) => {
    onClose();
    onNavigate?.(href);
  };

  const run = useCallback(
    async (text: string) => {
      if (!scope) return;
      const mine = ++seq.current;
      controller.current?.abort();
      const ctl = new AbortController();
      controller.current = ctl;
      try {
        const res = await fetch(apiPath(scope), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text }),
          signal: ctl.signal,
        });
        if (mine !== seq.current) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            issues?: { message?: string }[];
          } | null;
          setPhase({
            name: 'error',
            message: body?.issues?.[0]?.message ?? 'Search is not available right now. Try again.',
          });
          return;
        }
        const data = (await res.json()) as SearchResponse;
        if (mine !== seq.current) return;
        setPhase(
          data.target || data.results.length ? { name: 'result', data } : { name: 'nomatch', data },
        );
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError' || mine !== seq.current) return;
        setPhase({ name: 'error', message: 'Search is not available right now. Try again.' });
      }
    },
    [scope],
  );

  const onChange = (value: string) => {
    setQ(value);
    if (!live || !scope) return;
    cancel();
    const text = value.trim();
    if (!text) {
      setPhase({ name: 'idle' });
      return;
    }
    setPhase({ name: 'searching' });
    timer.current = setTimeout(() => void run(text), SEARCH_DEBOUNCE_MS);
  };

  const primaryHref = (data: SearchResponse): string | null =>
    data.target
      ? targetHref(data.base, data.target)
      : data.results[0]
        ? data.results[0].href
        : null;

  const submit = () => {
    const text = q.trim();
    if (!text) return;
    if (!live) {
      onSearch?.(text);
      onClose();
      return;
    }
    if (!scope) return;
    if (phase.name === 'result') {
      const href = primaryHref(phase.data);
      if (href) go(href);
    } else if (phase.name === 'nomatch') {
      go(targetHref(phase.data.base, phase.data.fallback));
    } else {
      cancel();
      setPhase({ name: 'searching' });
      void run(text);
    }
  };

  const chips: { key: string; label: string; pick: () => void }[] =
    live && scope?.kind === 'advertiser'
      ? SEARCH_SUGGESTIONS.map((s) => ({
          key: s.key,
          label: s.label,
          pick: () =>
            go(
              targetHref(`/p/${scope.partnerId}/a/${scope.advertiserId}`, {
                route: s.route,
                query: s.query,
              }),
            ),
        }))
      : live
        ? []
        : (suggestions ?? SEARCH_SUGGESTIONS.map((s) => s.label)).map((label) => ({
            key: label,
            label,
            pick: () => {
              onSearch?.(label);
              onClose();
            },
          }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={{
        zIndex: (t) => t.zIndex.searchOverlay,
        '& .MuiDialog-container': { alignItems: 'flex-start' },
      }}
      slotProps={{
        paper: { 'aria-label': 'Search', sx: { width: 640, maxWidth: '95vw', mt: 16, p: 4 } },
      }}
    >
      <InputBase
        autoFocus
        fullWidth
        value={q}
        onChange={(e) => onChange(e.target.value.slice(0, SEARCH_QUERY_MAX))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={SEARCH_PLACEHOLDER}
        inputProps={{ 'aria-label': 'Search', maxLength: SEARCH_QUERY_MAX }}
        startAdornment={<DvIcon name="search" size={24} sx={{ mr: 3 }} />}
        sx={{ typography: 'body1', mb: 4 }}
      />

      {phase.name === 'idle' && chips.length ? (
        <>
          <Typography variant="caption" sx={{ display: 'block', mb: 2 }}>
            Try searching this advertiser for:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {chips.map((c) => (
              <Chip key={c.key} variant="outlined" label={c.label} onClick={c.pick} />
            ))}
          </Box>
        </>
      ) : null}
      {phase.name === 'idle' && live && scope?.kind === 'partner' ? (
        <Typography variant="body2">
          Search this partner&apos;s advertisers by name or ID.
        </Typography>
      ) : null}
      {phase.name === 'idle' && live && !scope ? (
        <Typography variant="body2">
          Open an advertiser to search it by name, ID or phrase.
        </Typography>
      ) : null}

      {phase.name === 'searching' ? (
        <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={20} aria-hidden="true" />
          <Typography variant="body2">Searching</Typography>
        </Box>
      ) : null}

      {phase.name === 'result' ? (
        <Box data-testid="search-result">
          {phase.data.target ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
              <Typography variant="body1" sx={{ flex: 1 }} data-testid="search-interpretation">
                {phase.data.interpretation}
              </Typography>
              <Button
                variant="contained"
                onClick={() => go(targetHref(phase.data.base, phase.data.target!))}
              >
                Open
              </Button>
            </Box>
          ) : null}
          {phase.data.results.length ? (
            <Box
              component="ul"
              aria-label="Matches by name or ID"
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {phase.data.results.map((r) => (
                <Box component="li" key={`${r.kind}-${r.id}`}>
                  <AppLink
                    href={r.href}
                    onClick={onClose}
                    style={{ display: 'block', padding: '6px 0', textDecoration: 'none' }}
                  >
                    <Typography variant="body2" component="span" color="primary">
                      {r.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      component="span"
                      sx={{ ml: 2 }}
                      color="text.secondary"
                    >
                      {r.label} · {r.id}
                    </Typography>
                  </AppLink>
                </Box>
              ))}
            </Box>
          ) : null}
          {!phase.data.target ? (
            <Typography variant="caption" sx={{ display: 'block', mt: 2 }}>
              <MuiLink
                component={AppLink}
                href={targetHref(phase.data.base, phase.data.fallback)}
                onClick={onClose}
              >
                See all matches by name or ID
              </MuiLink>
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {phase.name === 'nomatch' ? (
        <Typography variant="body2" data-testid="search-nomatch">
          {NO_MATCH_LEAD}{' '}
          <MuiLink
            component={AppLink}
            href={targetHref(phase.data.base, phase.data.fallback)}
            onClick={onClose}
          >
            Search by name or ID
          </MuiLink>{' '}
          instead.
        </Typography>
      ) : null}

      {phase.name === 'error' ? (
        <Typography variant="body2" role="alert" color="error">
          {phase.message}
        </Typography>
      ) : null}

      <Typography variant="caption" sx={{ display: 'block', mt: 4 }}>
        Results come from the simulator&apos;s saved filters
      </Typography>
    </Dialog>
  );
}
