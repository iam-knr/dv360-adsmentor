-- P4-10a bulk edit, SDF and charts (module 11): enum values only, no table changes.
-- K7 bulk edit of targeting gets its own BulkAction value.
ALTER TYPE "BulkAction" ADD VALUE IF NOT EXISTS 'EDIT_TARGETING';
-- Δ-11-6: ChartCardSpec.kind is BAR, LINE, PIE, BUBBLE, KPI, BUILT_IN or NOTE (the built-in card is named in the definition).
ALTER TYPE "ChartCardKind" ADD VALUE IF NOT EXISTS 'KPI';
ALTER TYPE "ChartCardKind" ADD VALUE IF NOT EXISTS 'BUILT_IN';
ALTER TYPE "ChartCardKind" ADD VALUE IF NOT EXISTS 'NOTE';
