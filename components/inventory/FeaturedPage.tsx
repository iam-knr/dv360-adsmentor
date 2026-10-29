'use client';

// Marketplace, Featured (module 13 S6): promo banner, curated carousels with Bulk assign (n), instant-deal sellers.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvBanner, DvStatusChip } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { FORMAT_LABEL } from '@/lib/inventory/format-compat';
import { INV_MSG } from '@/lib/inventory/messages';
import { discoverPath, instantDealPath, type Scope } from '@/lib/inventory/paths';
import type { FeaturedView, PackageCard } from '@/lib/inventory/types';
import { MarketplaceAssignDialog } from './MarketplaceAssignDialog';
import { MarketplaceHeader } from './MarketplaceTabs';

const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);

function Card({
  item,
  canAssign,
  onAssign,
}: {
  item: PackageCard;
  canAssign: boolean;
  onAssign: () => void;
}) {
  return (
    <Box
      role="listitem"
      data-testid="featured-card"
      sx={{
        width: 240,
        flexShrink: 0,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderTop: '4px solid',
        borderTopColor: 'primary.main',
        borderRadius: 2,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography variant="subtitle2">{item.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        7-day impressions
      </Typography>
      <Typography variant="h6">{compact(item.sevenDayImpressions)}</Typography>
      <Typography variant="caption">
        {item.type} · {FORMAT_LABEL[item.format]}
      </Typography>
      {canAssign ? (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={onAssign}
            aria-label={`Assign ${item.name}`}
          >
            Assign
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

export function FeaturedPage({
  scope,
  view,
  canWrite,
}: {
  scope: Scope;
  view: FeaturedView;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  const writable = canWrite && !viewer.readOnly;
  const [assign, setAssign] = useState<{ ids: string[]; title: string } | null>(null);
  return (
    <>
      <MarketplaceHeader scope={scope} active="featured" />
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {view.banner ? (
          <DvBanner
            kind="info"
            level="inline"
            action={{
              label: view.banner.ctaLabel,
              onClick: () => router.push(discoverPath(scope)),
            }}
          >
            <strong>{view.banner.title}</strong> {view.banner.body}
          </DvBanner>
        ) : null}
        {view.carousels.map((c) => (
          <Box key={c.key} component="section" aria-label={c.title} data-testid="carousel">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h6" component="h2">
                {c.title} ({c.count})
              </Typography>
              <Box sx={{ flex: 1 }} />
              {writable ? (
                <Button
                  variant="outlined"
                  onClick={() =>
                    setAssign({ ids: c.items.map((i) => i.id), title: `Bulk assign: ${c.title}` })
                  }
                >
                  Bulk assign ({c.count})
                </Button>
              ) : null}
            </Box>
            <Box role="list" sx={{ display: 'flex', gap: 3, overflowX: 'auto', py: 1 }}>
              {c.items.map((i) => (
                <Card
                  key={i.id}
                  item={i}
                  canAssign={writable}
                  onAssign={() => setAssign({ ids: [i.id], title: `Assign ${i.name}` })}
                />
              ))}
            </Box>
          </Box>
        ))}
        <Box component="section" aria-label="Create an Instant Deal">
          <Typography variant="h6" component="h2">
            Create an Instant Deal ({view.instantDealSellers.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Connect directly with these exchanges
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 2,
            }}
          >
            {view.instantDealSellers.map((s) => (
              <Box
                key={s.id}
                data-testid="instant-seller"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Typography fontWeight={500}>{s.name}</Typography>
                <Box>
                  <DvStatusChip
                    kind="new"
                    label={s.kind === 'PUBLISHER' ? 'Publisher' : 'Exchange'}
                  />
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    disabled={!writable}
                    title={writable ? undefined : INV_MSG.NOT_WRITER}
                    onClick={() =>
                      router.push(instantDealPath(scope.partnerId, scope.advertiserId))
                    }
                  >
                    Create instant deal
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      {assign ? (
        <MarketplaceAssignDialog
          advertiserId={scope.advertiserId}
          productIds={assign.ids}
          title={assign.title}
          onClose={() => {
            setAssign(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
