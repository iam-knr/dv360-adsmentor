'use client';

// Ad slide-over (module 09 2.5): form on the left, live preview on the right. Opens from `?sim_panel=ad:new&adgroup={id}`
// or `ad:{id}` and saves on its own (C-09-11). Counters and limits come from the validation catalogue (AD-005..AD-016).
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvModal, DvSlideOver, DvTextField, DvUnsavedChangesModal } from '@/components/dv';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { LIMITS } from '@/lib/validation/constants/limits';
import { MSG } from '@/lib/validation/messages';
import { parseYoutubeRef, type UrlProtocol } from '@/lib/validation/constants/youtube';
import type { Issue } from '@/lib/validation/types';
import {
  createAdAction,
  deleteAdAction,
  getAdDetailAction,
  getAdDraftAction,
  lookupVideosAction,
  updateAdAction,
  uploadAdAssetAction,
} from '@/lib/youtube/actions';
import type { PreviewDraft } from '@/lib/youtube/preview';
import type { AdDetail, AdFormValue, YoutubeVideoHit } from '@/lib/youtube/types';
import { AdPreview } from './AdPreview';

const PROTOCOLS = [
  { value: 'https://', label: 'https://' },
  { value: 'http://', label: 'http://' },
];

export interface AdPanelProps {
  /** `new` or the ad row id. */
  adId: string;
  adGroupId: string;
  readOnly: boolean;
  onClose: () => void;
}

