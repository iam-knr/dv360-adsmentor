// URL builders of the experiment pages (routes.md 3.3, module 17 S1 to S9).
import { advertiserPath } from '@/lib/routes/paths';

export const experimentsPath = (pid: string, aid: string): string => advertiserPath(pid, aid, 'experiments');
export const liftStudiesPath = (pid: string, aid: string): string =>
  advertiserPath(pid, aid, 'brand-lift-measurements');
export const newAbPath = (pid: string, aid: string): string => advertiserPath(pid, aid, 'experiments', 'new');
export const abReportPath = (pid: string, aid: string, testId: string): string =>
  advertiserPath(pid, aid, 'e', testId);
export const abSettingsPath = (pid: string, aid: string, testId: string): string =>
  advertiserPath(pid, aid, 'e', testId, 'report', 'settings');
export const abDiffPath = (pid: string, aid: string, testId: string): string =>
  advertiserPath(pid, aid, 'e', testId, 'report', 'diff');
export const newLiftPath = (pid: string, aid: string): string =>
  advertiserPath(pid, aid, 'brand-lift-measurements', 'new');
export const liftReportPath = (pid: string, aid: string, studyId: string): string =>
  advertiserPath(pid, aid, 'brand-lift-measurements', studyId, 'report');
export const liftEditPath = (pid: string, aid: string, studyId: string): string =>
  advertiserPath(pid, aid, 'brand-lift-measurements', studyId, 'edit');
