// Permission matrix of module 19 4.2 as data. Pure: no I/O, so the whole table is a Vitest loop.
export type Level = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export type AccountAction =
  | 'manage.open'
  | 'policy.edit'
  | 'account.view'
  | 'account.create'
  | 'account.edit'
  | 'account.disable'
  | 'account.enable'
  | 'account.unlock'
  | 'account.resetPassword'
  | 'account.revokeSessions'
  | 'account.delete'
  | 'account.restore'
  | 'account.changeRole'
  | 'account.transfer'
  | 'cohort.create'
  | 'cohort.edit'
  | 'audit.view';

export interface Actor {
  id: string;
  role: Level;
}

/** For `account.create` only `role` matters (the role being created). */
export interface Target {
  id?: string;
  role: Level;
  ownerAdminId?: string | null;
  /** Owner admin of the cohort the target sits in. */
  cohortOwnerId?: string | null;
}

type Rule = (actor: Actor, target: Target | undefined) => boolean;

const isSelf = (a: Actor, t?: Target) => !!t?.id && t.id === a.id;
const isOwn = (a: Actor, t?: Target) =>
  !!t && t.role === 'USER' && (t.ownerAdminId === a.id || t.cohortOwnerId === a.id);

const SA_ONLY: Rule = () => false;
// "Never on self" actions for a Super admin; Admin only on own Users.
const notSelf: Rule = (a, t) => !isSelf(a, t);

const SUPER: Record<AccountAction, Rule> = {
  'manage.open': () => true,
  'policy.edit': () => true,
  'account.view': () => true,
  'account.create': () => true,
  'account.edit': () => true,
  'account.disable': notSelf,
  'account.enable': () => true,
  'account.unlock': () => true,
  // "Reset password of another Super admin: -" (they change their own).
  'account.resetPassword': (a, t) => !t || t.role !== 'SUPER_ADMIN' || isSelf(a, t),
  'account.revokeSessions': () => true,
  // Super admin accounts are never deleted; nobody deletes their own account.
  'account.delete': (a, t) => !t || (t.role !== 'SUPER_ADMIN' && !isSelf(a, t)),
  'account.restore': () => true,
  'account.changeRole': notSelf,
  'account.transfer': () => true,
  'cohort.create': () => true,
  'cohort.edit': () => true,
  'audit.view': () => true,
};

const ADMIN: Record<AccountAction, Rule> = {
  'manage.open': () => true,
  'policy.edit': SA_ONLY,
  'account.view': (a, t) => isSelf(a, t) || isOwn(a, t),
  'account.create': (_a, t) => t?.role === 'USER',
  'account.edit': (a, t) => isOwn(a, t),
  'account.disable': (a, t) => isOwn(a, t),
  'account.enable': (a, t) => isOwn(a, t),
  'account.unlock': (a, t) => isOwn(a, t),
  'account.resetPassword': (a, t) => isOwn(a, t),
  'account.revokeSessions': (a, t) => isSelf(a, t) || isOwn(a, t),
  'account.delete': (a, t) => isOwn(a, t),
  'account.restore': (a, t) => isOwn(a, t),
  'account.changeRole': SA_ONLY,
  'account.transfer': SA_ONLY,
  'cohort.create': () => true,
  'cohort.edit': (a, t) => !!t && t.ownerAdminId === a.id,
  'audit.view': () => true,
};

const TABLES: Record<Level, Record<AccountAction, Rule> | null> = {
  SUPER_ADMIN: SUPER,
  ADMIN: ADMIN,
  USER: null,
};

export const ACCOUNT_ACTIONS = Object.keys(SUPER) as AccountAction[];

/** Table driven check. The UI hides buttons; the server calls this for every action. */
export function can(actor: Actor, action: AccountAction, target?: Target): boolean {
  const table = TABLES[actor.role];
  return table ? table[action](actor, target) : false;
}
