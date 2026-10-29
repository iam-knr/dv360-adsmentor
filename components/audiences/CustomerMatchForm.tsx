'use client';

// Customer match (module 14 S7): step 1 chooses the data source (AUD-020), step 2 depends on it. Identifiers in an
// uploaded file are hashed with SHA-256 in the browser before they leave it, so no personal data reaches the server.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvBanner, DvRadioGroup, DvSectionCard, DvSelect, DvTextField } from '@/components/dv';
import { AppLink } from '@/lib/routes/AppLink';
import { advertiserPath } from '@/lib/routes/paths';
import {
  CONNECTED_PRODUCTS,
  CONTACT_LABEL,
  type ContactTypeKey,
} from '@/lib/audiences/wire';
import { AudienceFormShell } from './FormShell';
import { useAudienceSave, type SaveOk } from './useAudienceSave';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ID_HEADER = /^(e-?mail|email address|phone|phone number|mobile|address|mailing address|street|zip|postal code|mobile[_ ]?device[_ ]?id|device[_ ]?id|idfa|aaid|maid|hashed[_ ]?\w+)$/i;

/** Keeps the header and hashes every cell under an identifier column. Other columns are dropped. */
export async function hashCsv(text: string): Promise<string> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return '';
  const header = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const keep = header.map((h, i) => (ID_HEADER.test(h) ? i : -1)).filter((i) => i >= 0);
  if (keep.length === 0) return text;
  const out = [keep.map((i) => header[i]).join(',')];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    out.push((await Promise.all(keep.map((i) => sha256((cells[i] ?? '').replace(/^"|"$/g, ''))))).join(','));
  }
  return out.join('\n');
}

type Source = 'CONNECT' | 'UPLOAD' | 'LATER';

export function CustomerMatchForm({ partnerId, advertiserId }: { partnerId: string; advertiserId: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState<Source | ''>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState<ContactTypeKey>('EMAIL');
  const [product, setProduct] = useState('');
  const [days, setDays] = useState('30');
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<SaveOk | null>(null);
  const [chooseError, setChooseError] = useState<string>();
  const dirty = source !== '' || name !== '';
  const s = useAudienceSave(partnerId, advertiserId, 'CUSTOMER_MATCH', dirty);

  const onFile = async (f: File | undefined) => {
    if (!f) return setFile(null);
    setFile({ name: f.name, text: await hashCsv(await f.text()) });
  };

  if (step === 1) {
    return (
      <AudienceFormShell
        dirty={source !== ''}
        onCancel={s.cancel}
        primaryLabel="Continue"
        onSave={() => {
          if (!source) return setChooseError('A selection is required');
          setStep(2);
        }}
      >
        <DvSectionCard title="Choose a data source" layout="stacked">
          <DvRadioGroup
            label="Data source"
            variant="cards"
            value={source}
            error={chooseError}
            onChange={(v) => {
              setSource(v as Source);
              setChooseError(undefined);
            }}
            options={[
              { value: 'CONNECT', label: 'Connect a new product', description: 'Pick a connected data product.' },
              { value: 'UPLOAD', label: 'Upload a file manually', description: 'Upload a CSV of customer identifiers.' },
              { value: 'LATER', label: 'Skip this step and set up a data source later', description: 'Create an empty list now.' },
            ]}
          />
        </DvSectionCard>
      </AudienceFormShell>
    );
  }

  if (result?.match) {
    return (
      <DvSectionCard title="Upload result" layout="stacked">
        <Box data-testid="match-result" sx={{ display: 'flex', gap: 6, mb: 3 }}>
          <Stat label="Rows uploaded" value={result.match.rows.toLocaleString('en-US')} />
          <Stat label="Matched users" value={result.match.matched.toLocaleString('en-US')} />
          <Stat label="Match rate" value={`${result.match.matchRatePct}%`} />
        </Box>
        {result.match.matched < 1000 ? (
          <DvBanner kind="warning">This list has fewer than 1,000 matched users and may not deliver.</DvBanner>
        ) : null}
        <Typography variant="body2" sx={{ my: 2 }}>
          The list will be available in about 4 hours.
        </Typography>
        <AppLink href={advertiserPath(partnerId, advertiserId, 'first-party-audiences')}>Back to all audiences</AppLink>
      </DvSectionCard>
    );
  }

  return (
    <AudienceFormShell
      dirty={dirty}
      pending={s.pending}
      warnings={s.warn}
      onCancel={s.cancel}
      onSave={() =>
        s.save(
          {
            kind: 'CUSTOMER_MATCH',
            name,
            description,
            source: source || null,
            connectedProductKey: product || null,
            contactType: contact,
            ...(file ? { fileName: file.name, fileText: file.text } : {}),
            membershipDays: days,
            consentAck: consent,
          },
          { stay: source !== 'LATER', onDone: (r) => setResult(r) },
        )
      }
    >
      <DvSectionCard title="Audience details" layout="settings">
        <DvTextField id="audience-name" label="Name" required maxLength={255} value={name} onChange={setName} error={s.err('name')} />
        {source !== 'LATER' ? (
          <DvTextField id="audience-description" label="Description" value={description} onChange={setDescription} />
        ) : null}
      </DvSectionCard>
      {source === 'CONNECT' ? (
        <DvSectionCard title="Connected product" layout="settings">
          <DvSelect
            id="audience-product"
            label="Product"
            value={product}
            onChange={setProduct}
            placeholder="Select a product"
            options={CONNECTED_PRODUCTS.map((p) => ({ value: p.key, label: p.label }))}
            error={s.err('dataSource')}
          />
        </DvSectionCard>
      ) : null}
      {source === 'UPLOAD' ? (
        <DvSectionCard title="Upload" layout="settings">
          <DvSelect
            id="audience-contact"
            label="Contact type"
            value={contact}
            onChange={(v) => setContact(v as ContactTypeKey)}
            options={Object.entries(CONTACT_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <AppLink href={`/api/dv/audiences/customer-match/template?type=${contact}`}>Download template</AppLink>
          <Box>
            <Button variant="outlined" component="label">
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                data-testid="cm-file"
                hidden
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </Button>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {file ? file.name : 'No file chosen. Identifiers are hashed in your browser before upload.'}
            </Typography>
            {s.err('file') ? (
              <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
                {s.err('file')}
              </Typography>
            ) : null}
          </Box>
          <FormControlLabel
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
            label="I confirm I have permission to use this data"
          />
          {s.err('consentAck') ? (
            <Typography variant="caption" role="alert" sx={{ color: 'statusText.error' }}>
              {s.err('consentAck')}
            </Typography>
          ) : null}
        </DvSectionCard>
      ) : null}
      {source !== 'LATER' ? (
        <DvSectionCard title="Membership duration" layout="settings">
          <DvTextField
            id="audience-days"
            label="Membership duration (days)"
            type="number"
            value={days}
            onChange={setDays}
            error={s.err('membershipDays')}
            hint="1 to 540 days"
          />
        </DvSectionCard>
      ) : (
        <DvBanner kind="info">
          The list is created empty and inactive. Add a file from its details page when you are ready.
        </DvBanner>
      )}
    </AudienceFormShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="body2">{label}</Typography>
      <Typography variant="h5" component="p">
        {value}
      </Typography>
    </Box>
  );
}
