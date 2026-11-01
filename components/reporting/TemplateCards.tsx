'use client';

// Suggested templates of the instant report list (audit REP-006/007): seven cards in a row, the family tag above the
// title, one "Open template" link, a coloured top border and a "View All" toggle. No scroll arrows.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import type { TemplateDef } from '@/lib/reporting/templates';

const BORDER: Record<TemplateDef['family'], string> = {
  BASIC: '#1a73e8',
  REACH: '#d93025',
  VIDEO: '#e8710a',
};

export function TemplateCards({
  templates,
  onOpen,
}: {
  templates: TemplateDef[];
  onOpen: (key: string) => void;
}) {
  const [all, setAll] = useState(false);
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 3, mb: 2 }}>
        <Typography variant="cardTitle" component="h2">
          Suggested templates
        </Typography>
        <Link component="button" underline="hover" aria-expanded={all} onClick={() => setAll((a) => !a)}>
          {all ? 'View Less' : 'View All'}
        </Link>
      </Box>
      <Box
        role="list"
        aria-label="Suggested templates"
        sx={{
          display: 'flex',
          gap: 3,
          flexWrap: all ? 'wrap' : 'nowrap',
          overflow: all ? 'visible' : 'hidden',
        }}
      >
        {templates.map((t) => (
          <Box
            role="listitem"
            key={t.key}
            data-testid="template-card"
            sx={{
              width: 200,
              flexShrink: 0,
              p: 3,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderTop: `4px solid ${BORDER[t.family]}`,
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
              {t.family}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {t.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {t.description}
            </Typography>
            <Link
              component="button"
              underline="hover"
              sx={{ alignSelf: 'flex-start', mt: 1 }}
              aria-label={`Open template ${t.title}`}
              onClick={() => onOpen(t.key)}
            >
              Open template
            </Link>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
