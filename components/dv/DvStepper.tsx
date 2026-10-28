'use client';

import { Fragment } from 'react';
import Box from '@mui/material/Box';
import { DvIcon } from '@/components/icons';

export interface DvStep {
  id: string;
  label: string;
  error?: boolean;
}

export interface DvStepperProps {
  steps: DvStep[];
  /** Zero-based index of the current step. */
  current: number;
}

/** Wizard stepper (design-system 2.18): upcoming, current, completed and error states. */
export function DvStepper({ steps, current }: DvStepperProps) {
  return (
    <Box
      component="ol"
      aria-label="Progress"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        listStyle: 'none',
        m: 0,
        p: 0,
      }}
    >
      {steps.map((s, i) => {
        const state = s.error
          ? 'error'
          : i < current
            ? 'completed'
            : i === current
              ? 'current'
              : 'upcoming';
        const filled = state === 'current' || state === 'completed';
        return (
          <Fragment key={s.id}>
            {i > 0 ? (
              <Box
                component="li"
                aria-hidden="true"
                sx={{ width: 72, height: '1px', bgcolor: 'divider', mx: 2 }}
              />
            ) : null}
            <Box
              component="li"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
              sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  typography: 'caption',
                  fontWeight: 500,
                  bgcolor: filled ? 'primary.main' : 'transparent',
                  color: filled
                    ? 'common.white'
                    : state === 'error'
                      ? 'status.error'
                      : 'text.secondary',
                  border: filled ? 'none' : '1px solid',
                  borderColor: state === 'error' ? 'status.error' : 'divider',
                }}
              >
                {state === 'completed' ? (
                  <DvIcon name="check" size={16} />
                ) : state === 'error' ? (
                  <DvIcon name="error" size={16} filled />
                ) : (
                  i + 1
                )}
              </Box>
              <Box
                component="span"
                sx={{
                  typography: 'body1',
                  fontWeight: state === 'current' ? 500 : 400,
                  color: state === 'current' ? 'text.primary' : 'text.secondary',
                }}
              >
                {s.label}
              </Box>
              {state === 'completed' ? (
                <Box component="span" sx={visuallyHidden}>
                  (completed)
                </Box>
              ) : null}
              {state === 'error' ? (
                <Box component="span" sx={visuallyHidden}>
                  (has errors)
                </Box>
              ) : null}
            </Box>
          </Fragment>
        );
      })}
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
