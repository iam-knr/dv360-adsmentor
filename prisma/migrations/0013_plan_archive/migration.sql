-- plan-parity: an archived plan stays in the list behind the Archived status filter, read-only (module 04).
ALTER TYPE "PlanStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
