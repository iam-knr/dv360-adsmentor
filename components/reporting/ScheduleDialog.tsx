'use client';

// Schedule and delivery fields (module 16 S5 and S4 cards 3 and 4). `ScheduleFields` is shared by the instant dialog
// and the offline builder; the dialog saves through `scheduleReportAction`.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { DvModal, DvSelect, DvTextField, useToast } from '@/components/dv';
import { scheduleReportAction } from '@/lib/reporting/actions';
import { scheduleSummary } from '@/lib/reporting/schedule';
import type { ReportDelivery, ReportSchedule } from '@/lib/reporting/types';

export const DEFAULT_SCHEDULE = (today: string): ReportSchedule => ({
  active: false,
  timeZone: 'UTC',
  repeats: 'DAILY',
  every: 1,
  starts: today,
});
export const DEFAULT_DELIVERY = (name: string): ReportDelivery => ({
  format: 'CSV',
  fileName: name.replace(/\s+/g, '_'),
  emailOwner: false,
  attachment: true,
  shareWith: [],
});

export const REPEATS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];
const ZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
];

export function ScheduleFields({
  schedule,
  delivery,
  onSchedule,
  onDelivery,
  errors,
}: {
  schedule: ReportSchedule;
  delivery: ReportDelivery;
  onSchedule: (s: ReportSchedule) => void;
  onDelivery: (d: ReportDelivery) => void;
  errors?: Record<string, string>;
}) {
  const zones = ZONES.some((z) => z.value === schedule.timeZone)
    ? ZONES
    : [...ZONES, { value: schedule.timeZone, label: schedule.timeZone }];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={schedule.active}
            onChange={(e) => onSchedule({ ...schedule, active: e.target.checked })}
          />
        }
        label="Active"
      />
      <DvSelect
        label="Time zone"
        value={schedule.timeZone}
        onChange={(v) => onSchedule({ ...schedule, timeZone: v })}
        options={zones}
      />
      <Box sx={{ display: 'flex', gap: 3 }}>
        <DvSelect
          label="Repeats"
          value={schedule.repeats}
          onChange={(v) => onSchedule({ ...schedule, repeats: v as ReportSchedule['repeats'] })}
          options={REPEATS}
        />
        <DvTextField
          label="Every"
          type="number"
          value={String(schedule.every)}
          onChange={(v) => onSchedule({ ...schedule, every: Math.max(0, Number(v) || 0) })}
          {...(errors?.['schedule.every'] ? { error: errors['schedule.every'] } : {})}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 3 }}>
        <DvTextField
          label="Starts"
          placeholder="YYYY-MM-DD"
          value={schedule.starts}
          onChange={(v) => onSchedule({ ...schedule, starts: v })}
        />
        <DvTextField
          label="Expires"
          placeholder="YYYY-MM-DD"
          value={schedule.expires ?? ''}
          onChange={(v) => {
            const { expires: _drop, ...rest } = schedule;
            void _drop;
            onSchedule(v ? { ...rest, expires: v } : rest);
          }}
          {...(errors?.['schedule.expires'] ? { error: errors['schedule.expires'] } : {})}
        />
      </Box>
      <Typography variant="body2" data-testid="schedule-summary">
        {scheduleSummary(schedule)}
      </Typography>
      <DvSelect
        label="Format"
        value={delivery.format}
        onChange={(v) => onDelivery({ ...delivery, format: v as ReportDelivery['format'] })}
        options={[
          { value: 'CSV', label: 'CSV' },
          { value: 'XLSX', label: 'Excel' },
        ]}
      />
      <DvTextField
        label="File name"
        value={delivery.fileName}
        onChange={(v) => onDelivery({ ...delivery, fileName: v })}
        hint="The date and time are added to the name."
        {...(errors?.['delivery.fileName'] ? { error: errors['delivery.fileName'] } : {})}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={delivery.emailOwner}
            onChange={(e) => onDelivery({ ...delivery, emailOwner: e.target.checked })}
          />
        }
        label="Email owner (you get a message in the bell)"
      />
      {delivery.emailOwner ? (
        <DvSelect
          label="Attachment"
          value={delivery.attachment === false ? 'link' : 'file'}
          onChange={(v) => onDelivery({ ...delivery, attachment: v === 'file' })}
          options={[
            { value: 'file', label: 'Attach file' },
            { value: 'link', label: 'Link only' },
          ]}
        />
      ) : null}
    </Box>
  );
}

export function ScheduleDialog({
  open,
  reportId,
  reportName,
  today,
  initialSchedule,
  initialDelivery,
  onClose,
  onSaved,
}: {
  open: boolean;
  reportId: string;
  reportName: string;
  today: string;
  initialSchedule?: ReportSchedule;
  initialDelivery?: ReportDelivery;
  onClose: () => void;
  onSaved: (s: ReportSchedule, d: ReportDelivery) => void;
}) {
  const toast = useToast();
  const [schedule, setSchedule] = useState<ReportSchedule>(
    initialSchedule ?? { ...DEFAULT_SCHEDULE(today), active: true },
  );
  const [delivery, setDelivery] = useState<ReportDelivery>(
    initialDelivery ?? DEFAULT_DELIVERY(reportName),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await scheduleReportAction(reportId, schedule, delivery);
    setBusy(false);
    if (!res.ok) {
      setErrors(Object.fromEntries(res.issues.map((i) => [i.path, i.message])));
      return;
    }
    setErrors({});
    toast.show({ kind: 'neutral', message: 'Schedule saved' });
    onSaved(schedule, delivery);
    onClose();
  };

  return (
    <DvModal
      open={open}
      title="Schedule report"
      size="md"
      onClose={onClose}
      primary={{ label: 'Save schedule', onClick: () => void save(), loading: busy }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <ScheduleFields
        schedule={schedule}
        delivery={delivery}
        onSchedule={setSchedule}
        onDelivery={setDelivery}
        errors={errors}
      />
    </DvModal>
  );
}
