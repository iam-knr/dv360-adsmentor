'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvEmptyState } from '@/components/dv/DvEmptyState';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvTextField } from '@/components/dv/DvTextField';
import { createAnnouncementAction, deleteAnnouncementAction } from '@/lib/instructor/actions';

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  className: string;
  classId: string | null;
  when: string;
  expired: boolean;
}

/** Author announcements shown in the DV360 bell as "Announcement" (module 18 I10). */
export function AnnouncementsView({
  classes,
  items,
  canPlatformWide,
}: {
  classes: { id: string; name: string }[];
  items: AnnouncementItem[];
  canPlatformWide: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState('');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const send = () =>
    start(async () => {
      setError(undefined);
      setSent(false);
      const r = await createAnnouncementAction({
        ...(classId ? { classId } : {}),
        title,
        body,
        ...(route.trim() ? { learnMoreRoute: route.trim() } : {}),
        ...(expires ? { expiresAt: new Date(expires).toISOString() } : {}),
      });
      if (!r.ok) return setError(r.error);
      setTitle('');
      setBody('');
      setRoute('');
      setExpires('');
      setSent(true);
      router.refresh();
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <DvSectionCard title="New announcement">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 560 }}>
          <TextField
            select
            size="small"
            label="Audience"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            {classes.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
            {canPlatformWide ? <MenuItem value="">Everyone (all classes)</MenuItem> : null}
          </TextField>
          <DvTextField label="Title" value={title} onChange={setTitle} maxLength={120} />
          <DvTextField label="Message" value={body} onChange={setBody} multiline rows={4} maxLength={1000} />
          <DvTextField
            label="Link to an app page (optional)"
            placeholder="/sim/me"
            value={route}
            onChange={setRoute}
          />
          <TextField
            size="small"
            label="Expires (optional)"
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {error ? <DvBanner kind="error" level="inline">{error}</DvBanner> : null}
          {sent ? <DvBanner kind="success" level="inline">Announcement sent. It shows in the bell for the class.</DvBanner> : null}
          <Box>
            <Button variant="contained" onClick={send} disabled={pending}>
              Send announcement
            </Button>
          </Box>
        </Box>
      </DvSectionCard>

      <DvSectionCard title="Sent">
        {items.length === 0 ? (
          <DvEmptyState variant="inline" message="No announcements yet." />
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {items.map((a) => (
              <Box component="li" key={a.id} sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="cardTitle">{a.title}</Typography>
                  <Typography variant="body2">{a.body}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {a.className} · {a.when}
                    {a.expired ? ' · expired' : ''}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="error"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteAnnouncementAction(a.id, a.classId ?? undefined);
                      if (!r.ok) setError(r.error);
                      else router.refresh();
                    })
                  }
                >
                  Delete
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </DvSectionCard>
    </Box>
  );
}
