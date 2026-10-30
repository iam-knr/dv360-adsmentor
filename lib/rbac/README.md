# lib/rbac

Owner session: P3-02.
Spec: modules/02 (4), routes.md 2, data-model 5.1. Do not edit from another session (build-plan 3.2).

- `can.ts`: `can(user, action, scope)` and `assertAccess` for the DV360 levels (`ADMIN`, `STANDARD`, `READ_ONLY`, `REPORTING_ONLY`, `PARTNER_CLIENT`, `CREATIVE`). Action classes: `view`, `write`, `user_admin`, `report_build`, `report_view`, or a permission key.
- `permissions.ts`: the role and permission matrix. P3-05a keeps it as constants, not tables.
- `areas.ts`: which account level (`user`, `super_admin`) opens `/manage` and `/manage/settings` (only the Super admin does).
