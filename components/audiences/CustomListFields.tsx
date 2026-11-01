'use client';

// Fields of the custom affinity / custom intent create form (module 14 S11, S12; fidelity audit LIT-003 to LIT-005,
// CIL-002 to CIL-008). One component for the stacked side panel of the line item targeting and for the standalone
// pages: label with a help icon on the left, the real helper text on the right.
import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import { DvHelp } from '@/components/dv/DvTooltip';
import { DvSelect } from '@/components/dv/DvSelect';
import { MSG } from '@/lib/validation/messages';
import type { AudienceInput, AudienceLookups, AudienceTypeKey } from '@/lib/audiences/wire';
import { ChipInput } from './shared';

export type CustomSurface = 'affinity' | 'display' | 'youtube';

export const CUSTOM_KIND: Record<CustomSurface, AudienceTypeKey> = {
  affinity: 'CUSTOM_AFFINITY',
  display: 'CUSTOM_INTENT_DISPLAY_VIDEO',
  youtube: 'CUSTOM_INTENT_YOUTUBE',
};

/** Titles of the stacked panel (LIT-002, CIL-002) and of the standalone page. */
export const CUSTOM_PANEL_TITLE: Record<CustomSurface, string> = {
  affinity: 'New Custom Affinity Audience',
  display: 'New Custom Intent (Display, Video) Audience',
  youtube: 'New Custom Intent (YouTube) Audience',
};

export const HELP = {
  interests: "Add topics your audience is interested in. Press 'Enter' after each, or separate with commas.",
  keywords:
    "Add keywords related to products and services your audience is actively researching. Press 'Enter' after each, or separate with commas.",
  urlsAffinity:
    "Add URLs your audience is interested in. Press 'Enter' after each, or separate with commas.",
  urlsIntent:
    "Add URLs your audience is actively researching. Press 'Enter' after each, or separate with commas.",
  apps: 'Search for apps your audience is interested in.',
  name: 'Give the audience a name you can recognise in the list picker.',
  description: 'Optionally describe what this audience is for.',
} as const;

