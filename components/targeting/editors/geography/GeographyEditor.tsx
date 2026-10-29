'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvRadioGroup } from '@/components/dv/DvChoice';
import { DvSelect } from '@/components/dv/DvSelect';
import { DvTextField } from '@/components/dv/DvTextField';
import {
  GEO_MESSAGES,
  fromKm,
  geoOption,
  geoRowLabel,
  parsePoints,
  radiusError,
  searchRegions,
  toKm,
  toRadiusPoint,
  type DistanceUnit,
  type PointError,
} from '@/lib/targeting/geo';
import type { RadiusPoint, Sel, TargetMode, TargetingCriteria } from '@/lib/targeting/types';
import type { EditorProps } from '../editors';
import { GeoMap } from './GeoMap';

type Geo = NonNullable<TargetingCriteria['geography']>;

/** Error text that blocks Apply in the open geography editor (TGT-012). */
export function geographyError(c: TargetingCriteria): string | null {
  const bad = (c.geography?.radius?.points ?? []).some((p) => radiusError(p.radiusKm) !== null);
  return bad ? GEO_MESSAGES.BAD_RADIUS : null;
}

/** TGT-013: a city whose state is excluded in the same row. */
export function insideExcluded(regions: Sel[]): Sel[] {
  const excluded = regions.filter((r) => r.mode === 'EXCLUDE').map((r) => r.id);
  return regions.filter(
    (r) => r.mode === 'INCLUDE' && excluded.some((e) => r.id.startsWith(`${e}-`)),
  );
}

const DEFAULT_RADIUS = 10;

