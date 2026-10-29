'use client';

// Ad preview pane (module 09 2.6, Y17): format dropdown, ‹ › through the available formats, device toggles, surface
// tabs and the caption. The model is a pure function of the draft, so it refreshes as the text changes.
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import { DvSelect } from '@/components/dv';
import { DvTabs } from '@/components/dv';
import {
  DEVICE_LABEL,
  DEVICES,
  PREVIEW_MATRIX,
  SURFACE_LABEL,
  SURFACES,
  type PreviewDevice,
  type PreviewSurface,
} from '@/lib/validation/constants/youtube';
import {
  buildPreviewModel,
  FORMAT_FILTER_LABEL,
  type FormatFilter,
  type PreviewDraft,
} from '@/lib/youtube/preview';
import { DvVideoMock } from './DvVideoMock';

const DEVICE_ICON = { PHONE: 'smartphone', COMPUTER: 'computer', TV: 'tv' } as const;

export function AdPreview({ draft }: { draft: PreviewDraft }) {
  const [filter, setFilter] = useState<FormatFilter>('ALL');
  const [format, setFormat] = useState<PreviewModelFormat>(null);
  const [device, setDevice] = useState<PreviewDevice>('PHONE');
  const [surface, setSurface] = useState<PreviewSurface>('YOUTUBE');
  const model = useMemo(
    () => buildPreviewModel(draft, { filter, format, device, surface }),
    [draft, filter, format, device, surface],
  );
  const { selected } = model;
  const current = selected.format;
  const at = current ? model.formats.indexOf(current) : -1;
  const step = (d: -1 | 1) => {
    if (model.formats.length === 0) return;
    setFormat(model.formats[(at + d + model.formats.length) % model.formats.length]!);
  };
  const row = current ? PREVIEW_MATRIX[current] : null;

  return (
    <Box
      data-testid="ad-preview"
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
        <Box sx={{ flex: 1 }}>
          <DvSelect
            ariaLabel="Ad format"
            value={filter}
            options={(Object.keys(FORMAT_FILTER_LABEL) as FormatFilter[]).map((f) => ({
              value: f,
              label: FORMAT_FILTER_LABEL[f],
            }))}
            onChange={(f) => {
              setFilter(f as FormatFilter);
              setFormat(null);
            }}
          />
        </Box>
        <IconButton
          aria-label="Previous format"
          onClick={() => step(-1)}
          disabled={model.formats.length < 2}
        >
          <DvIcon name="chevron_left" />
        </IconButton>
        <IconButton
          aria-label="Next format"
          onClick={() => step(1)}
          disabled={model.formats.length < 2}
        >
          <DvIcon name="chevron_right" />
        </IconButton>
      </Box>
      <ToggleButtonGroup exclusive size="small" value={selected.device} aria-label="Device">
        {DEVICES.map((d) => (
          <ToggleButton
            key={d}
            value={d}
            aria-label={DEVICE_LABEL[d]}
            disabled={!!row && !row.devices.includes(d)}
            onClick={() => setDevice(d)}
          >
            <DvIcon name={DEVICE_ICON[d]} />
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <DvTabs
        ariaLabel="Surface"
        tabs={SURFACES.map((s) => ({
          id: s,
          label: SURFACE_LABEL[s],
          disabled: !!row && !row.surfaces.includes(s),
        }))}
        value={selected.surface}
        onChange={(s) => setSurface(s as PreviewSurface)}
      />
      {model.formats.length === 0 ? (
        <Typography variant="body2" color="text.secondary" data-testid="preview-empty">
          {draft.video
            ? (model.warnings[0] ?? "This video can't serve in the available ad formats.")
            : 'Choose a video to preview your ad.'}
        </Typography>
      ) : (
        <>
          <DvVideoMock model={model} />
          <Typography variant="body2" data-testid="preview-caption">
            {model.caption}
          </Typography>
        </>
      )}
      {model.warnings.length > 0 && model.formats.length > 0 ? (
        <Typography variant="caption" color="text.secondary">
          {model.warnings[0]}
        </Typography>
      ) : null}
    </Box>
  );
}

type PreviewModelFormat = ReturnType<typeof buildPreviewModel>['selected']['format'];