export function AdPanel({ adId, adGroupId, readOnly, onClose }: AdPanelProps) {
  const router = useRouter();
  const creating = adId === 'new';
  const [detail, setDetail] = useState<AdDetail | null>(null);
  const [value, setValue] = useState<AdFormValue | null>(null);
  const [saved, setSaved] = useState<AdFormValue | null>(null);
  const [video, setVideo] = useState<YoutubeVideoHit | null>(null);
  const [hits, setHits] = useState<YoutubeVideoHit[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companionUrl, setCompanionUrl] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [leave, setLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [banner, setBanner] = useState(true);
  const [draft, setDraft] = useState<PreviewDraft | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void (creating ? getAdDraftAction(adGroupId) : getAdDetailAction(adId)).then((d) => {
      if (!alive || !d) return;
      setDetail(d);
      setValue(d.value);
      setSaved(d.value);
      setVideo(d.video);
      setLogoUrl(d.logoUrl);
    });
    return () => {
      alive = false;
    };
  }, [adId, adGroupId, creating]);

  // The preview refreshes 300 ms after any media or text change and needs no saved ad (4.3 item 7).
  useEffect(() => {
    if (!detail || !value) return;
    const t = setTimeout(
      () =>
        setDraft({
          video,
          headline: value.headline,
          longHeadline: value.longHeadline,
          description: value.description,
          callToAction: value.callToAction,
          businessName: value.businessName,
          displayUrl: [value.displayUrl, value.path1, value.path2].filter(Boolean).join('/'),
          logoUrl,
          companionBannerUrl: value.companionMode === 'OWN' ? companionUrl : null,
          allowedSurfaces: detail.allowedSurfaces,
          nonSkippable: detail.nonSkippable,
        }),
      300,
    );
    return () => clearTimeout(t);
  }, [detail, value, video, logoUrl, companionUrl]);

  const dirty = useMemo(
    () => !!value && !!saved && JSON.stringify(value) !== JSON.stringify(saved),
    [value, saved],
  );
  const ro = readOnly || !!detail?.readOnly;
  const err = (p: string) => issues.find((i) => i.path === p && i.blocking)?.message;
  const set = (patch: Partial<AdFormValue>) => setValue((v) => (v ? { ...v, ...patch } : v));
  const shown = new Set([
    'name',
    'videoRef',
    'headline',
    'longHeadline',
    'description',
    'callToAction',
    'businessName',
    'logoAssetId',
    'path1',
    'path2',
    'landingPageUrl',
    'clickTrackerUrl',
    'impressionTrackerUrl',
    'companionAssetId',
  ]);

  const lookup = (text: string) => {
    setLookupError(null);
    if (!text.trim()) {
      setVideo(null);
      setHits([]);
      set({ videoId: null });
      return;
    }
    void lookupVideosAction(text).then((rows) => {
      const id = parseYoutubeRef(text);
      if (id) {
        const hit = rows.find((r) => r.videoId === id) ?? null;
        setVideo(hit);
        setHits([]);
        set({ videoId: hit?.videoId ?? null, videoRef: hit?.videoId ?? text });
        if (!hit) setLookupError(MSG.YT_VIDEO_NOT_FOUND);
      } else {
        setHits(rows);
        setVideo(null);
        if (rows.length === 0) setLookupError(MSG.YT_VIDEO_NOT_FOUND);
      }
    });
  };

  const upload = (file: File | undefined, role: 'LOGO' | 'COMPANION') => {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    form.set('role', role);
    form.set('adGroupId', adGroupId);
    void uploadAdAssetAction(form).then((res) => {
      if (!res.ok) return setIssues(res.issues);
      if (role === 'LOGO') {
        set({ logoAssetId: res.data.id });
        setLogoUrl(res.data.url);
      } else {
        set({ companionAssetId: res.data.id });
        setCompanionUrl(res.data.url);
      }
    });
  };

  const save = () =>
    start(async () => {
      if (!value) return;
      const res = creating
        ? await createAdAction(adGroupId, value)
        : await updateAdAction(adId, value, detail?.version);
      if (!res.ok) return setIssues(res.issues);
      onClose();
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await deleteAdAction(adId);
      if (!res.ok) return setIssues(res.issues);
      setConfirmDelete(false);
      onClose();
      router.refresh();
    });

  const requestClose = () => (dirty ? setLeave(true) : onClose());
  const unmatched = issues.filter((i) => i.blocking && !shown.has(i.path));

  return (
    <>
      <DvSlideOver
        open
        title={creating ? 'New ad' : (value?.name ?? 'Ad')}
        width="xwide"
        level={1}
        dirty={dirty}
        onApply={ro ? undefined : save}
        applyLabel={creating ? 'Create ad' : 'Save'}
        applyDisabled={!value}
        onCancel={requestClose}
        onDelete={creating || ro ? undefined : () => setConfirmDelete(true)}
      >
        {value && detail ? (
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 6 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {banner ? (
                <Box role="note" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                  <Typography variant="body2">
                    From 12 Oct 2026 business name and logo are required for YouTube ads. Defaults
                    are set in Advertiser settings › YouTube and Demand Gen.
                  </Typography>
                  <Button size="small" variant="text" onClick={() => setBanner(false)}>
                    Dismiss
                  </Button>
                </Box>
              ) : null}
              <DvTextField
                label="Ad name"
                required
                id="ad-name"
                maxLength={LIMITS.NAME_MAX_255}
                value={value.name}
                readOnly={ro}
                error={err('name')}
                onChange={(name) => set({ name })}
              />
              <DvSectionCard title="Media" layout="stacked">
                <DvTextField
                  label="Video"
                  required
                  id="ad-video"
                  placeholder="Search for a video or paste the URL from YouTube"
                  value={value.videoRef}
                  readOnly={ro}
                  error={err('videoRef') ?? lookupError ?? undefined}
                  onChange={(videoRef) => set({ videoRef })}
                  onBlur={() => lookup(value.videoRef)}
                />
                {hits.length > 0 ? (
                  <Box
                    component="ul"
                    sx={{ listStyle: 'none', p: 0, m: 0 }}
                    aria-label="Video results"
                  >
                    {hits.map((h) => (
                      <li key={h.videoId}>
                        <Button
                          variant="text"
                          onClick={() => {
                            setVideo(h);
                            setHits([]);
                            set({ videoRef: h.videoId, videoId: h.videoId });
                          }}
                        >
                          {h.title} · {h.channelName} · {h.durationSec}s
                        </Button>
                      </li>
                    ))}
                  </Box>
                ) : null}
                {video ? (
                  <Box
                    data-testid="video-card"
                    sx={{ display: 'flex', gap: 2, alignItems: 'center' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={video.thumbnailUrl} alt="" width={96} height={54} />
                    <Box>
                      <Typography variant="subtitle2">{video.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {video.channelName} · {video.durationSec} sec ·{' '}
                        {video.orientation === 'VERTICAL' ? 'Vertical' : 'Horizontal'}
                      </Typography>
                    </Box>
                  </Box>
                ) : null}
                <Box>
                  <Typography variant="subtitle2">Logo</Typography>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" width={48} height={48} />
                  ) : null}
                  {!ro ? (
                    <Button component="label" variant="text" size="small">
                      {logoUrl ? 'Change logo' : 'Add logo'}
                      <input
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        aria-label="Add logo"
                        onChange={(e) => upload(e.target.files?.[0], 'LOGO')}
                      />
                    </Button>
                  ) : null}
                  {err('logoAssetId') ? (
                    <Typography role="alert" color="error" variant="body2">
                      {err('logoAssetId')}
                    </Typography>
                  ) : null}
                </Box>
                <DvRadioGroup
                  label="Companion banner"
                  value={value.companionMode}
                  readOnly={ro}
                  error={err('companionAssetId')}
                  onChange={(m) => set({ companionMode: m as 'NONE' | 'OWN' })}
                  options={[
                    { value: 'NONE', label: 'No companion banner' },
                    { value: 'OWN', label: 'Upload my own image' },
                  ]}
                />
                {value.companionMode === 'OWN' && !ro ? (
                  <Button component="label" variant="text" size="small">
                    Upload companion banner
                    <input
                      hidden
                      type="file"
                      accept="image/png,image/jpeg,image/gif"
                      aria-label="Upload companion banner"
                      onChange={(e) => upload(e.target.files?.[0], 'COMPANION')}
                    />
                  </Button>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  {MSG.YT_AI_LABEL}
                </Typography>
              </DvSectionCard>
              <DvSectionCard title="Text" layout="stacked">
                <DvTextField
                  label="Headline"
                  id="ad-headline"
                  maxLength={LIMITS.AD_HEADLINE_MAX}
                  value={value.headline}
                  readOnly={ro}
                  error={err('headline')}
                  onChange={(headline) => set({ headline })}
                />
                <DvTextField
                  label="Long headline"
                  required
                  id="ad-long-headline"
                  maxLength={LIMITS.AD_LONG_HEADLINE_MAX}
                  value={value.longHeadline}
                  readOnly={ro}
                  error={err('longHeadline')}
                  onChange={(longHeadline) => set({ longHeadline })}
                />
                <DvTextField
                  label="Description"
                  required
                  id="ad-description"
                  maxLength={LIMITS.AD_DESCRIPTION_MAX}
                  value={value.description}
                  readOnly={ro}
                  error={err('description')}
                  onChange={(description) => set({ description })}
                />
                <DvTextField
                  label="Call to action"
                  id="ad-cta"
                  maxLength={LIMITS.AD_CTA_MAX}
                  value={value.callToAction}
                  readOnly={ro}
                  error={err('callToAction')}
                  onChange={(callToAction) => set({ callToAction })}
                />
                <DvTextField
                  label="Business name"
                  required
                  id="ad-business"
                  maxLength={LIMITS.AD_BUSINESS_NAME_MAX}
                  value={value.businessName}
                  readOnly={ro}
                  error={err('businessName')}
                  onChange={(businessName) => set({ businessName })}
                />
              </DvSectionCard>
              <DvSectionCard title="URLs and tracking" layout="stacked">
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DvTextField
                    label="Display URL"
                    id="ad-display-url"
                    placeholder="example.com"
                    value={value.displayUrl}
                    readOnly={ro}
                    onChange={(displayUrl) => set({ displayUrl })}
                  />
                  <DvTextField
                    label="Path 1"
                    id="ad-path1"
                    maxLength={LIMITS.AD_DISPLAY_PATH_MAX}
                    value={value.path1}
                    readOnly={ro}
                    error={err('path1')}
                    onChange={(path1) => set({ path1 })}
                  />
                  <DvTextField
                    label="Path 2"
                    id="ad-path2"
                    maxLength={LIMITS.AD_DISPLAY_PATH_MAX}
                    value={value.path2}
                    readOnly={ro}
                    error={err('path2')}
                    onChange={(path2) => set({ path2 })}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ width: 120 }}>
                    <DvSelect
                      ariaLabel="Landing page protocol"
                      value={value.landingProtocol}
                      disabled={ro}
                      options={PROTOCOLS}
                      onChange={(p) => set({ landingProtocol: p as UrlProtocol })}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <DvTextField
                      label="Landing page URL"
                      required
                      id="ad-landing"
                      value={value.landingPage}
                      readOnly={ro}
                      error={err('landingPageUrl')}
                      onChange={(landingPage) => set({ landingPage })}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ width: 120 }}>
                    <DvSelect
                      ariaLabel="Click tracker protocol"
                      value={value.clickTrackerProtocol}
                      disabled={ro}
                      options={PROTOCOLS}
                      onChange={(p) => set({ clickTrackerProtocol: p as UrlProtocol })}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <DvTextField
                      label="Click tracker URL"
                      id="ad-click-tracker"
                      value={value.clickTracker}
                      readOnly={ro}
                      error={err('clickTrackerUrl')}
                      onChange={(clickTracker) => set({ clickTracker })}
                    />
                  </Box>
                </Box>
                <DvTextField
                  label="Impression tracker URL"
                  id="ad-impression-tracker"
                  value={value.impressionTrackerUrl}
                  readOnly={ro}
                  error={err('impressionTrackerUrl')}
                  onChange={(impressionTrackerUrl) => set({ impressionTrackerUrl })}
                />
                <DvTextField
                  label="URL suffix"
                  id="ad-url-suffix"
                  value={value.urlSuffix}
                  readOnly={ro}
                  onChange={(urlSuffix) => set({ urlSuffix })}
                />
              </DvSectionCard>
              {!creating && detail.reviewStatus !== 'APPROVED' ? (
                <Typography variant="body2" data-testid="review-status">
                  Review status:{' '}
                  {detail.reviewStatus.charAt(0) + detail.reviewStatus.slice(1).toLowerCase()}
                  {detail.reviewFeedback ? ` — ${detail.reviewFeedback}` : ''}
                </Typography>
              ) : null}
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
            <Box>{draft ? <AdPreview draft={draft} /> : null}</Box>
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
        title={`Delete ${value?.name ?? 'ad'}?`}
        primary={{ label: 'Delete', tone: 'danger', onClick: remove }}
        secondary={{ label: 'Cancel', onClick: () => setConfirmDelete(false) }}
        initialFocus="secondary"
        onClose={() => setConfirmDelete(false)}
      >
        This ad will be deleted.
      </DvModal>
    </>
  );
}
