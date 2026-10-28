# prisma/bootstrap

Owner session: P3-02 and P3-05b.
Spec: build-plan 2.3. Do not edit from another session (build-plan 3.2).

`10-admin.bootstrap.ts` (P3-02) creates the first Super admin from `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD`, only when no Super admin exists. It runs on every deploy and does nothing after the first.
