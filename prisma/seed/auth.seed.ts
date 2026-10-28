// Auth data that every environment needs (P3-02). Idempotent.
//  - AccountPolicy: the one row (id = 1) with the module 19 defaults. The core migration inserts it too; this keeps a
//    database that was reset without migrations usable.
//  - Roles and permissions: P3-05a kept `Role`, `Permission` and `RolePermission` as constants instead of tables
//    (see the note on UserAccessGrant in prisma/schema/10-training.prisma). The matrix of data-model 5.1 lives in
//    lib/rbac/permissions.ts, so there are no rows to write; this file only checks the matrix is complete.
import { prisma } from '@/lib/db';
import { DV_ROLES, PERMISSION_KEYS, ROLE_PERMISSIONS } from '@/lib/rbac/permissions';

export async function run(): Promise<void> {
  try {
    await prisma.accountPolicy.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    for (const role of DV_ROLES) {
      const unknown = ROLE_PERMISSIONS[role].filter((k) => !PERMISSION_KEYS.includes(k));
      if (unknown.length)
        throw new Error(`auth.seed: ${role} has unknown permissions: ${unknown.join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
