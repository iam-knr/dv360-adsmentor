/** One label per app role, shown in the header badge, the account page and the admin lists (Q14). */
export const APP_ROLE_LABEL = {
  user: 'Student',
  super_admin: 'Super admin',
  admin: 'Retired level',
} as const;

export type AppRoleKey = keyof typeof APP_ROLE_LABEL;

export function appRoleLabel(role: string): string {
  const key = role.toLowerCase() as AppRoleKey;
  return APP_ROLE_LABEL[key] ?? role;
}
