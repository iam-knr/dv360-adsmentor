'use client';

// Demand Gen ad slide-over (module 09 4.6): a video, image or carousel ad with the Demand Gen limits (headline 40,
// description 90, business name 25) and a simple card preview for Discover, Gmail and YouTube. Same URL contract as
// `AdPanel`: `?sim_panel=ad:new|{id}&adgroup={id}`, saves on its own.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvModal, DvSlideOver, DvTextField, DvUnsavedChangesModal } from '@/components/dv';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTabs } from '@/components/dv';
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
import {
  DG_CAROUSEL_MAX,
  DG_FORMAT_LABEL,
  DG_FORMATS,
  DG_IMAGE_HELP,
  DG_SURFACE_LABEL,
  DG_SURFACES,
  dgCaption,
  type DgFormat,
  type DgSurface,
} from '@/lib/youtube/dg';
import type { AdDetail, AdFormValue, YoutubeVideoHit } from '@/lib/youtube/types';
import type { AdPanelProps } from './AdPanel';

const PROTOCOLS = [
  { value: 'https://', label: 'https://' },
  { value: 'http://', label: 'http://' },
];

export function DgAdPanel({ adId, adGroupId, readOnly, onClose }: AdPanelProps) {
  const router = useRouter();
  const creating = adId === 'new';
  const [detail, setDetail] = useState<AdDetail | null>(null);
  const [value, setValue] = useState<AdFormValue | null>(null);
  const [saved, setSaved] = useState<AdFormValue | null>(null);
  const [video, setVideo] = useState<YoutubeVideoHit | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [surface, setSurface] = useState<DgSurface>('DISCOVER');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [leave, setLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void (creating ? getAdDraftAction(adGroupId) : getAdDetailAction(adId)).then((d) => {
      if (!alive || !d) return;
      setDetail(d);
      const v = { ...d.value, dgFormat: d.value.dgFormat ?? ('DEMAND_GEN_IMAGE' as DgFormat) };
      setValue(v);
      setSaved(v);
      setVideo(d.video);
      setImages(d.imageUrls);
      setLogoUrl(d.logoUrl);
    });
    return () => {
      alive = false;
    };
  }, [adId, adGroupId, creating]);

  const dirty = useMemo(
    () => !!value && !!saved && JSON.stringify(value) !== JSON.stringify(saved),
    [value, saved],
  );
  const ro = readOnly || !!detail?.readOnly;
  const err = (p: string) => issues.find((i) => i.path === p && i.blocking)?.message;
  const set = (patch: Partial<AdFormValue>) => setValue((v) => (v ? { ...v, ...patch } : v));
  const known = new Set([
    'name',
    'dgFormat',
    'videoRef',
    'imageAssetIds',
    'headline',
    'description',
    'callToAction',
    'businessName',
    'landingPageUrl',
  ]);
  const unmatched = issues.filter((i) => i.blocking && !known.has(i.path));
  const format = value?.dgFormat ?? 'DEMAND_GEN_IMAGE';

  const lookup = (text: string) => {
    setLookupError(null);
    if (!text.trim()) return setVideo(null);
    void lookupVideosAction(text).then((rows) => {
      const id = parseYoutubeRef(text);
      const hit = (id ? rows.find((r) => r.videoId === id) : rows[0]) ?? null;
      setVideo(hit);
      set({ videoId: hit?.videoId ?? null, ...(hit ? { videoRef: hit.videoId } : {}) });
      if (!hit) setLookupError(MSG.YT_VIDEO_NOT_FOUND);
    });
  };

  const upload = (files: FileList | null, role: 'LOGO' | 'IMAGE') => {
    for (const file of Array.from(files ?? [])) {
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
          setValue((v) => (v ? { ...v, imageAssetIds: [...v.imageAssetIds, res.data.id] } : v));
          setImages((cur) => [...cur, { id: res.data.id, url: res.data.url }]);
        }
      });
    }
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
  const hero = format === 'DEMAND_GEN_VIDEO' ? video?.thumbnailUrl : images[0]?.url;

  return (
    <>
      <DvSlideOver
        open
        title={creating ? 'New Demand Gen ad' : (value?.name ?? 'Ad')}
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
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 6 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                <DvRadioGroup
                  label="Ad format"
                  value={format}
                  readOnly={ro || !creating}
                  error={err('dgFormat')}
                  onChange={(f) => set({ dgFormat: f as DgFormat })}
                  options={DG_FORMATS.map((f) => ({ value: f, label: DG_FORMAT_LABEL[f] }))}
                />
                {format === 'DEMAND_GEN_VIDEO' ? (
                  <>
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
                    {video ? (
                      <Typography variant="body2" data-testid="video-card">
                        {video.title} · {video.channelName} · {video.durationSec} sec
                      </Typography>
                    ) : null}
                  </>
                ) : (
                  <Box>
                    <Typography variant="subtitle2">
                      {format === 'DEMAND_GEN_CAROUSEL'
                        ? `Images (2 to ${DG_CAROUSEL_MAX})`
                        : 'Image'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {DG_IMAGE_HELP}
                    </Typography>
                    <Box
                      sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', my: 2 }}
                      data-testid="dg-images"
                    >
                      {images.map((img) => (
                        <Box key={img.id} sx={{ position: 'relative' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" width={96} height={54} />
                          {!ro ? (
                            <Button
                              size="small"
                              variant="text"
                              aria-label="Remove image"
                              onClick={() => {
                                setImages((cur) => cur.filter((x) => x.id !== img.id));
                                set({
                                  imageAssetIds: value.imageAssetIds.filter((x) => x !== img.id),
                                });
                              }}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </Box>
                      ))}
                    </Box>
                    {!ro ? (
                      <Button component="label" variant="outlined" size="small">
                        Upload images
                        <input
                          hidden
                          multiple={format === 'DEMAND_GEN_CAROUSEL'}
                          type="file"
                          accept="image/png,image/jpeg,image/gif"
                          aria-label="Upload images"
                          onChange={(e) => upload(e.target.files, 'IMAGE')}
                        />
                      </Button>
                    ) : null}
                    {err('imageAssetIds') ? (
                      <Typography role="alert" color="error" variant="body2">
                        {err('imageAssetIds')}
                      </Typography>
                    ) : null}
                  </Box>
                )}
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
                        onChange={(e) => upload(e.target.files, 'LOGO')}
                      />
                    </Button>
                  ) : null}
                </Box>
              </DvSectionCard>
              <DvSectionCard title="Text" layout="stacked">
                <DvTextField
                  label="Headline"
                  id="ad-headline"
                  maxLength={LIMITS.DG_HEADLINE_MAX}
                  value={value.headline}
                  readOnly={ro}
                  error={err('headline')}
                  onChange={(headline) => set({ headline })}
                />
                <DvTextField
                  label="Description"
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
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ width: 120 }}>
                    <DvSelect
                      ariaLabel="Final URL protocol"
                      value={value.landingProtocol}
                      disabled={ro}
                      options={PROTOCOLS}
                      onChange={(p) => set({ landingProtocol: p as UrlProtocol })}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <DvTextField
                      label="Final URL"
                      required
                      id="ad-landing"
                      value={value.landingPage}
                      readOnly={ro}
                      error={err('landingPageUrl')}
                      onChange={(landingPage) => set({ landingPage })}
                    />
                  </Box>
                </Box>
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
            <Box data-testid="ad-preview" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <DvTabs
                ariaLabel="Surface"
                tabs={DG_SURFACES.map((s) => ({ id: s, label: DG_SURFACE_LABEL[s] }))}
                value={surface}
                onChange={(s) => setSurface(s as DgSurface)}
              />
              <Box
                data-testid="dg-card"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  maxWidth: 320,
                }}
              >
                <Box
                  sx={{
                    aspectRatio: surface === 'GMAIL' ? '3 / 1' : '1.91 / 1',
                    bgcolor: 'action.disabledBackground',
                    backgroundImage: hero ? `url(${hero})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <Box sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Ad · {value.businessName || 'Business name'}
                  </Typography>
                  <Typography variant="subtitle2">{value.headline || 'Headline'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {value.description || 'Description'}
                  </Typography>
                  {value.callToAction ? (
                    <Typography variant="caption">{value.callToAction}</Typography>
                  ) : null}
                </Box>
              </Box>
              <Typography variant="body2" data-testid="preview-caption">
                {dgCaption(format, surface)}
              </Typography>
            </Box>
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
