'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvTextField } from '@/components/dv/DvTextField';
import type { Sel, TargetMode, TargetingCriteria } from '@/lib/targeting/types';
import type { EditorProps } from '../editors';
import { ListEditor } from '../ListEditor';
import {
  APPS_URLS_MESSAGES,
  APP_CATALOGUE,
  COLLECTIONS,
  compositeListCsv,
  countSelected,
  parseBulk,
  urlSuggestions,
  type BulkLine,
} from './composite';
import { useTargetingEditorContext } from './context';

type AppsUrls = NonNullable<TargetingCriteria['appsAndUrls']>;
type Category = keyof AppsUrls;

const CATEGORIES: { key: Category; label: string; help: string }[] = [
  {
    key: 'channelIds',
    label: 'Channels',
    help: 'Custom groups of apps and URLs, for example to exclude',
  },
  {
    key: 'collections',
    label: 'Collections',
    help: 'Dynamic groups of related apps provided by the platform',
  },
  { key: 'urls', label: 'URLs', help: 'Individual websites and pages' },
  { key: 'apps', label: 'Apps', help: 'CTV, Android and iOS apps' },
];

const EMPTY: AppsUrls = { channelIds: [], collections: [], urls: [], apps: [] };

/** Replaces or adds `id` in `mode`, so an item is in one mode only (TGT-021). */
function put(list: Sel[], id: string, mode: TargetMode, label?: string): Sel[] {
  return [...list.filter((s) => s.id !== id), { id, mode, ...(label ? { label } : {}) }];
}

