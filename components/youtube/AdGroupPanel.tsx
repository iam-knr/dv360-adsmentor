'use client';

// Ad group slide-over (module 09 2.4): name, targeting (MX-10 YTAG), bid by the line item's bid kind, and the ads of the
// group. Opens from `?sim_panel=adgroup:new|{id}`, saves on its own (C-09-11) and refreshes the page behind it.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import {
  DvModal,
  DvSelect,
  DvSlideOver,
  DvTextField,
  DvUnsavedChangesModal,
} from '@/components/dv';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { TargetingCard } from '@/components/targeting';
import { AD_GROUP_TARGETING_TYPE, DG_AD_GROUP_TARGETING_TYPE } from '@/lib/targeting';
import { LIMITS } from '@/lib/validation/constants/limits';
import { MSG } from '@/lib/validation/messages';
import { AG_007 } from '@/lib/validation/rules/ad-group';
import type { Issue } from '@/lib/validation/types';
import {
  createAdGroupAction,
  deleteAdGroupAction,
  getAdGroupDetailAction,
  getAdGroupDraftAction,
  setAdStatusAction,
  updateAdGroupAction,
} from '@/lib/youtube/actions';
import type { AdGroupDetail, AdGroupFormValue, AdRow, YtStatus } from '@/lib/youtube/types';

type Loaded = Omit<AdGroupDetail, 'id' | 'publicId' | 'version' | 'ads'> &
  Partial<Pick<AdGroupDetail, 'id' | 'publicId' | 'version' | 'ads'>>;

export interface AdGroupPanelProps {
  /** `new` or the ad group row id. */
  adGroupId: string;
  lineItemId: string;
  readOnly: boolean;
  onClose: () => void;
  onOpenAd: (adId: string) => void;
  /** Bumped by the page when an ad was saved, deleted or reviewed, so the ads list reloads. */
  reloadKey?: number;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
];

