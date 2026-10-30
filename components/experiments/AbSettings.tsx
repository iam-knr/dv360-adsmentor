'use client';

// Settings and Difference tabs (module 17 S5, S6). The body is shared by the intercepting panel over the report and by
// the full page reached by a hard navigation to the same URL.
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DvBanner, DvSelect, DvSpinner, DvTabs } from '@/components/dv';
import { abDifferencesAction } from '@/lib/experiments/actions';
import type { DiffRow } from '@/lib/experiments/diff';
import type { AbTestView } from '@/lib/experiments/types';
import { AbForm } from './AbForm';

type Diff = { controlName: string; variantName: string; variants: { id: string; name: string }[]; rows: DiffRow[] };

export function AbSettingsBody({
  partnerId,
  advertiserId,
  view,
  initialTab,
}: {
  partnerId: string;
  advertiserId: string;
  view: AbTestView;
  initialTab: 'settings' | 'diff';
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <Box data-testid="ab-settings">
      <DvTabs
        variant="card"
        value={tab}
        onChange={(t) => setTab(t as 'settings' | 'diff')}
        ariaLabel="Test settings"
        tabs={[
          { id: 'settings', label: 'Settings' },
          { id: 'diff', label: 'Difference' },
        ]}
      />
      <Box sx={{ pt: 3 }}>
        {tab === 'settings' ? (
          <>
            {view.status !== 'SCHEDULED' && view.status !== 'COMPLETED' ? (
              <Box sx={{ mb: 2 }}>
                <DvBanner kind="info" level="inline">
                  This test has started. Only the name, hypothesis and end date can change.
                </DvBanner>
              </Box>
            ) : null}
            <AbForm partnerId={partnerId} advertiserId={advertiserId} mode="edit" today={view.today} initial={view} embedded />
          </>
        ) : (
          <DiffTab advertiserId={advertiserId} view={view} />
        )}
      </Box>
    </Box>
  );
}

function DiffTab({ advertiserId, view }: { advertiserId: string; view: AbTestView }) {
  const [variant, setVariant] = useState<string | undefined>();
  const [diff, setDiff] = useState<Diff | null>(null);
  useEffect(() => {
    let live = true;
    void abDifferencesAction(advertiserId, view.publicId, variant).then((d) => live && setDiff(d));
    return () => {
      live = false;
    };
  }, [advertiserId, view.publicId, variant]);
  if (!diff) return <DvSpinner />;
  return (
    <Box data-testid="ab-diff">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Review differences. When variant arms have more than one line item, we will automatch comparisons based on the
        minimum number of differences observed.
      </Typography>
      {diff.variants.length > 1 ? (
        <Box sx={{ maxWidth: 280, mb: 2 }}>
          <DvSelect
            label="Compare with"
            value={variant ?? diff.variants[0]?.id ?? ''}
            onChange={setVariant}
            options={diff.variants.map((v) => ({ value: v.id, label: v.name }))}
          />
        </Box>
      ) : null}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { textAlign: 'left', p: 1, borderBottom: 1, borderColor: 'divider' } }}>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">{`${diff.controlName.toUpperCase()} (CONTROL)`}</th>
            <th scope="col">{`${diff.variantName.toUpperCase()} (VARIANT)`}</th>
          </tr>
        </thead>
        <tbody>
          {diff.rows.length === 0 ? (
            <tr>
              <td colSpan={3}>No results</td>
            </tr>
          ) : (
            diff.rows.map((r) => (
              <tr key={r.setting}>
                <td>{r.setting}</td>
                <td>{r.control}</td>
                <td>{r.variant}</td>
              </tr>
            ))
          )}
        </tbody>
      </Box>
    </Box>
  );
}
