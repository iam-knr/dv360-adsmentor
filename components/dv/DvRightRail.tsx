'use client';

import { useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { DvIconName } from '@/components/icons';
import { DvIcon } from '@/components/icons';
import { sizes } from '@/lib/theme/tokens';
import { DvSkeleton } from './DvLoading';
import { DvStatusChip } from './DvStatus';
import { DvTooltip } from './DvTooltip';

export type RailPanelId = 'advisor' | 'help' | 'intelligence' | 'exercise';

export interface DvRightRailProps {
  available: RailPanelId[];
  open?: RailPanelId | null;
  onChange: (p: RailPanelId | null) => void;
}

const RAIL: Record<RailPanelId, { icon: DvIconName; label: string }> = {
  advisor: { icon: 'auto_awesome', label: 'Ask Advisor' },
  help: { icon: 'help', label: 'Quick help' },
  intelligence: { icon: 'hub', label: 'Intelligence' },
  exercise: { icon: 'assignment', label: 'Exercise' },
};

const ORDER: RailPanelId[] = ['advisor', 'help', 'intelligence', 'exercise'];

/** 48 px icon strip. Opening a panel replaces the current one, the same icon closes it (design-system 2.3). */
export function DvRightRail({ available, open = null, onChange }: DvRightRailProps) {
  const lastOpen = useRef<RailPanelId | null>(null);
  if (open) lastOpen.current = open;
  const ids = ORDER.filter((id) => available.includes(id));
  const reopen =
    lastOpen.current && ids.includes(lastOpen.current) ? lastOpen.current : (ids[0] ?? null);
  return (
    <Box
      component="aside"
      aria-label="Side panels"
      sx={{
        width: sizes.railWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        py: 2,
        bgcolor: 'background.paper',
        borderLeft: '1px solid',
        borderColor: 'divider',
        zIndex: (t) => t.zIndex.nav,
      }}
    >
      {ids.map((id) => {
        const meta = RAIL[id];
        const selected = open === id;
        return (
          <DvTooltip key={id} title={meta.label} placement="left">
            <IconButton
              aria-label={meta.label}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : id)}
              sx={{
                width: 36,
                height: 36,
                bgcolor: selected ? 'primary.light' : 'transparent',
                color: selected ? 'primary.main' : 'text.secondary',
              }}
            >
              <DvIcon name={meta.icon} size={24} filled={selected} />
            </IconButton>
          </DvTooltip>
        );
      })}
      <Box sx={{ flex: 1 }} />
      <DvTooltip title={open ? 'Close panel' : 'Open panel'} placement="left">
        <span>
          <IconButton
            aria-label={open ? 'Close panel' : 'Open panel'}
            disabled={!open && !reopen}
            onClick={() => onChange(open ? null : reopen)}
          >
            <DvIcon name={open ? 'right_panel_close' : 'right_panel_open'} size={24} />
          </IconButton>
        </span>
      </DvTooltip>
    </Box>
  );
}

export interface DvPanelProps {
  title: string;
  /** Scope name after the title: "Intelligence" + "Acme Retail". */
  subtitle?: string;
  beta?: boolean;
  /** Width 360, or 400 for Ask Advisor. */
  width?: number;
  /** Primary-coloured header band (Intelligence). */
  tone?: 'default' | 'primary';
  /** True when overlaying content (shadow level 3). False pushes content (border). */
  overlay?: boolean;
  actions?: { icon: DvIconName; label: string; onClick: () => void }[];
  onClose: () => void;
  state?: 'ready' | 'loading' | 'error';
  onRetry?: () => void;
  children?: ReactNode;
}

/** Right panel frame: 56 px header, scrolling body, loading and error states (design-system 2.3). */
export function DvPanel({
  title,
  subtitle,
  beta,
  width = sizes.panelWidth,
  tone = 'default',
  overlay,
  actions = [],
  onClose,
  state = 'ready',
  onRetry,
  children,
}: DvPanelProps) {
  const primary = tone === 'primary';
  return (
    <Box
      component="aside"
      aria-label={title}
      data-overlay={overlay || undefined}
      sx={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderLeft: overlay ? undefined : '1px solid',
        borderColor: 'divider',
        boxShadow: overlay ? 3 : 0,
        zIndex: (t) => (overlay ? t.zIndex.rightPanel : t.zIndex.nav),
      }}
    >
      <Box
        sx={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 4,
          bgcolor: primary ? 'primary.main' : 'transparent',
          color: primary ? 'common.white' : 'text.primary',
          borderBottom: primary ? undefined : '1px solid',
          borderColor: 'divider',
          '& .MuiIconButton-root': primary ? { color: 'common.white' } : undefined,
          '& :focus-visible': primary ? { outlineColor: 'common.white' } : undefined,
        }}
      >
        <Typography variant="cardTitle" component="h2" sx={{ flex: 1, color: 'inherit' }}>
          {title}
          {subtitle ? (
            <Typography
              component="span"
              variant="body2"
              sx={{ ml: 2, color: 'inherit', opacity: 0.85 }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Typography>
        {beta ? <DvStatusChip kind="beta" /> : null}
        {actions.map((a) => (
          <DvTooltip key={a.label} title={a.label}>
            <IconButton size="small" aria-label={a.label} onClick={a.onClick}>
              <DvIcon name={a.icon} size={20} />
            </IconButton>
          </DvTooltip>
        ))}
        <DvTooltip title="Close">
          <IconButton size="small" aria-label="Close" onClick={onClose}>
            <DvIcon name="close" size={20} />
          </IconButton>
        </DvTooltip>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }} aria-busy={state === 'loading' || undefined}>
        {state === 'loading' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <DvSkeleton rows={3} height={16} />
            <DvSkeleton rows={3} height={16} />
          </Box>
        ) : state === 'error' ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 8,
              textAlign: 'center',
            }}
          >
            <DvIcon name="cloud_off" size={32} color="text.secondary" />
            <Typography variant="body1">Couldn&apos;t load.</Typography>
            <Button onClick={onRetry}>Retry</Button>
          </Box>
        ) : (
          children
        )}
      </Box>
    </Box>
  );
}

