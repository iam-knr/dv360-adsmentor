'use client';

// Plan and row dates with the shared DvDateRange (gap p4-08 #7). The range is held as ISO strings; only the custom
// calendar is offered because a plan looks forward, so the relative presets of the report grids do not apply.
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DvDateRange } from '@/components/dv';
import { formatIsoDate, parseIsoDate, triggerLabel } from '@/components/dv/date-presets';
import { DvIcon } from '@/components/icons';

const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function PlanDateRange({
  label,
  start,
  end,
  today,
  onChange,
  disabled,
  error,
}: {
  label: string;
  start: string;
  end: string;
  /** Sim today (YYYY-MM-DD): the calendar greys nothing before it, but it centres the month list. */
  today: string;
  onChange: (start: string, end: string) => void;
  disabled?: boolean;
  error?: string | undefined;
}) {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  const t = parseIsoDate(today) ?? new Date();
  if (!s || !e) return null;
  const value = { start: s, end: e, preset: 'custom' };
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
    >
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      {disabled ? (
        <Button
          variant="outlined"
          size="small"
          disabled
          startIcon={<DvIcon name="calendar_today" size={18} />}
        >
          {triggerLabel(value)}
        </Button>
      ) : (
        <DvDateRange
          value={value}
          presets={['custom']}
          today={t}
          maxDate={addDays(t, 800)}
          onChange={(r) => onChange(formatIsoDate(r.start), formatIsoDate(r.end))}
        />
      )}
      <Typography variant="caption" color="text.secondary" data-testid="plan-days">
        {Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1} days
      </Typography>
      {error ? (
        <Typography role="alert" variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
