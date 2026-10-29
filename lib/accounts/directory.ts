// Read-only lookups of login users by id, for modules that show people who hold access grants (settings, changelog).
// Kept here because User rows may only be queried inside lib/accounts and lib/auth (module 19 3.4).
import { prisma } from '@/lib/db';

export type DirectoryPerson = { id: string; name: string; email: string };

export function peopleByIds(ids: string[]): Promise<DirectoryPerson[]> {
  return prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true, email: true },
  });
}

export async function loginIdByEmail(ids: string[], email: string): Promise<string | null> {
  if (ids.length === 0) return null;
  const row = await prisma.user.findFirst({ where: { id: { in: ids }, email }, select: { id: true } });
  return row?.id ?? null;
}
