'use client';

// Data manager (module 03 2.5, S5 and S6): tab Connected products (Google tag card) and tab Linked accounts (Link new
// account menu, creator-video card, counts and the linked rows). Linking is instant and simulated.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { DvBanner, DvModal, DvPageHeader, DvTabs, DvTextField } from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import {
  linkAccountAction,
  removeLinkedAccountAction,
  requestCreatorVideoAction,
} from '@/lib/settings/actions';
import { LINK_TYPES, type LinkType } from '@/lib/settings/constants';
import type { DataManager as DataManagerData } from '@/lib/settings/data-manager';

const card = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px',
  bgcolor: 'background.paper',
  p: 4,
} as const;

export function DataManager({
  partnerId,
  advertiserId,
  tab,
  data,
}: {
  partnerId: string;
  advertiserId: string;
  tab: 'connected' | 'linked';
  data: DataManagerData;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [linking, setLinking] = useState<LinkType | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = data.canWrite;

  const go = (id: string) =>
    router.push(
      advertiserPath(partnerId, advertiserId, id === 'linked' ? 'linked-accounts' : 'data-manager'),
    );

  const submit = async () => {
    if (!linking) return;
    const res = await linkAccountAction(advertiserId, { type: linking, displayName: name });
    if (res.ok) {
      setLinking(null);
      setName('');
      setError('');
      setNotice('Account linked.');
      router.refresh();
    } else setError(res.issues[0]?.message ?? 'The account was not linked.');
  };
  const count = (type: string) => data.counts[type] ?? 0;

  return (
    <>
      <DvPageHeader
        title="Data manager (formerly Linked accounts)"
        limitedAccess={data.limitedAccess}
      >
        <DvTabs
          ariaLabel="Data manager"
          value={tab}
          onChange={go}
          tabs={[
            { id: 'connected', label: 'Connected products' },
            { id: 'linked', label: 'Linked accounts' },
          ]}
        />
      </DvPageHeader>
      <Box sx={{ p: 4, maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {notice ? (
          <DvBanner kind="success" level="inline">
            {notice}
          </DvBanner>
        ) : null}
        {tab === 'connected' ? (
          <>
            <Box>
              <Button variant="outlined" disabled>
                + Connect product
              </Button>
            </Box>
            <Box component="section" aria-label="Google tag" sx={card}>
              <Typography variant="cardTitle" component="h3" sx={{ mb: 2 }}>
                Google tag
              </Typography>
              {data.googleTag ? (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Typography variant="body1">{data.googleTag.name}</Typography>
                  <AppLink href={advertiserPath(partnerId, advertiserId, 'fl', 'google-tag')}>
                    Manage
                  </AppLink>
                </Box>
              ) : (
                <Typography variant="body1">No Google tag yet.</Typography>
              )}
            </Box>
          </>
        ) : (
          <>
            <Box>
              <Button
                variant="contained"
                disabled={!canWrite}
                onClick={(e) => setMenu(e.currentTarget)}
              >
                Link new account
              </Button>
              <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
                {LINK_TYPES.map((t) => (
                  <MenuItem
                    key={t.type}
                    onClick={() => {
                      setMenu(null);
                      setLinking(t.type);
                    }}
                  >
                    {t.label}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            <Box
              component="section"
              aria-label="Request access to YouTube creator videos"
              sx={card}
            >
              <Typography variant="cardTitle" component="h3">
                Request access to YouTube creator videos
              </Typography>
              <Typography variant="body2" sx={{ my: 1 }}>
                Creators can share their videos with your advertiser so you can use them in ads.
              </Typography>
              <Button
                variant="outlined"
                disabled={!canWrite}
                onClick={() =>
                  void (async () => {
                    const res = await requestCreatorVideoAction(advertiserId);
                    if (res.ok) {
                      setNotice('Access requested.');
                      router.refresh();
                    }
                  })()
                }
              >
                Request access
              </Button>
            </Box>
            <Box component="section" aria-label="Connected products" sx={card}>
              <Typography variant="cardTitle" component="h3" sx={{ mb: 2 }}>
                Connected products
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Self-service product linking available in the new integration center for:
              </Typography>
              <Typography variant="body1">Analytics (Web + App)</Typography>
              <Typography variant="body1">Display &amp; Video 360</Typography>
              <Typography variant="body2" sx={{ my: 2 }}>
                To link a Merchant Center account, use {data.partnerPublicId} as the ID you send to
                your Merchant Center account owner.
              </Typography>
              <Typography variant="body1">
                Google My Business for YouTube assets: {count('GOOGLE_MY_BUSINESS')} linked
              </Typography>
              <Typography variant="body1">
                YouTube channels: {count('YOUTUBE_CHANNEL')} linked
              </Typography>
            </Box>
            <Box component="section" aria-label="Linked accounts" sx={card}>
              <Typography variant="cardTitle" component="h3" sx={{ mb: 2 }}>
                Linked accounts
              </Typography>
              {data.accounts.length === 0 ? (
                <Typography variant="body2">No accounts linked yet.</Typography>
              ) : (
                data.accounts.map((a) => (
                  <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 1 }}>
                    <Typography sx={{ flex: 1 }}>
                      {a.displayName} · {LINK_TYPES.find((t) => t.type === a.type)?.label ?? a.type}{' '}
                      · {a.status === 'PENDING' ? 'Pending' : 'Linked'}
                    </Typography>
                    {canWrite ? (
                      <Button
                        variant="text"
                        onClick={() =>
                          void (async () => {
                            const res = await removeLinkedAccountAction(advertiserId, a.id);
                            if (res.ok) router.refresh();
                          })()
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </Box>
                ))
              )}
            </Box>
          </>
        )}
      </Box>
      <DvModal
        open={linking !== null}
        title={`Link ${LINK_TYPES.find((t) => t.type === linking)?.label ?? 'account'}`}
        onClose={() => setLinking(null)}
        secondary={{ label: 'Cancel', onClick: () => setLinking(null) }}
        primary={{ label: 'Link', onClick: () => void submit() }}
        {...(error ? { error } : {})}
      >
        <DvTextField label="Account name" required value={name} onChange={setName} />
      </DvModal>
    </>
  );
}
