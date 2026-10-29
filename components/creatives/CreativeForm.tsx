'use client';

// New creative and Creative details (module 12 S2, S3, 4.2): one form for every kind. Create calls
// `createCreativeAction`, edit calls `updateCreativeAction` with `expectedVersion`. Validation runs on the server with
// the CRE rules and the issues come back by field path, so the messages are the catalogue's, verbatim.
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvFormFooter, focusFirstInvalid } from '@/components/dv/DvFormPage';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import {
  createCreativeAction,
  updateCreativeAction,
  validateCreativeAction,
} from '@/lib/creatives/actions';
import { AI_LABEL_OPTIONS, EXPAND_DIRECTIONS, STATUS_OPTIONS } from '@/lib/creatives/form';
import { hasAiLabel, KIND_META } from '@/lib/creatives/kinds';
import { CREATIVE_LIMITS } from '@/lib/creatives/limits';
import { youtubeIdOf } from '@/lib/validation/rules/creative';
import { MSG } from '@/lib/validation/messages';
import type { CreativeInput } from '@/lib/validation/types';
import { creativePath } from '@/lib/creatives/paths';
import type { WireIssue } from '@/lib/creatives/types';
import { StaleSaveDialog } from '@/components/campaigns/StaleSaveDialog';
import { AssetField } from './AssetField';
import { PreviewDialog } from './PreviewDialog';

export interface CreativeFormProps {
  mode: 'create' | 'edit';
  partnerId: string;
  advertiserId: string;
  initial: CreativeInput;
  creativeId?: string;
  version?: number;
  /** CM360 creatives: only name and status can change (CRE-060). */
  cm360?: boolean;
  readOnly?: boolean;
}

const issueAt = (issues: WireIssue[], path: string, severity?: WireIssue['severity']) =>
  issues.find((i) => i.path === path && (!severity || i.severity === severity));

const num = (v: string | number | null | undefined): string =>
  v === null || v === undefined || v === 0 ? '' : String(v);