const looksLikeUrl = (v: string): string | null =>
  /^(https?:\/\/)?[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(v) ? null : 'Enter a valid URL.';

export interface CustomListState {
  surface: CustomSurface;
  name: string;
  description: string;
  interests: string[];
  urls: string[];
  keywords: string[];
  apps: string[];
}

export function useCustomListState(surface: CustomSurface) {
  const [s, setS] = useState<CustomListState>({
    surface,
    name: '',
    description: '',
    interests: [],
    urls: [],
    keywords: [],
    apps: [],
  });
  const patch = (p: Partial<CustomListState>) => setS((cur) => ({ ...cur, ...p }));
  const dirty = s.name !== '' || s.description !== '' || s.interests.length + s.urls.length + s.keywords.length + s.apps.length > 0;
  const input: AudienceInput = {
    kind: CUSTOM_KIND[surface],
    name: s.name,
    description: s.description,
    interests: surface === 'affinity' ? s.interests : [],
    urls: s.urls,
    keywords: surface === 'affinity' ? [] : s.keywords,
    apps: surface === 'affinity' ? s.apps : [],
  } as AudienceInput;
  return { state: s, patch, dirty, input };
}

/**
 * Errors the form shows. The audit (LIT-005, CIL-007) wants only "Enter a value" under Audience name when the name
 * is empty; the entry rules (AUD-050, AUD-080) only show once the name is valid.
 */
export function visibleErrors(
  err: (path: string) => string | undefined,
  nameBlank: boolean,
): { name?: string; interests?: string; keywords?: string; urls?: string } {
  if (nameBlank) return { name: MSG.ENTER_VALUE };
  const name = err('name');
  const out: { name?: string; interests?: string; keywords?: string; urls?: string } = {};
  if (name) out.name = name;
  const interests = err('interests');
  if (interests) out.interests = interests;
  const keywords = err('keywords');
  if (keywords) out.keywords = keywords;
  const urls = err('urls');
  if (urls) out.urls = urls;
  return out;
}

function Row({
  id,
  label,
  optional,
  help,
  helper,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  help: string;
  helper?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
        columnGap: 4,
        rowGap: 1,
        alignItems: 'start',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="label" htmlFor={id} variant="subtitle1">
            {label}
          </Typography>
          {optional ? (
            <Typography variant="caption" color="text.secondary">
              Optional
            </Typography>
          ) : null}
          <DvHelp label={`Help: ${label}`}>{help}</DvHelp>
        </Box>
        {children}
        {error ? (
          <Typography id={`${id}-row-error`} variant="caption" sx={{ color: 'statusText.error' }}>
            {error}
          </Typography>
        ) : null}
      </Box>
      {helper ? (
        <Typography variant="body2" color="text.secondary" sx={{ pt: { md: 4 } }}>
          {helper}
        </Typography>
      ) : null}
    </Box>
  );
}

export function CustomListFields({
  form,
  lookups,
  errors,
}: {
  form: ReturnType<typeof useCustomListState>;
  lookups: Pick<AudienceLookups, 'apps'>;
  errors: ReturnType<typeof visibleErrors>;
}) {
  const { state: s, patch } = form;
  const affinity = s.surface === 'affinity';
  const urlsHelp = affinity ? HELP.urlsAffinity : HELP.urlsIntent;
  const appLabel = (id: string) => lookups.apps.find((a) => a.id === id)?.label ?? id;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Row id="audience-name" label="Audience name" help={HELP.name} error={errors.name}>
        <OutlinedInput
          id="audience-name"
          size="small"
          fullWidth
          value={s.name}
          error={Boolean(errors.name)}
          onChange={(e) => patch({ name: e.target.value })}
          inputProps={{ 'aria-label': 'Audience name', 'aria-invalid': Boolean(errors.name) }}
        />
      </Row>
      <Row id="audience-description" label="Description" optional help={HELP.description}>
        <OutlinedInput
          id="audience-description"
          size="small"
          fullWidth
          value={s.description}
          onChange={(e) => patch({ description: e.target.value })}
          inputProps={{ 'aria-label': 'Description' }}
        />
      </Row>
      {affinity ? (
        <Row
          id="audience-interests"
          label="Interests"
          help={HELP.interests}
          helper={HELP.interests}
          error={errors.interests}
        >
          <ChipInput
            id="audience-interests"
            label="Interests"
            hideLabel
            values={s.interests}
            onChange={(interests) => patch({ interests })}
            placeholder="Enter interests"
          />
        </Row>
      ) : (
        <Row
          id="audience-keywords"
          label="Keywords"
          help={HELP.keywords}
          helper={HELP.keywords}
          error={errors.keywords}
        >
          <ChipInput
            id="audience-keywords"
            label="Keywords"
            hideLabel
            values={s.keywords}
            onChange={(keywords) => patch({ keywords })}
            placeholder="Enter keywords"
          />
        </Row>
      )}
      <Row id="audience-urls" label="URLs" help={urlsHelp} helper={urlsHelp} error={errors.urls}>
        <ChipInput
          id="audience-urls"
          label="URLs"
          hideLabel
          values={s.urls}
          onChange={(urls) => patch({ urls })}
          validate={looksLikeUrl}
          placeholder="Enter URLs"
        />
      </Row>
      {affinity ? (
        <Row id="audience-apps" label="Apps" help={HELP.apps} helper={HELP.apps}>
          <DvSelect
            id="audience-apps"
            ariaLabel="Apps"
            searchable
            value=""
            placeholder="Search for apps"
            onChange={(v) => v && patch({ apps: s.apps.includes(v) ? s.apps : [...s.apps, v] })}
            options={lookups.apps
              .filter((a) => !s.apps.includes(a.id))
              .map((a) => ({ value: a.id, label: a.label }))}
          />
          {s.apps.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {s.apps.map((id) => (
                <Box
                  key={id}
                  component="button"
                  type="button"
                  onClick={() => patch({ apps: s.apps.filter((a) => a !== id) })}
                  aria-label={`Remove ${appLabel(id)}`}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 4,
                    px: 2,
                    py: 0.5,
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {appLabel(id)} ×
                </Box>
              ))}
            </Box>
          ) : null}
        </Row>
      ) : null}
    </Box>
  );
}
