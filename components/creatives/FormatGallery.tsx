'use client';

// Format gallery (module 12 S6): tabs, a Recommended row, then all formats. Create only when buildable (CRE-080);
// Details opens a side panel with the description, the requirements and the line item types the format can serve in.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvPageHeader } from '@/components/dv/DvPageHeader';
import { DvSlideOver } from '@/components/dv/DvSlideOver';
import { DvStatusChip } from '@/components/dv/DvStatus';
import { DvTabs } from '@/components/dv/DvTabs';
import { DvIcon } from '@/components/icons';
import { useViewer } from '@/components/shell/ViewerProvider';
import {
  FORMAT_TABS,
  FORMAT_TAB_LABEL,
  listFormats,
  supportedLiTypes,
  type FormatDef,
  type FormatTab,
} from '@/lib/creatives/formats';
import { newCreativePath } from '@/lib/creatives/paths';
import { LI_TYPE_LABEL } from '@/lib/validation/constants/li-compat';

function Card({
  format,
  onCreate,
  onDetails,
  canCreate,
}: {
  format: FormatDef;
  onCreate: () => void;
  onDetails: () => void;
  canCreate: boolean;
}) {
  return (
    <Box
      data-testid="format-card"
      aria-label={format.name}
      role="group"
      sx={{
        width: 260,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          height: 140,
          bgcolor: 'surface.sunken',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <DvIcon name="smartphone" size={64} />
      </Box>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography fontWeight={600}>{format.name}</Typography>
          {format.badges.map((b) =>
            b === 'NEW' ? (
              <DvStatusChip key={b} kind="new" />
            ) : b === 'BETA' ? (
              <DvStatusChip key={b} kind="beta" />
            ) : (
              <Typography
                key={b}
                variant="caption"
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.5 }}
              >
                {b}
              </Typography>
            ),
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {format.environments.join(' · ')}
        </Typography>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {format.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {format.buildable && canCreate ? (
            <Button size="small" variant="contained" onClick={onCreate}>
              Create
            </Button>
          ) : null}
          <Button size="small" onClick={onDetails}>
            Details
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export function FormatGallery({
  partnerId,
  advertiserId,
}: {
  partnerId: string;
  advertiserId: string;
}) {
  const { viewer } = useViewer();
  const router = useRouter();
  const [tab, setTab] = useState<FormatTab>('ALL');
  const [details, setDetails] = useState<FormatDef | null>(null);
  const { recommended, all } = listFormats(tab);
  const create = (f: FormatDef) =>
    router.push(newCreativePath(partnerId, advertiserId, f.createKind ?? 'third-party-display'));
  const canCreate = !viewer.readOnly;
  const types = details ? supportedLiTypes(details) : [];

  return (
    <>
      <DvPageHeader title="Format gallery" limitedAccess={viewer.limitedAccess}>
        <DvTabs
          tabs={FORMAT_TABS.map((t) => ({ id: t, label: FORMAT_TAB_LABEL[t] }))}
          value={tab}
          ariaLabel="Format tabs"
          onChange={(id) => setTab(id as FormatTab)}
        />
      </DvPageHeader>
      {recommended.length > 0 ? (
        <Box component="section" aria-label="Recommended formats" sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Recommended formats
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {recommended.map((f) => (
              <Card
                key={f.key}
                format={f}
                canCreate={canCreate}
                onCreate={() => create(f)}
                onDetails={() => setDetails(f)}
              />
            ))}
          </Box>
        </Box>
      ) : null}
      <Box component="section" aria-label="All formats">
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          All formats
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {all.map((f) => (
            <Card
              key={`all-${f.key}`}
              format={f}
              canCreate={canCreate}
              onCreate={() => create(f)}
              onDetails={() => setDetails(f)}
            />
          ))}
        </Box>
      </Box>
      <DvSlideOver
        open={details !== null}
        title={details?.name ?? ''}
        onCancel={() => setDetails(null)}
      >
        {details ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography>{details.description}</Typography>
            <Typography fontWeight={500}>Requirements</Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {details.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </Box>
            <Typography fontWeight={500}>Works in these line item types</Typography>
            <Typography variant="body2">
              {types.length
                ? types.map((t) => LI_TYPE_LABEL[t]).join(', ')
                : 'Not available in this simulator.'}
            </Typography>
          </Box>
        ) : null}
      </DvSlideOver>
    </>
  );
}