export function GeographyEditor({ criteria, onChange, readOnly }: EditorProps) {
  const geo: Geo = criteria.geography ?? { regions: [] };
  const points = geo.radius?.points ?? [];
  const set = (patch: Partial<Geo>) => onChange({ geography: { ...geo, ...patch } });
  const setPoints = (next: RadiusPoint[]) => {
    const { radius: _drop, ...rest } = geo;
    onChange({ geography: next.length ? { ...rest, radius: { points: next } } : rest });
  };

  const [mode, setMode] = useState<'REGION' | 'RADIUS'>(points.length > 0 ? 'RADIUS' : 'REGION');
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<DistanceUnit>('KM');
  const [distance, setDistance] = useState(String(DEFAULT_RADIUS));
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<PointError[]>([]);

  const results = useMemo(() => (query.trim() ? searchRegions(query) : []), [query]);
  const modeOf = (id: string) => geo.regions.find((r) => r.id === id)?.mode;
  const toggle = (id: string, label: string, m: TargetMode) => {
    if (readOnly) return;
    const rest = geo.regions.filter((r) => r.id !== id);
    set({ regions: modeOf(id) === m ? rest : [...rest, { id, mode: m, label }] });
  };
  const included = geo.regions.filter((r) => r.mode === 'INCLUDE');
  const excluded = geo.regions.filter((r) => r.mode === 'EXCLUDE');
  const total = included.length + excluded.length + points.length;
  const dist = Number(distance);
  const distError = radiusError(dist);

  const addPoints = (text: string): PointError[] => {
    const { points: parsed, errors } = parsePoints(text);
    if (parsed.length > 0 && distError === null)
      setPoints([...points, ...parsed.map((p) => toRadiusPoint(p, dist, unit))]);
    return errors;
  };

  const clear = () => onChange({ geography: { regions: [] } });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        gap: 3,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DvRadioGroup
          label="Add targeting selections"
          value={mode}
          readOnly={readOnly}
          onChange={(v) => setMode(v as 'REGION' | 'RADIUS')}
          options={[
            {
              value: 'REGION',
              label: 'Region',
              description: 'States, cities, postal codes, airports, universities',
            },
            {
              value: 'RADIUS',
              label: 'Radius',
              description: 'Distance around a point of interest, business chains or location lists',
            },
          ]}
        />

        {mode === 'REGION' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <DvTextField
              ariaLabel="Search for locations"
              placeholder="Search for locations"
              value={query}
              onChange={setQuery}
              readOnly={readOnly}
            />
            {query.trim() ? (
              <Box
                role="group"
                aria-label="Regional Locations"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 260,
                  overflow: 'auto',
                }}
              >
                <Typography variant="overline" sx={{ px: 1.5 }}>
                  Regional Locations
                </Typography>
                {results.map((o) => (
                  <Box key={o.code} sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {geoRowLabel(o)}
                    </Typography>
                    <Checkbox
                      size="small"
                      disabled={readOnly}
                      checked={modeOf(o.code) === 'INCLUDE'}
                      onChange={() => toggle(o.code, o.label, 'INCLUDE')}
                      slotProps={{ input: { 'aria-label': `Include ${o.label}` } }}
                    />
                    <Checkbox
                      size="small"
                      color="error"
                      disabled={readOnly}
                      checked={modeOf(o.code) === 'EXCLUDE'}
                      onChange={() => toggle(o.code, o.label, 'EXCLUDE')}
                      slotProps={{ input: { 'aria-label': `Exclude ${o.label}` } }}
                    />
                  </Box>
                ))}
                {results.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                    No matches
                  </Typography>
                ) : null}
              </Box>
            ) : null}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="text" onClick={() => setQuery('')}>
                Done
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <DvTextField
                label="Distance"
                type="number"
                value={distance}
                onChange={setDistance}
                readOnly={readOnly}
                {...(distError ? { error: distError } : {})}
              />
              <DvSelect
                label="Unit"
                value={unit}
                disabled={readOnly}
                onChange={(u) => {
                  setDistance(
                    String(Math.round(fromKm(toKm(dist, unit), u as DistanceUnit) * 100) / 100),
                  );
                  setUnit(u as DistanceUnit);
                }}
                options={[
                  { value: 'KM', label: 'km' },
                  { value: 'MI', label: 'mi' },
                ]}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <DvTextField
                label="Point of interest"
                placeholder="Street address or latitude, longitude"
                value={address}
                onChange={setAddress}
                readOnly={readOnly}
                {...(addressError ? { error: addressError } : {})}
              />
              <Button
                variant="outlined"
                disabled={readOnly || !address.trim() || distError !== null}
                onClick={() => {
                  const errors = addPoints(address);
                  setAddressError(errors[0]?.message ?? null);
                  if (errors.length === 0) setAddress('');
                }}
              >
                Add point
              </Button>
            </Box>
            <DvSelect
              label="Location lists"
              value=""
              disabled
              placeholder="Location lists are managed in Resources"
              hint="Choosing a location list opens with the Resources module."
              onChange={() => undefined}
              options={[]}
            />
          </Box>
        )}

        <Box>
          <Button
            variant="outlined"
            size="small"
            disabled={readOnly}
            onClick={() => setBulkOpen((o) => !o)}
            aria-expanded={bulkOpen}
          >
            Bulk add points of interest
          </Button>
        </Box>
        {bulkOpen ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <DvTextField
              ariaLabel="Points of interest"
              multiline
              rows={4}
              value={bulkText}
              onChange={setBulkText}
              hint="Paste in line separated street addresses or latitude/longitude pairs."
            />
            {distError ? (
              <Typography role="alert" variant="body2" color="error">
                {distError}
              </Typography>
            ) : null}
            {bulkErrors.map((e) => (
              <Typography key={e.line} role="alert" variant="body2" color="error">
                Line {e.line}: {e.message}
              </Typography>
            ))}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                disabled={!bulkText.trim() || distError !== null}
                onClick={() => {
                  const errors = addPoints(bulkText);
                  setBulkErrors(errors);
                  if (parsePoints(bulkText).points.length > 0) setMode('RADIUS');
                  // Valid lines are added; the invalid ones stay in the box to be fixed.
                  setBulkText(errors.map((e) => e.text).join('\n'));
                  if (errors.length === 0) setBulkOpen(false);
                }}
              >
                Include
              </Button>
              <Button
                onClick={() => {
                  setBulkOpen(false);
                  setBulkText('');
                  setBulkErrors([]);
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : null}

        {geographyError(criteria) ? (
          <Typography role="alert" variant="body2" color="error">
            {geographyError(criteria)}
          </Typography>
        ) : null}

        <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }} data-testid="geo-summary-title">
              Included regions and targeted locations ({included.length + points.length})
            </Typography>
            {!readOnly && total > 0 ? (
              <Button size="small" onClick={clear}>
                Clear
              </Button>
            ) : null}
          </Box>
          {total === 0 ? (
            <Typography variant="body2" color="text.secondary" data-testid="geo-all-locations">
              All locations
            </Typography>
          ) : null}
          {included.length > 0 ? (
            <Box component="ul" aria-label="Region" sx={{ m: 0, pl: 0, listStyle: 'none' }}>
              <Typography variant="caption" color="text.secondary">
                Region
              </Typography>
              {included.map((r) => (
                <Line
                  key={r.id}
                  text={r.label ?? geoOption(r.id)?.label ?? r.id}
                  readOnly={readOnly}
                  onRemove={() => toggle(r.id, r.label ?? r.id, 'INCLUDE')}
                />
              ))}
            </Box>
          ) : null}
          {points.length > 0 ? (
            <Box component="ul" aria-label="Radius" sx={{ m: 0, pl: 0, listStyle: 'none' }}>
              <Typography variant="caption" color="text.secondary">
                Radius
              </Typography>
              {points.map((p, i) => {
                const name = p.label ?? `${p.lat}, ${p.lng}`;
                return (
                  <Box
                    component="li"
                    key={`${p.lat},${p.lng},${i}`}
                    sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {name}
                    </Typography>
                    <DvTextField
                      ariaLabel={`Distance in km for ${name}`}
                      type="number"
                      value={String(Math.round(p.radiusKm * 100) / 100)}
                      readOnly={readOnly}
                      suffix="km"
                      onChange={(v) =>
                        setPoints(
                          points.map((q, j) => (j === i ? { ...q, radiusKm: Number(v) } : q)),
                        )
                      }
                      {...(radiusError(p.radiusKm) ? { error: GEO_MESSAGES.BAD_RADIUS } : {})}
                    />
                    {!readOnly ? (
                      <IconButton
                        size="small"
                        aria-label={`Remove ${name}`}
                        onClick={() => setPoints(points.filter((_, j) => j !== i))}
                      >
                        ×
                      </IconButton>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          ) : null}
          {excluded.length > 0 ? (
            <Box
              component="ul"
              aria-label="Excluded regions"
              sx={{ m: 0, pl: 0, listStyle: 'none', mt: 1 }}
            >
              <Typography variant="subtitle2">Excluded regions ({excluded.length})</Typography>
              {excluded.map((r) => (
                <Line
                  key={r.id}
                  text={r.label ?? r.id}
                  readOnly={readOnly}
                  onRemove={() => toggle(r.id, r.label ?? r.id, 'EXCLUDE')}
                />
              ))}
            </Box>
          ) : null}
          {insideExcluded(geo.regions).map((r) => (
            <Typography key={r.id} role="status" variant="body2" color="warning.main">
              {`${r.label ?? r.id} is inside an excluded location, so it won't be targeted.`}
            </Typography>
          ))}
        </Box>
      </Box>
      <GeoMap regions={geo.regions} />
    </Box>
  );
}

function Line({
  text,
  onRemove,
  readOnly,
}: {
  text: string;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', py: 0.25 }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {text}
      </Typography>
      {!readOnly ? (
        <IconButton size="small" aria-label={`Remove ${text}`} onClick={onRemove}>
          ×
        </IconButton>
      ) : null}
    </Box>
  );
}
