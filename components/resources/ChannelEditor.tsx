'use client';

// Channel editor panel (module 15 S2): Details and Active Line Items tabs, parsed preview chips, `n / 10000` counter,
// Save disabled until dirty and valid (CH-005), unsaved dialog (CH-006), delete with the CH-008 warning.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { DvModal, DvSlideOver, DvTextField, DvUnsavedChangesModal } from '@/components/dv';
import {
  createChannelAction,
  deleteChannelAction,
  getChannelAction,
  updateChannelAction,
} from '@/lib/resources/actions';
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import { countSiteLines, parseSites } from '@/lib/resources/parse-sites';
import type { ChannelView, WireIssue } from '@/lib/resources/wire';

export interface ChannelEditorProps {
  /** `new` for the create panel, else the channel public id. */
  channelId: string;
  scope: { level: 'advertiser' | 'partner'; id: string };
  readOnly: boolean;
  onClose: () => void;
}

const EMPTY: ChannelView = {
  id: '',
  name: '',
  sites: '',
  siteCount: 0,
  stats: { urls: 0, apps: 0, duplicates: 0, invalid: 0 },
  version: 0,
  ownerScope: 'ADVERTISER',
  lineItems: [],
};

export function ChannelEditor({ channelId, scope, readOnly, onClose }: ChannelEditorProps) {
  const router = useRouter();
  const creating = channelId === 'new';
  const [loaded, setLoaded] = useState<ChannelView | null>(creating ? EMPTY : null);
  const [name, setName] = useState('');
  const [sites, setSites] = useState('');
  const [tab, setTab] = useState('details');
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [leave, setLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (creating) return;
    let alive = true;
    void getChannelAction(channelId).then((v) => {
      if (!alive || !v) return;
      setLoaded(v);
      setName(v.name);
      setSites(v.sites);
    });
    return () => {
      alive = false;
    };
  }, [channelId, creating]);

  const parsed = useMemo(() => parseSites(sites), [sites]);
  const lineCount = countSiteLines(sites);
  const dirty = loaded !== null && (name !== loaded.name || sites !== loaded.sites);
  const clientValid =
    name.trim() !== '' &&
    parsed.invalidLines.length === 0 &&
    lineCount <= RESOURCE_LIMITS.CHANNEL_SITES_MAX;
  const readOnlyChannel = readOnly || loaded?.ownerScope === 'PARTNER';
  const err = (p: string) => issues.find((i) => i.severity === 'error' && i.path === p)?.message;
  const siteError = issues
    .find((i) => i.severity === 'error' && i.path.startsWith('sites'))
    ?.path.startsWith('sites[')
    ? `Line ${Number(/\[(\d+)\]/.exec(issues.find((i) => i.path.startsWith('sites['))!.path)![1]) + 1}: ${issues.find((i) => i.path.startsWith('sites['))!.message}`
    : err('sites');

  const save = () =>
    start(async () => {
      const res = creating
        ? await createChannelAction(scope, { name, sites })
        : await updateChannelAction(
            channelId,
            { name, sites },
            { expectedVersion: loaded!.version },
          );
      if (!res.ok) {
        setIssues(res.issues);
        return;
      }
      onClose();
      router.refresh();
    });

  const remove = (confirmed: boolean) =>
    start(async () => {
      const res = await deleteChannelAction(channelId, confirmed);
      if (!res.ok) return setIssues(res.issues);
      if (!res.data.deleted) return setConfirmDelete(res.data.usedBy);
      setConfirmDelete(null);
      onClose();
      router.refresh();
    });

  const requestClose = () => (dirty ? setLeave(true) : onClose());

  return (
    <>
      <DvSlideOver
        open
        title={creating ? 'New channel' : (loaded?.name ?? 'Channel')}
        width="wide"
        tabs={
          creating
            ? undefined
            : [
                { id: 'details', label: 'Details' },
                { id: 'lis', label: 'Active Line Items' },
              ]
        }
        activeTab={tab}
        onTabChange={setTab}
        dirty={dirty}
        onApply={readOnlyChannel ? undefined : save}
        applyLabel="Save"
        applyDisabled={!dirty || !clientValid}
        onCancel={requestClose}
        onDelete={creating || readOnlyChannel ? undefined : () => remove(false)}
      >
        {tab === 'details' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <DvTextField
              label="Channel name"
              required
              maxLength={255}
              value={name}
              readOnly={readOnlyChannel}
              error={err('name')}
              onChange={setName}
              id="channel-name"
            />
            <DvTextField
              label="Sites"
              placeholder="Type or paste in a new line separated list of URLs or app IDs"
              multiline
              rows={12}
              value={sites}
              readOnly={readOnlyChannel}
              error={siteError}
              hint={`${lineCount.toLocaleString('en-US')} / ${RESOURCE_LIMITS.CHANNEL_SITES_MAX}`}
              onChange={setSites}
              id="channel-sites"
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }} aria-label="Parsed sites">
              <Chip
                size="small"
                label={`${parsed.entries.filter((e) => e.kind === 'URL').length} URLs`}
              />
              <Chip
                size="small"
                label={`${parsed.entries.filter((e) => e.kind !== 'URL').length} apps`}
              />
              {parsed.duplicates > 0 ? (
                <Chip size="small" label={`${parsed.duplicates} duplicates will be removed`} />
              ) : null}
              {parsed.invalidLines.length > 0 ? (
                <Chip size="small" color="error" label={`${parsed.invalidLines.length} invalid`} />
              ) : null}
            </Box>
          </Box>
        ) : (
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Line item</th>
                <th align="left">ID</th>
                <th align="left">Use</th>
              </tr>
            </thead>
            <tbody>
              {(loaded?.lineItems ?? []).map((li) => (
                <tr key={li.publicId}>
                  <td>{li.name}</td>
                  <td>{li.publicId}</td>
                  <td>{li.flag}</td>
                </tr>
              ))}
            </tbody>
            {(loaded?.lineItems ?? []).length === 0 ? (
              <caption>
                <Typography variant="body2">No line items use this channel.</Typography>
              </caption>
            ) : null}
          </Box>
        )}
      </DvSlideOver>
      <DvUnsavedChangesModal
        open={leave}
        variant="channel"
        onDiscard={() => {
          setLeave(false);
          onClose();
        }}
        onContinue={() => setLeave(false)}
      />
      <DvModal
        open={confirmDelete !== null}
        title="Delete channel"
        primary={{ label: 'Delete', tone: 'danger', onClick: () => remove(true) }}
        secondary={{ label: 'Cancel', onClick: () => setConfirmDelete(null) }}
        onClose={() => setConfirmDelete(null)}
      >
        {confirmDelete} line items use this channel. Deleting it removes it from their targeting.
      </DvModal>
    </>
  );
}
