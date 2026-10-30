'use client';

// Campaign Alerts page body (module 06 2.5): Critical and Needs attention groups, All / Budget / Creatives chips and
// cascading insertion order and line item filters. Filters live in the URL, so the server re-reads the alerts.
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import type { AlertGroupRow, CampaignAlerts } from '@/lib/optimisation/campaign-alerts';

export function CampaignAlertsView({
  data,
  ioId,
  liId,
  group,
}: {
  data: CampaignAlerts;
  ioId: string;
  liId: string;
  group: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (next: { ioId?: string; liId?: string; group?: string }) => {
    const q = new URLSearchParams();
    const v = { ioId, liId, group, ...next };
    if (v.ioId) q.set('ioId', v.ioId);
    if (v.liId) q.set('liId', v.liId);
    if (v.group) q.set('group', v.group);
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };
  const lis = data.lis.filter((l) => !ioId || l.ioId === ioId);
  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography
        variant="h5"
        component="h2"
      >{`Alerts for campaign ${data.campaignName}`}</Typography>
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select
          size="small"
          displayEmpty
          value={ioId}
          inputProps={{ 'aria-label': 'Insertion order', 'data-testid': 'al-io' }}
          onChange={(e) => go({ ioId: e.target.value, liId: '' })}
        >
          <MenuItem value="">All insertion orders</MenuItem>
          {data.ios.map((i) => (
            <MenuItem key={i.id} value={i.id}>
              {i.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          displayEmpty
          value={liId}
          inputProps={{ 'aria-label': 'Line item', 'data-testid': 'al-li' }}
          onChange={(e) => go({ liId: e.target.value })}
        >
          <MenuItem value="">All line items</MenuItem>
          {lis.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.label}
            </MenuItem>
          ))}
        </Select>
        <Link href={data.prefsHref}>Manage alert preferences</Link>
      </Box>
      <Box sx={{ display: 'flex', gap: 2 }} role="group" aria-label="Alert category">
        {[
          ['', 'All'],
          ['budget', 'Budget'],
          ['creatives', 'Creatives'],
        ].map(([v, label]) => (
          <Chip
            key={v}
            label={label}
            clickable
            color={group === v ? 'primary' : 'default'}
            data-testid={`al-chip-${v || 'all'}`}
            aria-pressed={group === v}
            onClick={() => go({ group: v })}
          />
        ))}
      </Box>
      {data.critical.length + data.needsAttention.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} data-testid="al-empty">
          <DvIcon name="check_circle" size={24} color="status.success" />
          <Typography variant="body1">No alerts</Typography>
        </Box>
      ) : (
        <>
          <Section title="Critical" icon="error" rows={data.critical} testId="al-critical" />
          <Section
            title="Needs attention"
            icon="warning"
            rows={data.needsAttention}
            testId="al-needs"
          />
        </>
      )}
    </Box>
  );
}

function Section({
  title,
  icon,
  rows,
  testId,
}: {
  title: string;
  icon: 'error' | 'warning';
  rows: AlertGroupRow[];
  testId: string;
}) {
  return (
    <Box component="section" aria-label={title} data-testid={testId}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <DvIcon
          name={icon}
          size={20}
          color={icon === 'error' ? 'status.error' : 'status.warning'}
          filled
        />
        <Typography variant="subtitle1" component="h3">{`${title} (${rows.length})`}</Typography>
      </Box>
      {rows.map((r) => (
        <AlertRow key={r.id} row={r} />
      ))}
    </Box>
  );
}

function AlertRow({ row }: { row: AlertGroupRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      data-testid={`al-row-${row.code}`}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        p: 3,
        mb: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body1">{row.title}</Typography>
          <Typography variant="body2">{row.detail}</Typography>
        </Box>
        {row.children.length > 0 ? (
          <Link
            component="button"
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen(!open)}
          >
            <DvIcon name={open ? 'expand_less' : 'expand_more'} size={20} />
          </Link>
        ) : null}
      </Box>
      {open ? (
        <Box component="ul" sx={{ m: 0, mt: 2, pl: 6 }}>
          {row.children.map((c) => (
            <li key={c.id}>
              <Link href={c.href}>{c.label}</Link>
            </li>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
