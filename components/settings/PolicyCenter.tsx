'use client';

// Policy center (module 03 2.7, S8): one card per certificate kind with its status and a Request Certificate link
// that opens a small dialog. An instructor decides later (docs/gaps/nav-wire-b.md).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvModal, DvPageHeader, DvSelect, DvTextField } from '@/components/dv';
import { requestCertificateAction } from '@/lib/settings/actions';
import {
  CERT_COUNTRIES,
  CERT_KINDS,
  CERT_STATUS_LABEL,
  type CertKind,
} from '@/lib/settings/constants';
import type { PolicyCenter as PolicyCenterData } from '@/lib/settings/policy';

export function PolicyCenter({
  data,
  advertiserId,
}: {
  data: PolicyCenterData;
  advertiserId: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<CertKind | null>(null);
  const [country, setCountry] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const spec = CERT_KINDS.find((k) => k.kind === kind);

  const request = async () => {
    if (!kind) return;
    const res = await requestCertificateAction(advertiserId, {
      kind,
      ...(country ? { countryCode: country } : {}),
      ...(notes ? { notes } : {}),
    });
    if (res.ok) {
      setKind(null);
      setCountry('');
      setNotes('');
      setErrors({});
      router.refresh();
    } else setErrors(Object.fromEntries(res.issues.map((i) => [i.path || 'form', i.message])));
  };

  return (
    <>
      <DvPageHeader title="Policy center" limitedAccess={data.limitedAccess} />
      <Box sx={{ p: 4, maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="body1">
          Request certificates to advertise certain regulated categories. Each request is reviewed
          by your instructor.
        </Typography>
        {CERT_KINDS.map((k) => {
          const rows = data.certificates.filter((c) => c.kind === k.kind);
          return (
            <Box
              key={k.kind}
              component="section"
              aria-label={k.title}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
                bgcolor: 'background.paper',
                p: 4,
              }}
            >
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Typography variant="cardTitle" component="h3" sx={{ flex: 1 }}>
                  {k.title}
                </Typography>
                <Box sx={{ width: 280 }}>
                  {rows.map((r, i) => (
                    <Typography key={r.id ?? i} variant="body1">
                      {CERT_STATUS_LABEL[r.status]}
                      {r.countryCode ? ` (${r.countryCode})` : ''}
                      {r.status === 'REJECTED' && r.rejectionReason ? `: ${r.rejectionReason}` : ''}
                    </Typography>
                  ))}
                </Box>
              </Box>
              <Button
                variant="text"
                disabled={!data.canRequest}
                onClick={() => setKind(k.kind)}
                sx={{ mt: 1 }}
              >
                Request Certificate
              </Button>
            </Box>
          );
        })}
      </Box>
      <DvModal
        open={kind !== null}
        title="Request certificate"
        onClose={() => setKind(null)}
        secondary={{ label: 'Cancel', onClick: () => setKind(null) }}
        primary={{ label: 'Request', onClick: () => void request() }}
        {...(errors.form || errors.kind ? { error: errors.form ?? errors.kind } : {})}
      >
        <Typography variant="subtitle2">{spec?.title}</Typography>
        {spec?.country ? (
          <DvSelect
            label="Country"
            value={country}
            placeholder="Select a country"
            error={errors.countryCode ?? ''}
            onChange={setCountry}
            options={CERT_COUNTRIES.map((c) => ({ value: c.code, label: c.label }))}
          />
        ) : null}
        <DvTextField label="Notes" multiline rows={3} value={notes} onChange={setNotes} />
      </DvModal>
    </>
  );
}