export interface HealthRow {
  id: string;
  severity: 'error' | 'warning' | 'suggestion';
  text: string;
  onInvestigate: () => void;
  onHistory?: () => void;
  /** Suggestion rows: Apply button (three types) and the ⋮ Dismiss action. */
  onApply?: () => void;
  onDismiss?: () => void;
}

export interface DvHealthListProps {
  /** "ADVERTISER HEALTH" or "CAMPAIGN HEALTH". */
  healthTitle: string;
  alerts: HealthRow[];
  suggestions: HealthRow[];
  /** Rows shown before "+N more". Default 3. */
  visibleCount?: number;
  /** Campaign scope: link to the Alerts tab. */
  onGoToAlerts?: () => void;
}

function HealthRowView({ row }: { row: HealthRow }) {
  const icon: DvIconName = row.severity === 'suggestion' ? 'lightbulb' : row.severity;
  const color =
    row.severity === 'error'
      ? 'status.error'
      : row.severity === 'warning'
        ? 'status.warning'
        : 'text.secondary';
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, py: 2 }}>
      <DvIcon
        name={icon}
        size={20}
        filled={row.severity !== 'suggestion'}
        color={color}
        label={
          row.severity === 'error'
            ? 'Critical'
            : row.severity === 'warning'
              ? 'Warning'
              : 'Suggestion'
        }
      />
      <Typography
        variant="body1"
        sx={{
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {row.text}
      </Typography>
      <Button variant="outlined" size="small" onClick={row.onInvestigate}>
        Investigate
      </Button>
      {row.onApply ? (
        <Button variant="contained" size="small" onClick={row.onApply}>
          Apply
        </Button>
      ) : null}
      {row.onDismiss ? (
        <DvTooltip title="Dismiss">
          <IconButton size="small" aria-label="Dismiss" onClick={row.onDismiss}>
            <DvIcon name="close" size={20} />
          </IconButton>
        </DvTooltip>
      ) : null}
      {row.onHistory ? (
        <DvTooltip title="History">
          <IconButton size="small" aria-label="History" onClick={row.onHistory}>
            <DvIcon name="history" size={20} />
          </IconButton>
        </DvTooltip>
      ) : null}
    </Box>
  );
}

/** Body of the Intelligence panel: health alerts and optimization suggestions (design-system 2.3). */
export function DvHealthList({
  healthTitle,
  alerts,
  suggestions,
  visibleCount = 3,
  onGoToAlerts,
}: DvHealthListProps) {
  const section = (title: string, rows: HealthRow[], empty: string, id: string) => {
    const hidden = Math.max(0, rows.length - visibleCount);
    return (
      <Box component="section" aria-labelledby={id} sx={{ mb: 6 }}>
        <Typography id={id} variant="panelOverline" component="h3" sx={{ mb: 2 }}>
          {title}
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2">{empty}</Typography>
        ) : (
          <ExpandableRows rows={rows} visibleCount={visibleCount} hidden={hidden} />
        )}
      </Box>
    );
  };
  return (
    <Box>
      {section(healthTitle, alerts, 'No alerts', 'dv-health')}
      {section(
        'Optimization suggestions',
        suggestions,
        'There are no recommendations at this time',
        'dv-suggestions',
      )}
      {onGoToAlerts ? (
        <>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Check the Alerts tab for these alerts
          </Typography>
          <Button variant="outlined" size="small" onClick={onGoToAlerts}>
            Go to Alerts
          </Button>
        </>
      ) : null}
    </Box>
  );
}

function ExpandableRows({
  rows,
  visibleCount,
  hidden,
}: {
  rows: HealthRow[];
  visibleCount: number;
  hidden: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, visibleCount);
  return (
    <>
      {shown.map((r) => (
        <HealthRowView key={r.id} row={r} />
      ))}
      {hidden > 0 && !all ? (
        <Link
          component="button"
          type="button"
          onClick={() => setAll(true)}
          sx={{ font: 'inherit', color: 'link', cursor: 'pointer' }}
        >
          +{hidden} more
        </Link>
      ) : null}
    </>
  );
}
