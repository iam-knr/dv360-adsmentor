// Session shapes shared by the edge middleware, server code and the Auth.js type augmentation.
// Session role values are lowercase (RC-016, RC-068). Two account levels exist (ADM-FIX): a Super admin and students.
// The database enum keeps ADMIN (dropping an enum value needs a risky migration), but nothing creates, shows or signs in
// that level, and it has no session value.
export type AppRole = 'user' | 'super_admin';
export type DvRole =
  | 'ADMIN'
  | 'STANDARD'
  | 'READ_ONLY'
  | 'REPORTING_ONLY'
  | 'PARTNER_CLIENT'
  | 'CREATIVE';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  appRole: AppRole;
  classroomId?: string;
  sandboxId?: string;
  partnerId?: string;
  dvRole: DvRole;
  /** Set while an admin looks at the simulator as a student (`?sim_as=`). `id` is then the viewed student. */
  viewAs?: { userId: string; actAs: boolean };
  /** The signed in person when `viewAs` is set (or always, for convenience). Writes are logged with this id. */
  actor?: { id: string; email: string; name: string; appRole: AppRole };
  mustChangePassword?: boolean;
  /** The Super admin allows this student to take screenshots (default false). Optional so fixtures need not set it. */
  screenshotsAllowed?: boolean;
  /** Time zone of the resolved classroom (IANA). */
  timeZone?: string;
}

export type SessionFailureReason =
  | 'none'
  | 'idle'
  | 'absolute'
  | 'revoked'
  | 'other-device'
  | 'suspended';

/** What the Auth.js session callback exposes (and what the edge middleware reads). */
export interface SessionClaims {
  id: string;
  appRole: AppRole;
  /** Must change the password before anything else. */
  mcp: boolean;
}

declare module 'next-auth' {
  interface User {
    appRole?: AppRole;
    sessionVersion?: number;
    sid?: string;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id: string;
      appRole: AppRole;
      mcp: boolean;
      /** sessionVersion, sid and loginAt are checked against the database by requireUser() */
      sv: number;
      sid: string;
      loginAt: number;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    appRole?: AppRole;
    /** sessionVersion at sign in */
    sv?: number;
    /** session id, compared with User.activeSessionId for single session accounts */
    sid?: string;
    /** mustChangePassword at sign in */
    mcp?: boolean;
    /** Unix seconds of the sign in (Auth.js resets `iat` on every refresh, so the absolute limit needs its own claim) */
    loginAt?: number;
  }
}
