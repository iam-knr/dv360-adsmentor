'use client';

// Pre-step of the two app types (module 08 2.2, AC-08-06, LI-APP-001..004). Mobile app install needs a platform and an
// app from the catalogue; Ads in mobile apps needs a name. The choice goes to the URL (`platform`, `appId`, `adType`,
// `name`), so the form page can build its defaults from it.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { searchAppsAction } from '@/lib/line-items/actions';
import { LI_TYPE_LABEL } from '@/lib/line-items/type-config';
import type { AppSearchRow } from '@/lib/line-items/types';

type Platform = 'ALL' | 'IOS' | 'ANDROID';

export function LiAppPreStep({
  type,
  base,
}: {
  type: 'MOBILE_APP_INSTALL' | 'ADS_IN_MOBILE_APPS';
  /** `[IO]/lis/new` */
  base: string;
}) {
  const router = useRouter();
  const install = type === 'MOBILE_APP_INSTALL';
  const [platform, setPlatform] = useState<Platform>('ALL');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AppSearchRow[]>([]);
  const [app, setApp] = useState<AppSearchRow | null>(null);
  const [name, setName] = useState('');
  const [adType, setAdType] = useState<'DISPLAY' | 'VIDEO'>('DISPLAY');

  useEffect(() => {
    if (!install || !query.trim()) return;
    let current = true;
    const timer = setTimeout(() => {
      void searchAppsAction(platform, query).then((rows) => {
        if (current) setResults(rows);
      });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [install, platform, query]);

  const ready = install ? !!app : name.trim().length > 0;
  const next = () => {
    if (!ready) return;
    const p = new URLSearchParams({ type, adType });
    if (install && app) {
      p.set('platform', platform);
      p.set('appId', app.id);
    } else p.set('name', name.trim());
    router.push(`${base}?${p.toString()}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 640 }}>
      <Typography variant="h2" component="h2">
        {LI_TYPE_LABEL[type]}
      </Typography>
      {install ? (
        <>
          <DvSelect
            label="Platform"
            value={platform}
            options={[
              { value: 'ALL', label: 'All platforms' },
              { value: 'IOS', label: 'iOS' },
              { value: 'ANDROID', label: 'Android' },
            ]}
            onChange={(v) => {
              setPlatform(v as Platform);
              setApp(null);
              setResults([]);
            }}
          />
          <DvTextField
            label="Mobile app"
            placeholder="Search for Android or iOS apps"
            id="app-search"
            value={query}
            onChange={(v) => {
              setQuery(v);
              if (!v.trim()) setResults([]);
              setApp(null);
            }}
          />
          <Box role="listbox" aria-label="Apps" sx={{ display: 'flex', flexDirection: 'column' }}>
            {results.map((r) => (
              <Box
                key={r.id}
                component="button"
                type="button"
                role="option"
                aria-selected={app?.id === r.id}
                onClick={() => setApp(r)}
                sx={{
                  textAlign: 'left',
                  p: 2,
                  border: 1,
                  borderColor: app?.id === r.id ? 'primary.main' : 'divider',
                  bgcolor: 'background.paper',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <Typography variant="subtitle1">{r.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {r.publisher} · {r.storeLine}
                </Typography>
              </Box>
            ))}
            {query.trim() && results.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No apps found
              </Typography>
            ) : null}
          </Box>
        </>
      ) : (
        <DvTextField label="Line item name" id="name" required value={name} onChange={setName} />
      )}
      <DvRadioGroup
        label="Ad type"
        value={adType}
        onChange={(v) => setAdType(v as 'DISPLAY' | 'VIDEO')}
        options={[
          { value: 'DISPLAY', label: 'Display' },
          { value: 'VIDEO', label: 'Video' },
        ]}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="contained" disabled={!ready} onClick={next}>
          Next
        </Button>
        <Button variant="text" onClick={() => router.back()}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