export function CreativeForm({
  mode,
  partnerId,
  advertiserId,
  initial,
  creativeId,
  version,
  cm360,
  readOnly,
}: CreativeFormProps) {
  const router = useRouter();
  const [value, setValue] = useState<CreativeInput>(initial);
  const [saved, setSaved] = useState<CreativeInput>(initial);
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [note, setNote] = useState('');
  const [busy, startTransition] = useTransition();
  const [stale, setStale] = useState(false);
  const [testTag, setTestTag] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(saved), [value, saved]);
  useUnsavedGuard(dirty);

  const kind = value.kind;
  const meta = KIND_META[kind];
  const optimized = value.formatKey === 'OPTIMIZED';
  const locked = !!readOnly || !!cm360;
  const noEdit = !!readOnly;

  const set = (patch: Partial<CreativeInput>) => setValue((v) => ({ ...v, ...patch }));
  const err = (path: string) => issueAt(issues, path, 'error')?.message;
  const warn = (path: string) => issueAt(issues, path, 'warning')?.message;

  /** Server rules on blur, merged into the current issues for that field only. */
  const blur = (path: string) => {
    void validateCreativeAction(advertiserId, value, creativeId, 'blur', path).then((all) =>
      setIssues((cur) => [
        ...cur.filter((i) => !i.path.startsWith(path.split('[')[0]!) || i.path === 'source'),
        ...all.filter((i) => i.path.startsWith(path.split('[')[0]!)),
      ]),
    );
  };

  const submit = (overwrite = false) => {
    if (noEdit) return;
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createCreativeAction(advertiserId, value, { note })
          : await updateCreativeAction(advertiserId, creativeId!, value, {
              note,
              ...(version !== undefined && !overwrite ? { expectedVersion: version } : {}),
            });
      if (!res.ok) {
        if (res.code === 'CONFLICT') {
          setStale(true);
          return;
        }
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setIssues(res.warnings ?? []);
      setSaved(value);
      setNote('');
      if (mode === 'create')
        router.push(
          creativePath(partnerId, advertiserId, (res.data as { publicId: string }).publicId),
        );
      else router.refresh();
    });
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const text = (
    label: string,
    key:
      | 'name'
      | 'landingPageUrl'
      | 'integrationCode'
      | 'notes'
      | 'impressionTrackerUrl'
      | 'clickTrackerUrl',
    extra: { maxLength?: number; lock?: boolean; required?: boolean } = {},
  ) => (
    <DvTextField
      label={label}
      id={key}
      value={value[key] ?? ''}
      error={err(key)}
      warning={warn(key)}
      readOnly={extra.lock ?? locked}
      required={extra.required}
      {...(extra.maxLength ? { maxLength: extra.maxLength } : {})}
      onChange={(v) => set({ [key]: v })}
      onBlur={() => blur(key)}
    />
  );
  const check = (label: string, key: keyof CreativeInput, lock = locked) => (
    <FormControlLabel
      control={
        <Checkbox
          checked={!!value[key]}
          disabled={lock}
          onChange={(e) => set({ [key]: e.target.checked })}
        />
      }
      label={label}
    />
  );
  const native = value.native ?? {};
  const setNative = (patch: NonNullable<CreativeInput['native']>) =>
    set({ native: { ...native, ...patch } });
  const opt = value.optimized;
  const setOpt = (patch: Partial<NonNullable<CreativeInput['optimized']>>) =>
    opt && set({ optimized: { ...opt, ...patch } });
  const list = (
    kindKey: 'headlines' | 'descriptions',
    label: string,
    max: number,
    chars: number,
  ) =>
    opt ? (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {opt[kindKey].map((v, i) => (
          <DvTextField
            key={i}
            label={`${label} ${i + 1}`}
            id={`optimized-${kindKey}-${i}`}
            value={v}
            maxLength={chars}
            error={err(`optimized.${kindKey}[${i}]`)}
            readOnly={noEdit}
            onChange={(t) => setOpt({ [kindKey]: opt[kindKey].map((x, j) => (j === i ? t : x)) })}
            onBlur={() => blur(`optimized.${kindKey}`)}
          />
        ))}
        {!noEdit && opt[kindKey].length < max ? (
          <Button
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setOpt({ [kindKey]: [...opt[kindKey], ''] })}
          >
            Add {label.toLowerCase()}
          </Button>
        ) : null}
      </Box>
    ) : null;

  const sizeText = (key: 'width' | 'height', label: string) => (
    <DvTextField
      label={label}
      id={key}
      type="number"
      numeric
      value={num(value[key])}
      readOnly={locked}
      error={key === 'width' ? err('width') : undefined}
      onChange={(v) => set({ [key]: v === '' ? 0 : Number(v) })}
      onBlur={() => blur('width')}
    />
  );

  const title =
    mode === 'create' ? `New ${optimized ? 'optimized' : meta.label} creative` : 'Creative details';

  return (
    <Box component="form" noValidate onSubmit={(e) => e.preventDefault()}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {mode === 'create' ? (
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
        ) : null}
        {cm360 ? <DvBanner kind="info">{MSG.CRE_CM360_READONLY}</DvBanner> : null}
        {errorCount > 0 ? (
          <Typography role="alert" color="error">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}. Fix them to continue.
          </Typography>
        ) : null}

        <DvSectionCard title="Basic details" layout="settings">
          {text('Name', 'name', {
            maxLength: CREATIVE_LIMITS.NAME_MAX,
            lock: noEdit,
            required: true,
          })}
          {mode === 'edit' ? (
            <DvSelect
              label="Status"
              id="status"
              value={value.status ?? 'ACTIVE'}
              options={STATUS_OPTIONS}
              disabled={noEdit}
              error={err('status')}
              warning={warn('status')}
              onChange={(status) => set({ status: status as CreativeInput['status'] })}
            />
          ) : null}
          {kind !== 'THIRD_PARTY_AUDIO' && kind !== 'AUDIO_FILE' && kind !== 'THIRD_PARTY_VIDEO'
            ? text('Landing page URL', 'landingPageUrl', { maxLength: CREATIVE_LIMITS.URL_MAX })
            : text('Landing page URL (optional)', 'landingPageUrl', {
                maxLength: CREATIVE_LIMITS.URL_MAX,
              })}
          {mode === 'edit' && meta.media === 'display' && kind !== 'THIRD_PARTY_DISPLAY'
            ? check("Don't scale to fit device width", 'dontScaleToFit')
            : null}
          {mode === 'edit' ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button onClick={() => setPreviewOpen(true)}>Preview</Button>
            </Box>
          ) : null}
        </DvSectionCard>

        {kind === 'THIRD_PARTY_DISPLAY' ? (
          <>
            <DvSectionCard title="Dimensions" layout="settings">
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                {sizeText('width', 'Width (px)')}
                <Typography sx={{ pt: 4 }}>×</Typography>
                {sizeText('height', 'Height (px)')}
              </Box>
            </DvSectionCard>
            <DvSectionCard title="Technologies and expanding" layout="settings">
              {check('Requires MRAID', 'requiresMraid')}
              {check('Requires HTML5', 'requiresHtml5')}
              <DvSelect
                label="Expanding direction"
                id="expandDirection"
                value={value.expandDirection ?? 'NONE'}
                options={EXPAND_DIRECTIONS}
                disabled={locked}
                error={err('expandDirection')}
                onChange={(expandDirection) => set({ expandDirection })}
              />
              {check('Expands on hover', 'expandsOnHover')}
            </DvSectionCard>
            <DvSectionCard title="Third-party tag" layout="settings">
              <DvTextField
                label="Third-party tag"
                id="thirdPartyTag"
                multiline
                rows={6}
                value={value.thirdPartyTag ?? ''}
                readOnly={locked}
                error={err('thirdPartyTag')}
                warning={warn('thirdPartyTag')}
                onChange={(thirdPartyTag) => set({ thirdPartyTag })}
                onBlur={() => blur('thirdPartyTag')}
              />
              <Button
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => setTestTag(true)}
                disabled={!value.thirdPartyTag?.trim()}
              >
                Test tag
              </Button>
              <DvBanner kind="info">{MSG.CRE_CONSENT}</DvBanner>
            </DvSectionCard>
          </>
        ) : null}

        {meta.asset === 'image-or-html5' ? (
          <DvSectionCard title="Main asset" layout="settings">
            <AssetField
              id="mainAsset"
              label="Main asset"
              accept=".gif,.png,.jpg,.jpeg,.zip,image/gif,image/png,image/jpeg,application/zip"
              asset={value.mainAsset}
              error={err('mainAsset')}
              disabled={locked}
              hint="An image (GIF, PNG or JPEG, up to 150 KB) or an HTML5 ZIP with one HTML file (up to 10 MB)."
              onChange={(mainAsset, u) =>
                set({
                  mainAsset,
                  ...(mainAsset
                    ? {
                        kind:
                          mainAsset.mimeType === 'application/zip'
                            ? 'STANDARD_HTML5'
                            : 'STANDARD_IMAGE',
                      }
                    : {}),
                  ...(u?.width ? { width: u.width, height: u.height ?? 0 } : {}),
                })
              }
            />
            {mainSizeHint(value, warn('width'))}
          </DvSectionCard>
        ) : null}

        {kind === 'VIDEO_FILE' || kind === 'AUDIO_FILE' ? (
          <DvSectionCard
            title={kind === 'VIDEO_FILE' ? 'Video file' : 'Audio file'}
            layout="settings"
          >
            <AssetField
              id="mainAsset"
              label="Main asset"
              accept={
                kind === 'VIDEO_FILE' ? '.mp4,.mov,.webm,video/*' : '.mp3,.ogg,audio/mpeg,audio/ogg'
              }
              asset={value.mainAsset}
              error={err('mainAsset')}
              disabled={locked}
              hint={
                kind === 'VIDEO_FILE'
                  ? 'MP4, MOV or WebM up to 10 MB.'
                  : 'MP3 or OGG, 5 to 180 seconds, up to 10 MB.'
              }
              onChange={(mainAsset) =>
                set({
                  mainAsset,
                  ...(mainAsset?.durationSeconds
                    ? { durationSeconds: mainAsset.durationSeconds }
                    : {}),
                })
              }
            />
            {value.mainAsset && !value.mainAsset.durationSeconds ? (
              <DvTextField
                label="Duration (seconds)"
                id="durationSeconds"
                type="number"
                numeric
                value={num(value.durationSeconds)}
                readOnly={locked}
                onChange={(v) => set({ durationSeconds: v })}
              />
            ) : null}
          </DvSectionCard>
        ) : null}

        {kind === 'VIDEO_FILE' || kind === 'THIRD_PARTY_VIDEO' ? (
          <DvSectionCard title="Skip button" layout="settings">
            {check('Skippable', 'skippable')}
            {value.skippable ? (
              <DvTextField
                label="Skip offset (seconds)"
                id="skipOffsetSec"
                type="number"
                numeric
                value={num(value.skipOffsetSec)}
                readOnly={locked}
                error={err('skipOffsetSec')}
                onChange={(skipOffsetSec) => set({ skipOffsetSec })}
              />
            ) : null}
          </DvSectionCard>
        ) : null}

        {kind === 'YOUTUBE_VIDEO' ? (
          <DvSectionCard title="YouTube video" layout="settings">
            <DvTextField
              label="YouTube video URL or ID"
              id="youtubeVideo"
              value={value.youtubeVideo ?? ''}
              readOnly={locked}
              error={err('youtubeVideo')}
              onChange={(youtubeVideo) => set({ youtubeVideo })}
              onBlur={() => blur('youtubeVideo')}
            />
            {youtubeIdOf(value.youtubeVideo) ? (
              <Typography variant="body2" color="text.secondary">
                Video ID: {youtubeIdOf(value.youtubeVideo)}
              </Typography>
            ) : null}
          </DvSectionCard>
        ) : null}

        {kind === 'THIRD_PARTY_VIDEO' || kind === 'THIRD_PARTY_AUDIO' ? (
          <DvSectionCard title="VAST tag" layout="settings">
            <DvTextField
              label="VAST tag URL or XML"
              id="vastTag"
              multiline
              rows={5}
              value={value.vastTag ?? ''}
              readOnly={locked}
              error={err('vastTag')}
              warning={warn('vastTag')}
              onChange={(vastTag) => set({ vastTag })}
              onBlur={() => blur('vastTag')}
            />
            <DvTextField
              label={
                kind === 'THIRD_PARTY_AUDIO'
                  ? 'Duration (seconds)'
                  : 'Duration (seconds, read from the tag when it has one)'
              }
              id="durationSeconds"
              type="number"
              numeric
              value={num(value.durationSeconds)}
              readOnly={locked}
              onChange={(durationSeconds) => set({ durationSeconds })}
            />
            {kind === 'THIRD_PARTY_VIDEO' ? (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                {sizeText('width', 'Player width (px)')}
                <Typography sx={{ pt: 4 }}>×</Typography>
                {sizeText('height', 'Player height (px)')}
              </Box>
            ) : null}
          </DvSectionCard>
        ) : null}

        {(kind === 'VIDEO_FILE' || kind === 'AUDIO_FILE' || kind === 'YOUTUBE_VIDEO') && !cm360 ? (
          <DvSectionCard title="Trackers" layout="settings">
            {text('Impression tracker URL', 'impressionTrackerUrl')}
            {text('Click tracker URL', 'clickTrackerUrl')}
          </DvSectionCard>
        ) : null}

        {(kind === 'NATIVE_SITE' || kind === 'NATIVE_VIDEO') && !optimized ? (
          <DvSectionCard title="Native assets" layout="settings">
            {(
              [
                ['headline', 'Headline', CREATIVE_LIMITS.NATIVE_HEADLINE_MAX],
                ['body', 'Body', CREATIVE_LIMITS.NATIVE_BODY_MAX],
                ['callToAction', 'Call to action', CREATIVE_LIMITS.NATIVE_CTA_MAX],
                ['advertiserName', 'Advertiser name', CREATIVE_LIMITS.NATIVE_ADVERTISER_MAX],
              ] as const
            ).map(([key, label, max]) => (
              <DvTextField
                key={key}
                label={label}
                id={`native-${key}`}
                value={native[key] ?? ''}
                maxLength={max}
                readOnly={locked}
                error={err(`native.${key}`)}
                onChange={(v) => setNative({ [key]: v })}
                onBlur={() => blur(`native.${key}`)}
              />
            ))}
            <DvTextField
              label="Display URL"
              id="native-displayUrl"
              value={native.displayUrl ?? ''}
              readOnly={locked}
              onChange={(v) => setNative({ displayUrl: v })}
            />
            <AssetField
              id="mainAsset"
              label={kind === 'NATIVE_VIDEO' ? 'Video' : 'Main image (1200x628 or 1200x1200)'}
              accept={
                kind === 'NATIVE_VIDEO' ? '.mp4,.mov,.webm,video/*' : '.gif,.png,.jpg,.jpeg,image/*'
              }
              asset={value.mainAsset}
              error={err('mainAsset')}
              disabled={locked}
              onChange={(mainAsset) => set({ mainAsset })}
            />
            <AssetField
              id="logoAsset"
              label="Logo (square, 128 px or larger)"
              accept=".gif,.png,.jpg,.jpeg,image/*"
              asset={value.logoAsset}
              error={err('logoAsset')}
              disabled={locked}
              onChange={(logoAsset) => set({ logoAsset })}
            />
            <FeedPreview native={native} />
          </DvSectionCard>
        ) : null}

        {optimized && opt ? (
          <DvSectionCard title="Asset group" layout="settings">
            {list(
              'headlines',
              'Headline',
              CREATIVE_LIMITS.OPTIMIZED_HEADLINES_MAX,
              CREATIVE_LIMITS.OPTIMIZED_HEADLINE_CHARS,
            )}
            {list(
              'descriptions',
              'Description',
              CREATIVE_LIMITS.OPTIMIZED_DESCRIPTIONS_MAX,
              CREATIVE_LIMITS.OPTIMIZED_DESCRIPTION_CHARS,
            )}
            <DvTextField
              label="Business name"
              id="optimized-businessName"
              value={opt.businessName ?? ''}
              maxLength={CREATIVE_LIMITS.NATIVE_ADVERTISER_MAX}
              error={err('optimized.businessName')}
              readOnly={noEdit}
              onChange={(businessName) => setOpt({ businessName })}
              onBlur={() => blur('optimized.businessName')}
            />
            <DvTextField
              label="Call to action"
              id="optimized-callToAction"
              value={opt.callToAction ?? ''}
              readOnly={noEdit}
              onChange={(callToAction) => setOpt({ callToAction })}
            />
            <AssetField
              id="mainAsset"
              label="Image"
              accept=".gif,.png,.jpg,.jpeg,image/*"
              asset={value.mainAsset}
              error={err('mainAsset')}
              disabled={noEdit}
              onChange={(mainAsset) => {
                set({ mainAsset });
                setOpt({ imageCount: mainAsset ? 1 : 0 });
              }}
            />
            <AssetField
              id="logoAsset"
              label="Logo"
              accept=".gif,.png,.jpg,.jpeg,image/*"
              asset={value.logoAsset}
              error={err('logoAsset')}
              disabled={noEdit}
              onChange={(logoAsset) => {
                set({ logoAsset });
                setOpt({ logoCount: logoAsset ? 1 : 0 });
              }}
            />
          </DvSectionCard>
        ) : null}

        {hasAiLabel(kind) ? (
          <DvSectionCard title="AI label" layout="settings" collapsible defaultOpen={false}>
            <DvRadioGroup
              label="AI label"
              id="aiLabel"
              value={value.aiLabel === 'UNSET' ? '' : (value.aiLabel ?? '')}
              options={AI_LABEL_OPTIONS}
              readOnly={locked}
              onChange={(v) => set({ aiLabel: v as CreativeInput['aiLabel'] })}
              hint={MSG.CRE_AI_LABEL}
            />
          </DvSectionCard>
        ) : null}

        <DvSectionCard
          title="Additional details"
          layout="settings"
          collapsible
          defaultOpen={mode === 'edit'}
        >
          {kind === 'THIRD_PARTY_DISPLAY'
            ? check('Append HTML tracking tag', 'appendTrackingTag')
            : null}
          {kind === 'THIRD_PARTY_DISPLAY'
            ? check('Requires ping for attribution', 'requiresPing')
            : null}
          {text('Integration code', 'integrationCode')}
          {text('Notes', 'notes')}
        </DvSectionCard>
      </Box>

      {!noEdit ? (
        <DvFormFooter
          mode={mode}
          dirty={dirty || mode === 'create'}
          primaryLabel={busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          onPrimary={() => submit()}
          onSecondary={() => router.back()}
          onReset={() => {
            setValue(saved);
            setIssues([]);
          }}
          note={note}
          onNoteChange={setNote}
        />
      ) : null}
      <PreviewDialog
        open={testTag}
        advertiserId={advertiserId}
        tag={value.thirdPartyTag ?? ''}
        title="Test tag"
        onClose={() => setTestTag(false)}
      />
      {creativeId ? (
        <PreviewDialog
          open={previewOpen}
          advertiserId={advertiserId}
          creativeId={creativeId}
          title={`Preview: ${value.name}`}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      <StaleSaveDialog
        open={stale}
        onReload={() => {
          setStale(false);
          window.location.reload();
        }}
        onKeep={() => {
          setStale(false);
          submit(true);
        }}
      />
    </Box>
  );
}

/** Dimensions read from the file, shown under the drop zone (K2). */
function mainSizeHint(value: CreativeInput, warning: string | undefined) {
  const a = value.mainAsset;
  if (!a) return null;
  return (
    <Typography variant="body2" color={warning ? 'warning.main' : 'text.secondary'}>
      {a.width && a.height ? `${a.width} × ${a.height}` : 'Size unknown'}
      {warning ? `. ${warning}` : ''}
    </Typography>
  );
}

/** Feed-style mock of the native text assets (K6). */
function FeedPreview({ native }: { native: NonNullable<CreativeInput['native']> }) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        maxWidth: 360,
        bgcolor: 'background.paper',
      }}
      aria-label="Preview"
    >
      <Typography variant="caption" color="text.secondary">
        {native.advertiserName || 'Advertiser name'} · Ad
      </Typography>
      <Typography fontWeight={600}>{native.headline || 'Headline'}</Typography>
      <Typography variant="body2">{native.body || 'Body text'}</Typography>
      <Button size="small" variant="outlined" sx={{ mt: 1 }} tabIndex={-1}>
        {native.callToAction || 'Call to action'}
      </Button>
    </Box>
  );
}
