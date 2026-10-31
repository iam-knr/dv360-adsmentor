'use client';

// Negotiation page (module 13 S10): Terms · Conversation · Actions (Counter, Accept, Decline).
import { useState } from 'react';
import { formatMoney } from '@/lib/money';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {
  DvBanner,
  DvEntityHeader,
  DvModal,
  DvSectionCard,
  DvTextField,
  useToast,
} from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import {
  acceptNegotiationAction,
  counterNegotiationAction,
  declineNegotiationAction,
} from '@/lib/inventory/actions';
import { dealPath, negotiationsPath, type Scope } from '@/lib/inventory/paths';
import type { NegotiationView } from '@/lib/inventory/types';
import { AppLink } from '@/lib/routes/AppLink';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PROPOSED: 'Proposed',
  COUNTERED: 'Countered',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
};
const money = (n: number, code: string) =>
  formatMoney(n, code);
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '-';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Box>
  );
}

export function NegotiationPage({ scope, view }: { scope: Scope; view: NegotiationView }) {
  const router = useRouter();
  const toast = useToast();
  const { viewer } = useViewer();
  const r = view.row;
  const writable = view.canWrite && !viewer.readOnly;
  const yourTurn = (r.status === 'PROPOSED' || r.status === 'COUNTERED') && r.awaiting === 'BUYER';
  const [counter, setCounter] = useState(false);
  const [rate, setRate] = useState('');
  const [volume, setVolume] = useState(view.terms.volume === null ? '' : String(view.terms.volume));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const done = (message: string) => {
    toast.show({ message });
    router.refresh();
  };
  const failToast = (issues: { message: string }[]) =>
    toast.show({ kind: 'error', message: issues[0]?.message ?? 'Something went wrong.' });

  const sendCounter = async () => {
    const res = await counterNegotiationAction(scope.advertiserId, r.id, {
      rate: rate.trim() === '' ? null : Number(rate),
      volume: volume.trim() === '' ? null : Number(volume),
      note,
    });
    if (!res.ok) return setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
    setCounter(false);
    setErrors({});
    done('Your counter was sent');
  };

  return (
    <>
      <DvEntityHeader
        crumbs={[{ label: 'Negotiations', href: negotiationsPath(scope) }]}
        title={r.name}
        status={<span data-testid="negotiation-status">{STATUS_LABEL[r.status] ?? r.status}</span>}
      />
      <Box sx={{ px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {view.banner ? (
          <DvBanner kind={yourTurn ? 'info' : 'warning'} level="inline">
            <span data-testid="negotiation-banner">{view.banner}</span>
          </DvBanner>
        ) : null}
        <DvSectionCard title="Terms" layout="stacked">
          <Row label="Seller" value={r.sellerName} />
          <Row label="RFP ID" value={r.rfpId} />
          <Row label="Rate" value={`${money(view.terms.rate, view.currencyCode)} CPM (Fixed)`} />
          <Row
            label="Volume"
            value={
              view.terms.volume === null
                ? '-'
                : `${view.terms.volume.toLocaleString('en-IN')} impressions`
            }
          />
          <Row label="Dates" value={`${date(view.terms.startAt)} to ${date(view.terms.endAt)}`} />
          <Row label="Format" value={view.terms.format ?? '-'} />
          <Row label="Targeting" value={view.terms.targeting ?? '-'} />
          <Row label="Commitment" value={view.terms.commitment} />
          {view.resultingDeal ? (
            <Row
              label="Deal"
              value={
                <AppLink href={dealPath(scope, view.resultingDeal.publicId)}>
                  {view.resultingDeal.name}
                </AppLink>
              }
            />
          ) : null}
        </DvSectionCard>
        <DvSectionCard title="Conversation" layout="stacked">
          <Box
            component="ol"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
            aria-label="Conversation"
          >
            {view.messages.map((m) => (
              <li key={m.id} data-testid="negotiation-message">
                <Typography variant="caption" color="text.secondary">
                  {m.authorKind === 'SELLER' ? r.sellerName : 'You'} ·{' '}
                  {new Date(m.sentAt).toLocaleString('en-GB', { timeZone: 'UTC' })}
                </Typography>
                <Typography variant="body2">{m.body}</Typography>
                {m.proposedRate !== null ? (
                  <Typography variant="caption">
                    Proposed {money(m.proposedRate, view.currencyCode)} CPM
                    {m.proposedVolume !== null
                      ? `, ${m.proposedVolume.toLocaleString('en-IN')} impressions`
                      : ''}
                  </Typography>
                ) : null}
              </li>
            ))}
          </Box>
        </DvSectionCard>
        {yourTurn ? (
          <DvSectionCard title="Actions" layout="stacked">
            {view.finalOffer ? (
              <Typography variant="body2" sx={{ mb: 2 }} data-testid="final-offer">
                The seller has made a final offer. Accept or decline it.
              </Typography>
            ) : null}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {!view.finalOffer ? (
                <Button variant="outlined" disabled={!writable} onClick={() => setCounter(true)}>
                  Counter
                </Button>
              ) : null}
              <Button
                variant="contained"
                disabled={!writable}
                onClick={() => {
                  void (async () => {
                    const res = await acceptNegotiationAction(scope.advertiserId, r.id);
                    if (!res.ok) return failToast(res.issues);
                    done('The negotiation was accepted. A draft deal was created.');
                  })();
                }}
              >
                Accept
              </Button>
              <Button
                disabled={!writable}
                onClick={() => {
                  void (async () => {
                    const res = await declineNegotiationAction(scope.advertiserId, r.id);
                    if (!res.ok) return failToast(res.issues);
                    done('The negotiation was declined');
                  })();
                }}
              >
                Decline
              </Button>
            </Box>
          </DvSectionCard>
        ) : null}
      </Box>
      <DvModal
        open={counter}
        title="Counter proposal"
        size="sm"
        onClose={() => setCounter(false)}
        primary={{ label: 'Send counter', onClick: () => void sendCounter() }}
        secondary={{ label: 'Cancel', onClick: () => setCounter(false) }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DvTextField
            label="Rate (CPM)"
            type="number"
            value={rate}
            prefix={view.currencyCode === 'INR' ? '₹' : view.currencyCode}
            onChange={setRate}
            error={errors.rate}
          />
          <DvTextField
            label="Volume"
            type="number"
            value={volume}
            onChange={setVolume}
            error={errors.volume}
          />
          <DvTextField label="Note" multiline rows={3} value={note} onChange={setNote} />
        </Box>
      </DvModal>
    </>
  );
}
