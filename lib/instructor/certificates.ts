import 'server-only';
import type { Actor } from '@/lib/accounts/permissions';
import { toSessionRole } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { decidePolicyCertificate } from '@/lib/settings/policy';
import { CERT_KINDS } from '@/lib/settings/constants';
import { writeInstructorAudit } from './audit';
import { InstructorError } from './rules';
import { loadClass, myClasses, type Db } from './scope';

// Policy certificate requests (module 03 T09, C-03-5). A student requests a certificate for an advertiser in their
// sandbox; the instructor of the class decides here. The decision itself is `decidePolicyCertificate` of
// lib/settings, so the change history and the version bump are the same as anywhere else.

export interface CertificateRequestRow {
  id: string;
  classId: string;
  className: string;
  studentName: string;
  advertiserName: string;
  kind: string;
  title: string;
  countryCode: string;
  notes: string | null;
  requestedAt: Date;
}

export async function listCertificateRequests(
  actor: Actor,
  db: Db = prisma,
): Promise<CertificateRequestRow[]> {
  const classes = await myClasses(db, actor);
  if (classes.length === 0) return [];
  const sandboxes = await db.sandbox.findMany({
    where: { classroomId: { in: classes.map((c) => c.id) }, kind: 'STUDENT', ownerUserId: { not: null } },
    select: { id: true, classroomId: true, owner: { select: { name: true } } },
  });
  if (sandboxes.length === 0) return [];
  const bySandbox = new Map(sandboxes.map((s) => [s.id, s]));
  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const rows = await db.policyCertificate.findMany({
    where: { sandboxId: { in: sandboxes.map((s) => s.id) }, status: 'REQUESTED' },
    orderBy: { requestedAt: 'asc' },
    take: 200,
    include: { advertiser: { select: { name: true } } },
  });
  return rows.map((r) => {
    const sb = bySandbox.get(r.sandboxId)!;
    return {
      id: r.id,
      classId: sb.classroomId,
      className: classNames.get(sb.classroomId) ?? '',
      studentName: sb.owner?.name ?? '',
      advertiserName: r.advertiser.name,
      kind: r.kind,
      title: CERT_KINDS.find((k) => k.kind === r.kind)?.title ?? r.kind,
      countryCode: r.countryCode,
      notes: r.notes,
      requestedAt: r.requestedAt,
    };
  });
}

export async function decideCertificate(
  actor: Actor,
  certId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string | undefined,
  actorName: string,
  actorEmail: string,
  db: Db = prisma,
): Promise<void> {
  const cert = await db.policyCertificate.findUnique({
    where: { id: certId },
    select: { id: true, sandboxId: true, status: true },
  });
  if (!cert) throw new InstructorError('SIM-020');
  const sandbox = await db.sandbox.findUnique({
    where: { id: cert.sandboxId },
    select: { classroomId: true },
  });
  if (!sandbox) throw new InstructorError('SIM-020');
  const cls = await loadClass(db, actor, sandbox.classroomId); // only the class's instructor decides
  if (cert.status !== 'REQUESTED') throw new InstructorError('SIM-018', 'This request was already decided.');
  const role = toSessionRole(actor.role);
  const me = { id: actor.id, email: actorEmail, name: actorName, appRole: role };
  const user: SessionUser = {
    ...me,
    appRole: role,
    classroomId: cls.id,
    sandboxId: cert.sandboxId,
    dvRole: 'ADMIN',
    actor: me,
  };
  const res = await decidePolicyCertificate(user, certId, decision, reason);
  if (!res.ok) throw new InstructorError('FORBIDDEN');
  await writeInstructorAudit(db, {
    actorUserId: actor.id,
    actorRole: actor.role,
    classroomId: cls.id,
    action: 'CERTIFICATE_DECIDED',
    targetType: 'PolicyCertificate',
    targetId: certId,
    payload: { decision },
  });
}
