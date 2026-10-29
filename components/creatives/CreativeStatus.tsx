'use client';

// Creative status tab (module 12 S4): summary, Display & Video 360 review, Exchange review, Line items and Line item
// eligibility. Everything the engine decided is read here; the only write is Appeal.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { DvBanner } from '@/components/dv/DvBanner';
import { DvSectionCard } from '@/components/dv/DvSectionCard';
import { DvSpinner } from '@/components/dv/DvLoading';
import { DvStatusChip } from '@/components/dv/DvStatus';
import { DvIcon } from '@/components/icons';
import { feedbackFor } from '@/lib/creatives/feedback';
import type { CreativeStatusView, ExchangeReviewRow } from '@/lib/creatives/types';
import { AppLink } from '@/lib/routes/AppLink';
import { liPath, partnerPath } from '@/lib/routes/paths';
import { LI_TYPE_LABEL } from '@/lib/validation/constants/li-compat';
import { AppealDialog, type AppealTarget } from './AppealDialog';

const BANNER_KEY = 'dv-creative-exchange-banner-dismissed';
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB') : '-');

const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(BANNER_KEY) === '1';
  } catch {
    return false;
  }
};

function StatusChip({
  status,
}: {
  status: ExchangeReviewRow['status'] | 'SERVABLE' | 'NOT_SERVABLE';
}) {
  if (status === 'APPROVED') return <DvStatusChip kind="servable" label="Approved" />;
  if (status === 'DISAPPROVED') return <DvStatusChip kind="disapproved" />;
  if (status === 'SERVABLE') return <DvStatusChip kind="servable" />;
  if (status === 'NOT_SERVABLE') return <DvStatusChip kind="disapproved" label="Not servable" />;
  return <DvStatusChip kind="pending" />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 3, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 180 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}

