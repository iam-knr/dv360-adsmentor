export type AppRole = 'student' | 'instructor' | 'admin';
export type DvRole =
  'ADMIN' | 'STANDARD' | 'READ_ONLY' | 'REPORTING_ONLY' | 'PARTNER_CLIENT' | 'CREATIVE';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  appRole: AppRole;
  classroomId?: string;
  sandboxId?: string;
  partnerId?: string;
  dvRole: DvRole;
  viewAs?: { userId: string; actAs: boolean };
}
