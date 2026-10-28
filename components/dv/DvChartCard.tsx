'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip as ChartTooltip, XAxis } from 'recharts';
import { DvIcon } from '@/components/icons';
import { colors, sizes } from '@/lib/theme/tokens';
import { DvEmptyState } from './DvEmptyState';
import { DvHelp } from './DvTooltip';

export interface DvChartCardProps {
  title: string;
  /** Period text next to the title: "(flight start - Today)". */
  period?: string;
  help?: string;
  menu?: { label: string; onClick: () => void }[];
  /** Built-in card: lock icon at the bottom right. */
  locked?: boolean;
  footer?: ReactNode;
  selected?: boolean;
  /** Replaces the content when there is nothing to chart. */
  empty?: ReactNode;
  children?: ReactNode;
}

/** 296 x 216 card frame (design-system 2.16). */
export function DvChartCard({
  title,
  period,
  help,
  menu,
  locked,
  footer,
  selected,
  empty,
  children,
}: DvChartCardProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Box
      component="section"
      aria-label={title}
      data-selected={selected || undefined}
      sx={{
        width: sizes.chartCard.width,
        minHeight: sizes.chartCard.height,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        p: 4,
        bgcolor: 'background.paper',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        m: selected ? 0 : '1px',
        borderRadius: '8px',
        '&:hover': { boxShadow: 1 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Typography variant="subtitle1" component="h3" sx={{ flex: 1 }}>
          {title}
          {period ? (
            <Typography variant="caption" component="span" sx={{ ml: 1 }}>
              {period}
            </Typography>
          ) : null}
        </Typography>
        {help ? <DvHelp label={`Help: ${title}`}>{help}</DvHelp> : null}
        {menu?.length ? (
          <>
            <IconButton
              size="small"
              aria-label={`${title} menu`}
              aria-haspopup="menu"
              onClick={(e) => setAnchor(e.currentTarget)}
            >
              <DvIcon name="more_vert" size={20} />
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              {menu.map((m) => (
                <MenuItem
                  key={m.label}
                  onClick={() => {
                    setAnchor(null);
                    m.onClick();
                  }}
                >
                  {m.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : null}
      </Box>
      <Box
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 2 }}
      >
        {empty ?? children}
      </Box>
      {footer || locked ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption">{footer}</Typography>
          {locked ? (
            <DvIcon name="lock" size={14} color="text.secondary" label="Built-in chart" />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

export interface DvChartStripProps {
  children: ReactNode;
  suggestions?: string[];
  onCustomize?: () => void;
  onSuggestion?: (text: string) => void;
  onTour?: () => void;
  onShare?: () => void;
}

/** Horizontal scroller with edge chevrons and the chart toolbar above it (design-system 2.16). */
export function DvChartStrip({
  children,
  suggestions = [],
  onCustomize,
  onSuggestion,
  onTour,
  onShare,
}: DvChartStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * (sizes.chartCard.width + 16), behavior: 'smooth' });
  const edge = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 40,
    height: 40,
    bgcolor: 'background.paper',
    boxShadow: 1,
    zIndex: 1,
    '&:hover': { bgcolor: 'surface.sunken' },
  } as const;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="small" onClick={onCustomize}>
          Customize charts
        </Button>
        {suggestions.map((s) => (
          <Chip
            key={s}
            variant="outlined"
            icon={<DvIcon name="auto_awesome" size={16} />}
            label={s}
            onClick={() => onSuggestion?.(s)}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onTour} startIcon={<DvIcon name="tour" size={18} />}>
          Tour custom charts
        </Button>
        <Button size="small" onClick={onShare} startIcon={<DvIcon name="share" size={18} />}>
          Share
        </Button>
      </Box>
      <Box sx={{ position: 'relative' }}>
        {canLeft ? (
          <IconButton
            aria-label="Scroll charts left"
            onClick={() => scroll(-1)}
            sx={{ ...edge, left: 0 }}
          >
            <DvIcon name="chevron_left" size={24} />
          </IconButton>
        ) : null}
        <Box
          ref={ref}
          onScroll={measure}
          tabIndex={0}
          role="region"
          aria-label="Charts"
          sx={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            scrollSnapType: 'x proximity',
            '& > *': { scrollSnapAlign: 'start' },
          }}
        >
          {children}
        </Box>
        {canRight ? (
          <IconButton
            aria-label="Scroll charts right"
            onClick={() => scroll(1)}
            sx={{ ...edge, right: 0 }}
          >
            <DvIcon name="chevron_right" size={24} />
          </IconButton>
        ) : null}
      </Box>
    </Box>
  );
}

/** Recharts builds counter-based ids, so server and client markup differ. Render charts after mount. */
function AfterMount({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <Box aria-hidden="true" sx={{ width, height }} />;
}

/** Sparkline bars: 8 px bars, 3 px gap, today's bar dark blue, day labels, tooltip on hover. */
export function DvSparkBars({
  data,
  todayIndex,
  label,
}: {
  data: { label: string; value: number }[];
  todayIndex?: number;
  label: string;
}) {
  if (data.length === 0)
    return <DvEmptyState variant="inline" message="No performance chart data available" />;
  const width = Math.max(100, data.length * 11 + 8);
  return (
    <Box role="img" aria-label={label} sx={{ overflow: 'hidden' }}>
      <Box aria-hidden="true">
        <AfterMount width={width} height={56}>
          <BarChart
            width={width}
            height={56}
            data={data}
            barSize={8}
            barGap={3}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              height={14}
            />
            <ChartTooltip cursor={false} formatter={(v) => [String(v), label]} />
            <Bar dataKey="value" fill={colors.chart[0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell
                  key={d.label + i}
                  fill={i === todayIndex ? colors.primary.dark : colors.chart[0]}
                />
              ))}
            </Bar>
          </BarChart>
        </AfterMount>
      </Box>
    </Box>
  );
}

/** Big value with a progress track toward a goal and a marker line. Turns amber when more than 20% off. */
export function DvGoalProgress({
  value,
  valueText,
  goal,
  goalText,
  higherIsBetter = false,
}: {
  value: number;
  valueText: string;
  goal: number;
  goalText: string;
  higherIsBetter?: boolean;
}) {
  const max = Math.max(value, goal) * 1.25 || 1;
  const off = higherIsBetter ? (goal - value) / goal : (value - goal) / goal;
  const warn = off > 0.2;
  return (
    <Box>
      <Typography variant="kpiValue">{valueText}</Typography>
      <Typography variant="caption">vs {goalText}</Typography>
      <Box
        role="img"
        aria-label={`${valueText} against goal ${goalText}`}
        sx={{
          position: 'relative',
          height: 8,
          mt: 2,
          bgcolor: 'surface.skeleton',
          borderRadius: '4px',
        }}
      >
        <Box
          sx={{
            width: `${Math.min(100, (value / max) * 100)}%`,
            height: '100%',
            borderRadius: '4px',
            bgcolor: warn ? 'status.warning' : 'primary.main',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${(goal / max) * 100}%`,
            width: 2,
            bgcolor: 'text.primary',
          }}
        />
      </Box>
    </Box>
  );
}

export function DvDonut({
  slices,
  size = 'small',
  label,
}: {
  slices: { name: string; value: number; color?: string }[];
  size?: 'small' | 'large';
  label: string;
}) {
  const [outer, inner] = size === 'small' ? [28, 20] : [45, 32];
  const sum = slices.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Box role="img" aria-label={label}>
        <Box aria-hidden="true">
          <AfterMount width={outer * 2} height={outer * 2}>
            <PieChart width={outer * 2} height={outer * 2}>
              <Pie
                data={slices}
                dataKey="value"
                innerRadius={inner}
                outerRadius={outer}
                isAnimationActive={false}
                stroke="none"
              >
                {slices.map((s, i) => (
                  <Cell key={s.name} fill={s.color ?? colors.chart[i % colors.chart.length]} />
                ))}
              </Pie>
            </PieChart>
          </AfterMount>
        </Box>
      </Box>
      <Box
        component="ul"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {slices.map((s, i) => (
          <Box
            component="li"
            key={s.name}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              typography: 'caption',
              color: 'text.primary',
            }}
          >
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                width: 10,
                height: 10,
                bgcolor: s.color ?? colors.chart[i % colors.chart.length],
              }}
            />
            {s.name} {Math.round((s.value / sum) * 100)}%
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Horizontal coverage bar: "92% (46/50 Line items)". */
export function DvCoverageBar({
  done,
  total,
  noun,
}: {
  done: number;
  total: number;
  noun: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <Box
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${noun} coverage`}
        sx={{ flex: 1, height: 8, bgcolor: 'surface.skeleton', borderRadius: '4px' }}
      >
        <Box
          sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main', borderRadius: '4px' }}
        />
      </Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.primary' }}
      >{`${pct}% (${done}/${total} ${noun})`}</Typography>
    </Box>
  );
}
