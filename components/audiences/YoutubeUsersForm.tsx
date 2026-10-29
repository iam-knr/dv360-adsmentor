'use client';

// YouTube users (module 14 S8): needs a linked YouTube channel (AUD-090).
import { useState } from 'react';
import { DvBanner, DvSectionCard, DvSelect, DvTextField } from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import { YT_ACTION_LABEL, type AudienceLookups, type YtUserAction } from '@/lib/audiences/wire';
import { AudienceFormShell } from './FormShell';
import { useAudienceSave } from './useAudienceSave';

export function YoutubeUsersForm({
  partnerId,
  advertiserId,
  lookups,
}: {
  partnerId: string;
  advertiserId: string;
  lookups: AudienceLookups;
}) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState(lookups.linkedChannels[0]?.id ?? '');
  const [action, setAction] = useState<YtUserAction>('VIEWED_ANY_VIDEO');
  const [videos, setVideos] = useState('');
  const [days, setDays] = useState('30');
  const dirty = name !== '' || videos !== '' || days !== '30';
  const s = useAudienceSave(partnerId, advertiserId, 'YOUTUBE_USERS', dirty);
  const none = lookups.linkedChannels.length === 0;

  return (
    <AudienceFormShell
      dirty={dirty}
      pending={s.pending}
      warnings={s.warn}
      onCancel={s.cancel}
      onSave={() =>
        s.save({
          kind: 'YOUTUBE_USERS',
          name,
          linkedAccountId: channel || null,
          action,
          videoIds: videos.split(/[\s,]+/).filter(Boolean),
          membershipDays: days,
        })
      }
    >
      {none ? (
        <DvBanner kind="error">
          Link a YouTube channel before creating this audience.{' '}
          <AppLink href={advertiserPath(partnerId, advertiserId, 'linked-accounts')}>Go to linked accounts</AppLink>
        </DvBanner>
      ) : null}
      <DvSectionCard title="Audience details" layout="settings">
        <DvTextField id="audience-name" label="Name" required maxLength={255} value={name} onChange={setName} error={s.err('name')} />
        <DvSelect
          id="audience-channel"
          label="Linked YouTube channel"
          value={channel}
          onChange={setChannel}
          placeholder="Select a channel"
          options={lookups.linkedChannels.map((c) => ({ value: c.id, label: c.name }))}
          error={s.err('linkedAccountId')}
        />
        <DvSelect
          id="audience-action"
          label="User action"
          value={action}
          onChange={(v) => setAction(v as YtUserAction)}
          options={Object.entries(YT_ACTION_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {action === 'VIEWED_SPECIFIC_VIDEOS' ? (
          <DvTextField
            id="audience-videos"
            label="Video IDs"
            multiline
            rows={4}
            value={videos}
            onChange={setVideos}
            hint="One video ID per line"
          />
        ) : null}
        <DvTextField
          id="audience-days"
          label="Membership duration (days)"
          type="number"
          value={days}
          onChange={setDays}
          error={s.err('membershipDays')}
          hint="1 to 540 days"
        />
      </DvSectionCard>
    </AudienceFormShell>
  );
}
