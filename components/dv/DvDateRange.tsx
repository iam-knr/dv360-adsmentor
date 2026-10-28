'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import OutlinedInput from '@mui/material/OutlinedInput';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { DvIcon } from '@/components/icons';
import {
  PRESET_ROW_LABELS,
  PRESET_SETS,
  formatIsoDate,
  parseIsoDate,
  resolvePreset,
  triggerLabel,
  type DatePresetId,
  type DatePresetSet,
  type DateRangeValue,
} from './date-presets';

export type { DateRangeValue, DatePresetId, DatePresetSet } from './date-presets';

export interface DvDateRangeProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  /** A named set (`grid`, `history`) or an explicit list of preset ids. */
  presets: DatePresetSet | DatePresetId[];
  /** Simulator clock. Drives every relative preset and the greyed future days. */
  today: Date;
  /** Latest selectable day. Default: `today`. */
  maxDate?: Date;
  /** Grids use a single day (start = end). */
  singleDay?: boolean;
  /** Start of "Lifetime". */
  lifetimeStart?: Date;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthDays(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const lead = startOfMonth(month).getDay();
  const total = Math.ceil((lead + endOfMonth(month).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => addDays(first, i));
}

interface CalendarProps {
  month: Date;
  start: Date | null;
  end: Date | null;
  maxDate: Date;
  focused: Date;
  onFocusDate: (d: Date) => void;
  /** Keyboard move: the parent focuses the new day (it may be in the other calendar). */
  onMove: (d: Date) => void;
  onPick: (d: Date) => void;
}

function Calendar({
  month,
  start,
  end,
  maxDate,
  focused,
  onFocusDate,
  onMove,
  onPick,
}: CalendarProps) {
  const days = monthDays(month);
  const inRange = (d: Date) => start && end && !isBefore(d, start) && !isAfter(d, end);
  const move = (e: KeyboardEvent, d: Date) => {
    const step: Record<string, Date | undefined> = {
      ArrowLeft: addDays(d, -1),
      ArrowRight: addDays(d, 1),
      ArrowUp: addDays(d, -7),
      ArrowDown: addDays(d, 7),
      PageUp: subMonths(d, 1),
      PageDown: addMonths(d, 1),
    };
    const next = step[e.key];
    if (next) {
      e.preventDefault();
      onMove(isAfter(next, maxDate) ? maxDate : next);
    }
  };
  return (
    <Box
      role="grid"
      aria-label={format(month, 'MMMM yyyy')}
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', gap: '2px 0' }}
    >
      {WEEKDAYS.map((w, i) => (
        <Typography
          key={i}
          variant="caption"
          align="center"
          role="columnheader"
          sx={{ lineHeight: '32px' }}
        >
          {w}
        </Typography>
      ))}
      {days.map((d) => {
        const outside = d.getMonth() !== month.getMonth();
        if (outside) return <Box key={d.toISOString()} role="gridcell" aria-hidden="true" />;
        const future = isAfter(d, maxDate);
        const selected = (start && isSameDay(d, start)) || (end && isSameDay(d, end));
        const isFocus = isSameDay(d, focused);
        return (
          <Box
            key={d.toISOString()}
            role="gridcell"
            sx={{ bgcolor: inRange(d) && !selected ? 'primary.light' : undefined }}
          >
            <Box
              component="button"
              type="button"
              disabled={future}
              aria-label={format(d, 'MMM d, yyyy')}
              aria-pressed={Boolean(selected)}
              tabIndex={isFocus ? 0 : -1}
              data-date={formatIsoDate(d)}
              onClick={() => onPick(d)}
              onFocus={() => onFocusDate(d)}
              onKeyDown={(e: KeyboardEvent) => move(e, d)}
              sx={{
                width: 32,
                height: 32,
                border: 0,
                borderRadius: '50%',
                cursor: future ? 'default' : 'pointer',
                typography: 'caption',
                color: selected ? 'common.white' : future ? 'text.disabled' : 'text.primary',
                bgcolor: selected ? 'primary.main' : 'transparent',
                '&:hover:not(:disabled)': { bgcolor: selected ? 'primary.main' : 'surface.sunken' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.dark',
                  outlineOffset: 1,
                },
              }}
            >
              {d.getDate()}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** Trigger button and popover with preset list, start/end inputs and two month calendars (design-system 2.7). */
export function DvDateRange({
  value,
  onChange,
  presets,
  today: todayProp,
  maxDate: maxProp,
  singleDay,
  lifetimeStart,
}: DvDateRangeProps) {
  const today = startOfDay(todayProp);
  const maxDate = startOfDay(maxProp ?? today);
  const ids = typeof presets === 'string' ? [...PRESET_SETS[presets]] : presets;
  const popId = useId();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [preset, setPreset] = useState<string>(value.preset ?? 'custom');
  const [days, setDays] = useState<number>(value.days ?? 30);
  const [daysText, setDaysText] = useState<string>(String(value.days ?? 30));
  const calRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [start, setStart] = useState<Date | null>(value.start);
  const [end, setEnd] = useState<Date | null>(value.end);
  const [month, setMonth] = useState<Date>(startOfMonth(value.start));
  const [focused, setFocused] = useState<Date>(value.start);
  const [startText, setStartText] = useState(formatIsoDate(value.start));
  const [endText, setEndText] = useState(formatIsoDate(value.end));
  const [monthMenu, setMonthMenu] = useState<HTMLElement | null>(null);

  const syncTexts = (s: Date | null, e: Date | null) => {
    setStartText(s ? formatIsoDate(s) : '');
    setEndText(e ? formatIsoDate(e) : '');
  };

  const open = (el: HTMLElement) => {
    setPreset(value.preset ?? 'custom');
    setDays(value.days ?? 30);
    setDaysText(String(value.days ?? 30));
    setStart(value.start);
    setEnd(value.end);
    setMonth(startOfMonth(value.start));
    setFocused(value.start);
    syncTexts(value.start, value.end);
    setAnchor(el);
  };

  const applyPreset = (id: DatePresetId, n = days) => {
    setPreset(id);
    if (id === 'custom') return;
    const r = resolvePreset(id, today, n, lifetimeStart);
    setStart(r.start);
    setEnd(r.end);
    setMonth(startOfMonth(r.start));
    setFocused(r.start);
    syncTexts(r.start, r.end);
  };

  const pick = (d: Date) => {
    setPreset('custom');
    if (singleDay) {
      setStart(d);
      setEnd(d);
      syncTexts(d, d);
      return;
    }
    if (!start || end) {
      // First click of a new range.
      setStart(d);
      setEnd(null);
      syncTexts(d, null);
      return;
    }
    const [s, e] = isBefore(d, start) ? [d, start] : [start, d];
    setStart(s);
    setEnd(e);
    syncTexts(s, e);
  };

  const commitText = (which: 'start' | 'end', text: string) => {
    const d = parseIsoDate(text);
    if (!d || isAfter(d, maxDate)) {
      syncTexts(start, end);
      return;
    }
    setPreset('custom');
    if (which === 'start') {
      const e = end && !isBefore(end, d) ? end : d;
      setStart(d);
      setEnd(e);
      syncTexts(d, e);
    } else {
      const s = start && !isAfter(start, d) ? start : d;
      setStart(s);
      setEnd(d);
      syncTexts(s, d);
    }
    setMonth(startOfMonth(d));
    setFocused(d);
  };

  const apply = () => {
    if (!start) return;
    const e = end ?? start;
    const hasDays = preset === 'daysToToday' || preset === 'daysToYesterday';
    onChange({ start, end: e, preset, ...(hasDays ? { days } : {}) });
    setAnchor(null);
  };

  const nextMonth = addMonths(month, 1);

  // After a keyboard move, put DOM focus on the new day once it is rendered.
  useEffect(() => {
    const iso = pendingFocus.current;
    if (!iso) return;
    pendingFocus.current = null;
    calRef.current?.querySelector<HTMLElement>(`[data-date="${iso}"]`)?.focus();
  }, [focused, month]);
  const monthOptions = useMemo(
    () => Array.from({ length: 25 }, (_, i) => addMonths(startOfMonth(maxDate), i - 24)),
    [maxDate],
  );

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={(e) => open(e.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? popId : undefined}
        startIcon={<DvIcon name="calendar_today" size={18} />}
        endIcon={<DvIcon name="arrow_drop_down" size={20} />}
        sx={{ color: 'text.primary' }}
      >
        {triggerLabel(value)}
      </Button>
      <Popover
        id={popId}
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Select date range',
            sx: { width: 720, maxWidth: '95vw' },
          },
        }}
      >
        <Box sx={{ display: 'flex', minHeight: 420 }}>
          <MenuList
            aria-label="Date presets"
            sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', py: 2 }}
          >
            {ids.map((id) => {
              const selected = preset === id;
              const hasNumber = id === 'daysToToday' || id === 'daysToYesterday';
              const [before, after] = PRESET_ROW_LABELS[id].split('[n]');
              return (
                <MenuItem
                  key={id}
                  selected={selected}
                  onClick={() => applyPreset(id)}
                  sx={{
                    mx: 2,
                    borderRadius: '20px',
                    minHeight: 36,
                    gap: 1,
                    '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' },
                  }}
                >
                  {hasNumber ? (
                    <>
                      <OutlinedInput
                        value={daysText}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onBlur={() => setDaysText(String(days))}
                        onChange={(e) => {
                          const text = e.target.value.replace(/\D/g, '').slice(0, 4);
                          setDaysText(text);
                          const n = Number(text);
                          if (n >= 1) {
                            setDays(n);
                            applyPreset(id, n);
                          }
                        }}
                        inputProps={{
                          inputMode: 'numeric',
                          'aria-label': 'Number of days',
                          style: { textAlign: 'center' },
                        }}
                        sx={{ width: 48, height: 28 }}
                      />
                      {after}
                    </>
                  ) : (
                    before
                  )}
                </MenuItem>
              );
            })}
          </MenuList>
          <Box sx={{ flex: 1, p: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {(['start', 'end'] as const).map((which) => (
                <Box key={which} sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                  <Typography variant="caption" component="label" htmlFor={`${popId}-${which}`}>
                    {which === 'start' ? 'Start date' : 'End date'}
                  </Typography>
                  <OutlinedInput
                    id={`${popId}-${which}`}
                    value={which === 'start' ? startText : endText}
                    placeholder="yyyy-mm-dd"
                    onChange={(e) =>
                      which === 'start' ? setStartText(e.target.value) : setEndText(e.target.value)
                    }
                    onBlur={(e) => commitText(which, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        commitText(which, (e.target as HTMLInputElement).value);
                    }}
                    sx={{ height: 32 }}
                    disabled={singleDay && which === 'end'}
                  />
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                aria-label="Previous month"
                onClick={() => setMonth(subMonths(month, 1))}
              >
                <DvIcon name="chevron_left" size={20} />
              </IconButton>
              <Button
                size="small"
                onClick={(e) => setMonthMenu(e.currentTarget)}
                aria-haspopup="menu"
                endIcon={<DvIcon name="arrow_drop_down" size={20} />}
                sx={{ color: 'text.primary', textTransform: 'uppercase' }}
              >
                {format(month, 'MMM yyyy')}
              </Button>
              <IconButton
                size="small"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <DvIcon name="chevron_right" size={20} />
              </IconButton>
              <Menu
                anchorEl={monthMenu}
                open={Boolean(monthMenu)}
                onClose={() => setMonthMenu(null)}
                slotProps={{ paper: { sx: { maxHeight: 280 } } }}
              >
                {monthOptions.map((m) => (
                  <MenuItem
                    key={m.toISOString()}
                    selected={m.getTime() === month.getTime()}
                    onClick={() => {
                      setMonth(m);
                      setMonthMenu(null);
                    }}
                  >
                    {format(m, 'MMM yyyy')}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            <Box ref={calRef} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[month, nextMonth].map((m) => (
                <Calendar
                  key={m.toISOString()}
                  month={m}
                  start={start}
                  end={end}
                  maxDate={maxDate}
                  focused={focused}
                  onFocusDate={setFocused}
                  onMove={(d) => {
                    setFocused(d);
                    pendingFocus.current = formatIsoDate(d);
                    const inView = isSameMonth(d, month) || isSameMonth(d, nextMonth);
                    if (!inView) setMonth(startOfMonth(d));
                  }}
                  onPick={pick}
                />
              ))}
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            px: 4,
            py: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button onClick={() => setAnchor(null)}>Cancel</Button>
          <Button onClick={apply} disabled={!start}>
            Apply
          </Button>
        </Box>
      </Popover>
    </>
  );
}
