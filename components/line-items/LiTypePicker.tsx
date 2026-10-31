'use client';

// New line item, type picker (module 08 2.2, AC-08-01 to AC-08-03): one card per type of the IO's group, disabled
// cards carry the LI_TYPE_INCOMPAT text, Demand Gen without the prerequisite shows a yellow toast and stays.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTooltip } from '@/components/dv/DvTooltip';
import { LI_TYPE_DESCRIPTION, LI_TYPE_LABEL, isFormType } from '@/lib/line-items/type-config';
import type { IoChoice, LiTypeOption } from '@/lib/line-items/types';
import { ioPath } from '@/lib/routes/paths';

export function LiTypePicker({
  partnerId,
  advertiserId,
  campaignId,
  ioId,
  options,
  ios,
}: {
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  ioId: string;
  options: LiTypeOption[];
  ios: IoChoice[];
}) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const base = (cid: string, io: string) => ioPath(partnerId, advertiserId, cid, io, 'lis', 'new');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box sx={{ maxWidth: 480 }}>
        <DvSelect
          label="Insertion order"
          value={ioId}
          options={ios.map((i) => ({ value: i.publicId, label: `${i.name} (${i.campaignName})` }))}
          onChange={(v) => {
            const io = ios.find((i) => i.publicId === v);
            if (io) router.push(base(io.campaignPublicId, io.publicId));
          }}
        />
      </Box>
      {toast ? (
        <Typography role="status" sx={{ bgcolor: 'warning.light', p: 2, borderRadius: 1 }}>
          {toast}
        </Typography>
      ) : null}
      <Box
        role="group"
        aria-label="Line item types"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 2,
        }}
      >
        {options.map((o) => {
          const card = (
            <Box
              component="button"
              type="button"
              disabled={!o.enabled}
              onClick={() => {
                if (!o.enabled) return;
                if (o.prerequisite) return setToast(o.prerequisite);
                if (!isFormType(o.type))
                  return setToast('This line item type is not available yet.');
                router.push(`${base(campaignId, ioId)}?type=${o.type}`);
              }}
              sx={{
                textAlign: 'left',
                p: 3,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                cursor: o.enabled ? 'pointer' : 'not-allowed',
                opacity: o.enabled ? 1 : 0.5,
                font: 'inherit',
                width: '100%',
              }}
            >
              <Typography variant="subtitle1">{LI_TYPE_LABEL[o.type]}</Typography>
              <Typography variant="body2" color="text.secondary">
                {LI_TYPE_DESCRIPTION[o.type]}
              </Typography>
              {o.reason ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  data-testid={`li-type-reason-${o.type}`}
                  sx={{ display: 'block', mt: 1 }}
                >
                  {o.reason}
                </Typography>
              ) : null}
              {o.prerequisite ? (
                <Typography
                  variant="caption"
                  color="warning.dark"
                  data-testid={`li-type-prereq-${o.type}`}
                  sx={{ display: 'block', mt: 1 }}
                >
                  {o.prerequisite}
                </Typography>
              ) : null}
            </Box>
          );
          return o.reason ? (
            <DvTooltip key={o.type} title={o.reason}>
              <span>{card}</span>
            </DvTooltip>
          ) : (
            <Box key={o.type}>{card}</Box>
          );
        })}
      </Box>
    </Box>
  );
}
