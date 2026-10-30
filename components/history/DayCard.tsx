'use client';

// One day of the change log (module 05 2.1): date at the left, header "n changes to {entity type}" with the Add a note
// link, and a Time · Description · User table whose descriptions expand to one line per entry. Also exported for the
// Floodlight group History tab (module 05 2.5).
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DvIcon } from '@/components/icons';
import type { HistoryDay } from '@/lib/history/types';
import { monthDay } from '@/lib/history/zone';

export interface DayCardProps {
  day: HistoryDay;
  expanded: ReadonlySet<string>;
  onToggle: (groupId: string) => void;
  /** Omitted for read-only roles: the link is not rendered. */
  onAddNote?: (date: string) => void;
  /** Read-only roles still see the count of existing notes. */
  onOpenNotes?: (date: string) => void;
}

export function headerText(day: Pick<HistoryDay, 'count' | 'entityLabel'>): string {
  return day.entityLabel
    ? `${day.count} ${day.count === 1 ? 'change' : 'changes'} to ${day.entityLabel}`
    : `${day.count} ${day.count === 1 ? 'change' : 'changes'}`;
}

export function DayCard({ day, expanded, onToggle, onAddNote, onOpenNotes }: DayCardProps) {
  const noteLabel = day.notesCount > 0 ? `Add a note (${day.notesCount})` : 'Add a note';
  return (
    <Box
      component="section"
      aria-label={`Changes on ${monthDay(day.date)}`}
      data-testid="day-card"
      data-date={day.date}
      sx={{ display: 'flex', gap: 4, mb: 3 }}
    >
      <Box sx={{ width: 72, flexShrink: 0, pt: 3, textAlign: 'right' }}>
        <Typography variant="subtitle2" component="div">
          {monthDay(day.date)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {day.weekday}
        </Typography>
      </Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 4,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" component="h3" data-testid="day-header">
            {headerText(day)}
          </Typography>
          {onAddNote ? (
            <Button size="small" variant="text" onClick={() => onAddNote(day.date)}>
              {noteLabel}
            </Button>
          ) : onOpenNotes && day.notesCount > 0 ? (
            <Button size="small" variant="text" onClick={() => onOpenNotes(day.date)}>
              {`Notes (${day.notesCount})`}
            </Button>
          ) : null}
        </Box>
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            '& th, & td': { textAlign: 'left', px: 4, py: 1.5, verticalAlign: 'top' },
            '& tbody tr + tr td': { borderTop: '1px solid', borderColor: 'divider' },
            '& th': { typography: 'caption', color: 'text.secondary', fontWeight: 500 },
          }}
        >
          <thead>
            <tr>
              <th style={{ width: 140 }}>Time</th>
              <th>Description</th>
              <th style={{ width: 280 }}>User</th>
            </tr>
          </thead>
          <tbody>
            {day.changes.map((c) => {
              const open = expanded.has(c.groupId);
              return (
                <tr key={c.groupId} data-testid="history-change" data-system={c.system || undefined}>
                  <td>
                    <Typography variant="body2" noWrap>{`${c.time} ${c.tzLabel}`}</Typography>
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <IconButton
                        size="small"
                        aria-label={open ? 'Collapse description' : 'Expand description'}
                        aria-expanded={open}
                        onClick={() => onToggle(c.groupId)}
                        sx={{ mt: -0.5 }}
                      >
                        <DvIcon name={open ? 'expand_less' : 'expand_more'} size={18} />
                      </IconButton>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2">{c.summary}</Typography>
                        {open ? (
                          <Box component="ul" sx={{ m: 0, mt: 1, pl: 4 }} data-testid="change-lines">
                            {c.lines.map((line, i) => (
                              <Typography key={i} variant="body2" component="li" color="text.secondary">
                                {line}
                              </Typography>
                            ))}
                          </Box>
                        ) : null}
                      </Box>
                    </Box>
                  </td>
                  <td>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                      {c.user}
                    </Typography>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}