export function AppsUrlsEditor({ criteria, onChange, readOnly }: EditorProps) {
  const a: AppsUrls = criteria.appsAndUrls ?? EMPTY;
  const ctx = useTargetingEditorContext();
  const set = (patch: Partial<AppsUrls>) => onChange({ appsAndUrls: { ...a, ...patch } });

  const [view, setView] = useState<Category | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState<TargetMode>('INCLUDE');
  const [rejected, setRejected] = useState<BulkLine[]>([]);
  const [urlText, setUrlText] = useState('');
  const [urlMode, setUrlMode] = useState<TargetMode>('INCLUDE');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const total = countSelected(a);
  const hasContext = (ctx.landingUrls?.length ?? 0) > 0 || (ctx.campaignKeywords?.length ?? 0) > 0;
  const suggestions = urlSuggestions(ctx.landingUrls ?? [], ctx.campaignKeywords ?? []);

  const addUrl = (raw: string, mode: TargetMode) => {
    const { urls, apps, rejected: bad } = parseBulk(raw);
    if (bad.length > 0 || urls.length + apps.length === 0) {
      setUrlError(APPS_URLS_MESSAGES.TGT_020);
      return;
    }
    setUrlError(null);
    let next = a.urls;
    for (const u of urls) next = put(next, u, mode);
    let nextApps = a.apps;
    for (const p of apps) nextApps = put(nextApps, p, mode);
    set({ urls: next, apps: nextApps });
  };

  const addBulk = () => {
    const r = parseBulk(bulkText);
    let urls = a.urls;
    for (const u of r.urls) urls = put(urls, u, bulkMode);
    let apps = a.apps;
    for (const p of r.apps) apps = put(apps, p, bulkMode);
    set({ urls, apps });
    setRejected(r.rejected);
    setBulkText(r.rejected.map((x) => x.text).join('\n'));
    if (r.rejected.length === 0) setBulkOpen(false);
  };

  const download = () => {
    const blob = new Blob([compositeListCsv(a)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'apps-and-urls-composite-list.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  const remove = (key: Category, id: string) => set({ [key]: a[key].filter((s) => s.id !== id) });

  if (view) {
    const cat = CATEGORIES.find((c) => c.key === view)!;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Button size="small" onClick={() => setView(null)}>
            ‹ Choose a category
          </Button>
        </Box>
        <Typography variant="h4" component="h4">
          {cat.label}
        </Typography>
        {view === 'collections' ? (
          <ListEditor
            options={COLLECTIONS}
            value={a.collections}
            readOnly={readOnly}
            searchLabel="Search collections"
            onChange={(collections) => set({ collections })}
          />
        ) : null}
        {view === 'apps' ? (
          <ListEditor
            options={APP_CATALOGUE.map((p) => ({
              code: p.code,
              label: `${p.label} (${p.platform === 'IOS' ? 'iOS' : 'Android'})`,
            }))}
            value={a.apps}
            readOnly={readOnly}
            searchLabel="Search for apps"
            onChange={(apps) => set({ apps })}
          />
        ) : null}
        {view === 'urls' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <DvRadioGroup
              label="Mode"
              value={urlMode}
              readOnly={readOnly}
              onChange={(v) => setUrlMode(v as TargetMode)}
              options={[
                {
                  value: 'INCLUDE',
                  label: `Include (${a.urls.filter((s) => s.mode === 'INCLUDE').length})`,
                },
                {
                  value: 'EXCLUDE',
                  label: `Exclude (${a.urls.filter((s) => s.mode === 'EXCLUDE').length})`,
                },
              ]}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <DvTextField
                label="Add a URL"
                placeholder="example.com/page"
                value={urlText}
                readOnly={readOnly}
                onChange={setUrlText}
                {...(urlError ? { error: urlError } : {})}
              />
              <Button
                variant="outlined"
                disabled={readOnly || !urlText.trim()}
                onClick={() => {
                  addUrl(urlText, urlMode);
                  if (parseBulk(urlText).rejected.length === 0) setUrlText('');
                }}
              >
                Add
              </Button>
            </Box>
          </Box>
        ) : null}
        {view === 'channelIds' ? (
          <Typography variant="body2" color="text.secondary">
            Channels are created in Resources. None are available yet.
          </Typography>
        ) : null}
        {a[view].length > 0 && (view === 'urls' || view === 'channelIds') ? (
          <Box
            component="ul"
            aria-label={`Selected ${cat.label}`}
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {a[view].map((s) => (
              <Box
                component="li"
                key={s.id}
                sx={{ display: 'flex', alignItems: 'center', py: 0.25 }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {s.mode === 'INCLUDE' ? 'Include' : 'Exclude'}: {s.label ?? s.id}
                </Typography>
                {!readOnly ? (
                  <IconButton
                    size="small"
                    aria-label={`Remove ${s.label ?? s.id}`}
                    onClick={() => remove(view, s.id)}
                  >
                    ×
                  </IconButton>
                ) : null}
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" id="apps-urls-category">
        Choose a category:
      </Typography>
      <Box
        role="list"
        aria-labelledby="apps-urls-category"
        sx={{ display: 'flex', flexDirection: 'column' }}
      >
        {CATEGORIES.map((c) => (
          <Box role="listitem" key={c.key}>
            <Button
              fullWidth
              onClick={() => setView(c.key)}
              sx={{ justifyContent: 'space-between', textAlign: 'left', py: 1 }}
              endIcon={<span aria-hidden>›</span>}
            >
              <span>
                <strong>{c.label}</strong>
                {a[c.key].length > 0 ? ` (${a[c.key].length})` : ''}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block' }}
                >
                  {c.help}
                </Typography>
              </span>
            </Button>
          </Box>
        ))}
      </Box>
      {total === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None selected
        </Typography>
      ) : (
        <Typography variant="body2">{total} selected</Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          disabled={readOnly}
          onClick={() => setBulkOpen((o) => !o)}
          aria-expanded={bulkOpen}
        >
          Add multiple apps and URLs at once
        </Button>
        <Button variant="outlined" size="small" onClick={download}>
          Download composite list
        </Button>
      </Box>

      {bulkOpen ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <DvTextField
            ariaLabel="Apps and URLs to add"
            multiline
            rows={5}
            value={bulkText}
            onChange={setBulkText}
            hint="One URL or app ID per line, or separated by commas."
          />
          <DvRadioGroup
            label="Mode"
            value={bulkMode}
            onChange={(v) => setBulkMode(v as TargetMode)}
            options={[
              { value: 'INCLUDE', label: 'Include' },
              { value: 'EXCLUDE', label: 'Exclude' },
            ]}
          />
          {rejected.length > 0 ? (
            <Box role="alert">
              <Typography variant="body2" color="warning.main">
                {APPS_URLS_MESSAGES.TGT_023.replace('{n}', String(rejected.length))}
              </Typography>
              {rejected.map((r) => (
                <Typography key={`${r.line}-${r.text}`} variant="body2" color="error">
                  Line {r.line}: {APPS_URLS_MESSAGES.TGT_020}
                </Typography>
              ))}
            </Box>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" disabled={!bulkText.trim()} onClick={addBulk}>
              Add
            </Button>
            <Button
              onClick={() => {
                setBulkOpen(false);
                setBulkText('');
                setRejected([]);
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      ) : null}

      {hasContext && !dismissed ? (
        <Box
          data-testid="url-suggestions"
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
        >
          <Typography variant="subtitle2">URL suggestions</Typography>
          <Typography variant="body2" color="text.secondary">
            Generated from the landing page URLs and keywords of the campaign.
          </Typography>
          {showSuggestions ? (
            <Box component="ul" aria-label="Suggested URLs" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {suggestions.map((s) => (
                <Box component="li" key={s} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {s}
                  </Typography>
                  <Button size="small" disabled={readOnly} onClick={() => addUrl(s, 'INCLUDE')}>
                    Include
                  </Button>
                </Box>
              ))}
            </Box>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button size="small" onClick={() => setShowSuggestions((s) => !s)}>
              View suggestions
            </Button>
            <Button size="small" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