export function AdGroupPanel({
  adGroupId,
  lineItemId,
  readOnly,
  onClose,
  onOpenAd,
  reloadKey = 0,
}: AdGroupPanelProps) {
  const router = useRouter();
  const creating = adGroupId === 'new';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [value, setValue] = useState<AdGroupFormValue | null>(null);
  const [saved, setSaved] = useState<AdGroupFormValue | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [leave, setLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trackers, setTrackers] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void (creating ? getAdGroupDraftAction(lineItemId) : getAdGroupDetailAction(adGroupId)).then(
      (d) => {
        if (!alive || !d) return;
        setLoaded(d);
        setValue(d.value);
        setSaved(d.value);
      },
    );
    return () => {
      alive = false;
    };
  }, [adGroupId, lineItemId, creating]);

  // Only the ads list reloads; unsaved edits of the group itself stay.
  useEffect(() => {
    if (reloadKey === 0 || creating) return;
    let alive = true;
    // A plain GET: server actions queue behind the navigation that closed the ad panel.
    void fetch(`/api/dv/ad-groups/${adGroupId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<AdGroupDetail>) : null))
      .then((d) => {
        if (alive && d) setLoaded(d);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey, adGroupId, creating]);

  const dirty = useMemo(
    () => !!value && !!saved && JSON.stringify(value) !== JSON.stringify(saved),
    [value, saved],
  );
  const ro = readOnly || !!loaded?.readOnly;
  const err = (p: string) => issues.find((i) => i.path === p && i.blocking)?.message;
  const set = (patch: Partial<AdGroupFormValue>) => setValue((v) => (v ? { ...v, ...patch } : v));
  const cpv = loaded?.lineItemBidKind === 'MAX_CPV';
  const dg = loaded?.kind === 'DEMAND_GEN';
  const ads: AdRow[] = loaded?.ads ?? [];
  const unmatched = issues.filter(
    (i) => i.blocking && !['name', 'bid'].includes(i.path) && !i.path.startsWith('dimensions'),
  );
  const dimensionIssue = issues.find((i) => i.blocking && i.path.startsWith('dimensions'));

  const save = () =>
    start(async () => {
      if (!value) return;
      const res = creating
        ? await createAdGroupAction(lineItemId, value)
        : await updateAdGroupAction(adGroupId, value, loaded?.version);
      if (!res.ok) return setIssues(res.issues);
      onClose();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await deleteAdGroupAction(adGroupId);
      if (!res.ok) return setIssues(res.issues);
      setConfirmDelete(false);
      onClose();
      router.refresh();
    });

  const setAdStatus = (ad: AdRow, status: YtStatus) =>
    start(async () => {
      const res = await setAdStatusAction(ad.id, status);
      if (!res.ok) return setIssues(res.issues);
      const fresh = await getAdGroupDetailAction(adGroupId);
      if (fresh) setLoaded(fresh);
      router.refresh();
    });

  const requestClose = () => (dirty ? setLeave(true) : onClose());
  const title = creating ? 'New ad group' : (value?.name ?? 'Ad group');
  const showNoAds = !creating && ads.length === 0 && value?.status === 'ACTIVE';

  return (
    <>
      <DvSlideOver
        open
        title={title}
        width="wide"
        dirty={dirty}
        onApply={ro ? undefined : save}
        applyLabel={creating ? 'Create ad group' : 'Save'}
        applyDisabled={!value}
        onCancel={requestClose}
        onDelete={creating || ro ? undefined : () => setConfirmDelete(true)}
      >
        {value && loaded ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <DvTextField
              label="Ad group name"
              required
              id="adgroup-name"
              maxLength={LIMITS.NAME_MAX_255}
              value={value.name}
              readOnly={ro}
              error={err('name')}
              onChange={(name) => set({ name })}
            />
            <DvSelect
              label="Status"
              value={value.status}
              disabled={ro}
              options={STATUS_OPTIONS}
              onChange={(status) => set({ status: status as YtStatus })}
            />
            <DvSectionCard title="Ad group targeting" layout="stacked">
              <TargetingCard
                lineItemType={dg ? DG_AD_GROUP_TARGETING_TYPE : AD_GROUP_TARGETING_TYPE}
                value={value.targetingState}
                onChange={(targetingState) => set({ targetingState })}
                readOnly={ro}
              />
              {dimensionIssue ? (
                <Typography role="alert" color="error" variant="body2">
                  {dimensionIssue.message}
                </Typography>
              ) : null}
            </DvSectionCard>
            {dg ? null : (
              <DvSectionCard title="Settings" layout="stacked">
                <DvTextField
                  label={cpv ? 'Max CPV' : 'Target CPM'}
                  required
                  id="adgroup-bid"
                  numeric
                  prefix={loaded.currency}
                  value={value.bid}
                  readOnly={ro}
                  error={err('bid')}
                  onChange={(bid) => set({ bid })}
                />
              </DvSectionCard>
            )}
            <DvSectionCard title="Ads" layout="stacked">
              {dg ? null : (
                <Typography variant="body2" color="text.secondary" data-testid="ag-007">
                  {AG_007.message}
                </Typography>
              )}
              {showNoAds ? (
                <Typography role="status" variant="body2" data-testid="ag-no-ads">
                  {MSG.AG_NO_ADS}
                </Typography>
              ) : null}
              {ads.map((ad) => (
                <Box
                  key={ad.id}
                  data-testid="ad-card"
                  sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ad.thumbnailUrl} alt="" width={96} height={54} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Button variant="text" onClick={() => onOpenAd(ad.id)}>
                      {ad.name}
                    </Button>
                    <Typography variant="caption" display="block">
                      Responsive
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => setTrackers(trackers === ad.id ? null : ad.id)}
                    >
                      Show trackers
                    </Button>
                    {trackers === ad.id ? (
                      <Box component="ul" sx={{ m: 0, pl: 3 }} aria-label="Trackers">
                        {ad.trackers.length === 0 ? <li>No trackers</li> : null}
                        {ad.trackers.map((t) => (
                          <li key={t.url}>
                            {t.kind === 'CLICK' ? 'Click' : 'Impression'}: {t.url}
                          </li>
                        ))}
                      </Box>
                    ) : null}
                  </Box>
                  <Chip
                    size="small"
                    label={ad.reviewStatus.charAt(0) + ad.reviewStatus.slice(1).toLowerCase()}
                    color={ad.reviewStatus === 'REJECTED' ? 'error' : 'default'}
                    title={ad.reviewFeedback ?? undefined}
                  />
                  <Box sx={{ width: 120 }}>
                    <DvSelect
                      ariaLabel={`Status of ${ad.name}`}
                      value={ad.status}
                      disabled={ro}
                      options={STATUS_OPTIONS}
                      onChange={(s) => setAdStatus(ad, s as YtStatus)}
                    />
                  </Box>
                </Box>
              ))}
              {!ro ? (
                <Box>
                  <Button variant="outlined" disabled={creating} onClick={() => onOpenAd('new')}>
                    Create new ad
                  </Button>
                  {creating ? (
                    <Typography variant="caption" display="block" color="text.secondary">
                      Create the ad group first, then add its ads.
                    </Typography>
                  ) : null}
                </Box>
              ) : null}
            </DvSectionCard>
            {unmatched.length > 0 ? (
              <Box role="alert">
                {unmatched.map((i, k) => (
                  <Typography key={k} color="error" variant="body2">
                    {i.message}
                  </Typography>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : (
          <Typography>Loading…</Typography>
        )}
      </DvSlideOver>
      <DvUnsavedChangesModal
        open={leave}
        onDiscard={() => {
          setLeave(false);
          onClose();
        }}
        onContinue={() => setLeave(false)}
      />
      <DvModal
        open={confirmDelete}
        title={`Delete ${value?.name ?? 'ad group'}?`}
        primary={{ label: 'Delete', tone: 'danger', onClick: remove }}
        secondary={{ label: 'Cancel', onClick: () => setConfirmDelete(false) }}
        initialFocus="secondary"
        onClose={() => setConfirmDelete(false)}
      >
        This ad group and its ads will be deleted.
      </DvModal>
    </>
  );
}