export function CreativeStatus({
  view,
  partnerId,
  advertiserId,
  creativeId,
}: {
  view: CreativeStatusView;
  partnerId: string;
  advertiserId: string;
  creativeId: string;
}) {
  const router = useRouter();
  const [appeal, setAppeal] = useState<AppealTarget[] | null>(null);
  const [more, setMore] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(readDismissed()), []);
  const [fix, setFix] = useState<string | null>(null);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [lis, setLis] = useState(true);
  const [elig, setElig] = useState(true);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(BANNER_KEY, '1');
    } catch {
      /* no storage: the banner comes back next visit */
    }
  };

  const dv = view.dv360;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <DvSectionCard title="Creative summary" layout="settings">
        <Row label="Created">{when(view.created)}</Row>
        <Row label="Modified">{when(view.modified)}</Row>
        <Row label="Review completed">{when(view.reviewCompleted)}</Row>
      </DvSectionCard>

      <DvSectionCard title="Display & Video 360 review" layout="settings">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {dv.status === 'PENDING' ? <DvSpinner size={16} label="Review in progress" /> : null}
          <StatusChip status={dv.status} />
          {dv.status === 'PENDING' && view.pendingHint ? (
            <Typography variant="body2" color="text.secondary">
              {view.pendingHint}
            </Typography>
          ) : null}
        </Box>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography sx={{ flex: 1 }}>{dv.feedback}</Typography>
          {dv.canAppeal ? (
            <Button
              variant="outlined"
              onClick={() => setAppeal([{ exchangeId: null, name: 'Display & Video 360 review' }])}
            >
              Appeal
            </Button>
          ) : null}
        </Box>
        {dv.restrictions.length > 0 ? (
          <Box data-testid="restrictions">
            <Typography fontWeight={500}>Restrictions</Typography>
            {dv.restrictions.map((r) => (
              <Box key={r.id} sx={{ mt: 1 }}>
                <Typography variant="body2">{r.message}</Typography>
                {r.blocksText ? (
                  <Typography variant="body2" color="text.secondary">
                    {r.blocksText}
                  </Typography>
                ) : null}
              </Box>
            ))}
            <Link
              component="button"
              type="button"
              onClick={() => setMore((m) => !m)}
              sx={{ mt: 1 }}
            >
              {more ? 'Show less details' : 'Show more details'}
            </Link>
            {more ? (
              <Typography variant="body2" sx={{ mt: 1 }}>
                A restriction stops this creative from serving in line items that target the
                country. Remove the country from the line item targeting or use a different
                creative.
              </Typography>
            ) : null}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="body2">Is this useful?</Typography>
              <IconButton
                size="small"
                aria-label="Useful"
                aria-pressed={vote === 'up'}
                onClick={() => setVote('up')}
              >
                <DvIcon name={vote === 'up' ? 'thumb_up' : 'thumb_up_off_alt'} size={18} />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Not useful"
                aria-pressed={vote === 'down'}
                onClick={() => setVote('down')}
              >
                <DvIcon name={vote === 'down' ? 'thumb_down' : 'thumb_down_off_alt'} size={18} />
              </IconButton>
            </Box>
          </Box>
        ) : null}
        <Box>
          <Typography fontWeight={500}>Detected destination URLs</Typography>
          {dv.destinationUrls.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              None detected.
            </Typography>
          ) : (
            dv.destinationUrls.map((u) => (
              <Typography key={u} variant="body2">
                {u}
              </Typography>
            ))
          )}
        </Box>
      </DvSectionCard>

      <DvSectionCard title="Exchange review" layout="stacked">
        {view.noExchanges ? (
          <DvBanner
            kind="warning"
            links={[{ label: 'Partner exchanges', href: partnerPath(partnerId, 'details') }]}
          >
            No exchanges are enabled for this partner.
          </DvBanner>
        ) : (
          <>
            <Typography fontWeight={500}>{view.exchangeSummary}</Typography>
            {dismissed ? null : (
              <DvBanner kind="info" onDismiss={dismiss}>
                Contact the respective exchange directly to resolve issues. For GAM issues contact
                DV360 support.
              </DvBanner>
            )}
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  textAlign: 'left',
                  p: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  verticalAlign: 'top',
                },
              }}
            >
              <thead>
                <tr>
                  <th>Exchange</th>
                  <th>Status</th>
                  <th>SSL</th>
                  <th>Feedback</th>
                  <th>Last sync time</th>
                </tr>
              </thead>
              <tbody>
                {view.exchanges.map((e) => (
                  <tr key={e.exchangeId} data-testid="exchange-row">
                    <td>
                      {e.name}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {e.code}
                      </Typography>
                    </td>
                    <td>
                      <StatusChip status={e.status} />
                    </td>
                    <td>
                      <StatusChip status={e.ssl} />
                    </td>
                    <td>
                      {e.feedback ? (
                        <Box>
                          <Typography variant="body2">
                            {feedbackFor(e.reasonCode)?.summary}
                          </Typography>
                          <Link
                            component="button"
                            type="button"
                            onClick={() => setFix(fix === e.exchangeId ? null : e.exchangeId)}
                          >
                            How to fix this?
                          </Link>
                          {fix === e.exchangeId ? (
                            <Box component="ol" sx={{ m: 0, pl: 3 }}>
                              {e.feedback.steps.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </Box>
                          ) : null}
                        </Box>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {when(e.lastSyncAt)}
                      {e.canAppeal ? (
                        <Box>
                          <Link
                            component="button"
                            type="button"
                            onClick={() => setAppeal([{ exchangeId: e.exchangeId, name: e.name }])}
                          >
                            Appeal
                          </Link>
                        </Box>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </>
        )}
      </DvSectionCard>

      <DvSectionCard title="Line items" layout="stacked" collapsible defaultOpen>
        <Link
          component="button"
          type="button"
          onClick={() => setLis((o) => !o)}
          sx={{ alignSelf: 'flex-start' }}
          aria-expanded={lis}
        >
          {view.lineItems.length} associated line items.
        </Link>
        {lis ? (
          view.lineItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              This creative isn&apos;t assigned to a line item.
            </Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {view.lineItems.map((l) => (
                <li key={l.id}>
                  <AppLink
                    href={liPath(
                      partnerId,
                      advertiserId,
                      l.campaignPublicId,
                      l.ioPublicId,
                      l.publicId,
                      'details',
                    )}
                  >
                    {l.name}
                  </AppLink>{' '}
                  ({l.publicId})
                </li>
              ))}
            </Box>
          )
        ) : null}
      </DvSectionCard>

      <DvSectionCard
        title="Line item eligibility"
        layout="stacked"
        collapsible
        defaultOpen
        help="Whether the creative can serve for each line item it is assigned to."
      >
        <Link
          component="button"
          type="button"
          onClick={() => setElig((o) => !o)}
          sx={{ alignSelf: 'flex-start' }}
          aria-expanded={elig}
        >
          Line item eligibility
        </Link>
        {elig ? (
          view.eligibility.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No line items to check.
            </Typography>
          ) : (
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  textAlign: 'left',
                  p: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
              }}
            >
              <thead>
                <tr>
                  <th>Line item</th>
                  <th>Can serve</th>
                  <th>Why not</th>
                  <th>Last 24 hours</th>
                </tr>
              </thead>
              <tbody>
                {view.eligibility.map((r) => (
                  <tr key={r.lineItemId} data-testid="eligibility-row">
                    <td>
                      {r.name}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({LI_TYPE_LABEL[r.type]})
                      </Typography>
                    </td>
                    <td>{r.canServe ? 'Yes' : 'No'}</td>
                    <td>{r.why ?? '-'}</td>
                    <td>{r.lastDay ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          )
        ) : null}
      </DvSectionCard>

      <AppealDialog
        open={appeal !== null}
        advertiserId={advertiserId}
        creativeId={creativeId}
        creativeName={view.name}
        targets={appeal ?? []}
        onClose={() => setAppeal(null)}
        onDone={() => {
          setAppeal(null);
          router.refresh();
        }}
      />
    </Box>
  );
}
