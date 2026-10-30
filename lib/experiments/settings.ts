// Flat settings maps of IOs and line items for the Difference panel (module 17 4.4). Strings only: equal strings are
// "the same setting". No `server-only` import: pure reads over a transaction.
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;
const dash = '-';
const d = (v: string | number | bigint | { toString(): string } | null | undefined): string =>
  v === null || v === undefined || v === '' ? dash : v.toString();
const day = (v: Date | null | undefined): string => (v ? v.toISOString().slice(0, 10) : dash);
const freq = (r: { freqMode: string; freqMaxExposures: number | null; freqUnit: unknown; freqUnitCount: number | null }) =>
  r.freqMode === 'LIMITED' ? `${r.freqMaxExposures} per ${r.freqUnitCount} ${String(r.freqUnit).toLowerCase()}` : r.freqMode.toLowerCase();

export async function settingsOfIo(db: Db, ioId: string): Promise<Record<string, string>> {
  const io = await db.insertionOrder.findUniqueOrThrow({
    where: { id: ioId },
    include: { segments: true, fees: true },
  });
  const budget = io.segments.reduce((s, x) => s + Number(x.amount), 0);
  return {
    'Budget': String(budget),
    'Budget unit': io.budgetUnit.toLowerCase(),
    'Pacing': `${io.pacingPeriod.toLowerCase()} ${io.pacingType.toLowerCase()}`,
    'KPI': io.kpi ? `${io.kpi} ${d(io.kpiValue)}` : dash,
    'Bid and budget control': io.bidBudgetControl.toLowerCase().replace(/_/g, ' '),
    'Optimization target': d(io.optimizeTarget),
    'Frequency cap': freq(io),
    'Partner costs': String(io.fees.length),
  };
}

export async function settingsOfLi(db: Db, liId: string): Promise<Record<string, string>> {
  const li = await db.lineItem.findUniqueOrThrow({
    where: { id: liId },
    include: { targeting: true, assignments: { include: { creative: { select: { name: true } } } } },
  });
  const out: Record<string, string> = {
    'Type': li.type,
    'Flight': li.flightMode === 'CUSTOM' ? `${day(li.flightStart)} to ${day(li.flightEnd)}` : 'inherits the IO',
    'Budget': li.budgetMode === 'FIXED' ? String(li.budgetAmount) : 'Unlimited up to the IO',
    'Pacing': `${li.pacingPeriod.toLowerCase()} ${li.pacingType.toLowerCase()}`,
    'Bid strategy': li.bidKind === 'FIXED' ? 'Fixed CPM' : d(li.bidGoal),
    'Bid value': li.bidKind === 'FIXED' ? d(li.fixedBidCpm) : d(li.bidTargetValue),
    'Frequency cap': freq(li),
    'Creatives': li.assignments.map((a) => a.creative.name).sort().join(', ') || dash,
  };
  const optionIds = li.targeting.map((t) => t.optionId).filter((x): x is string => !!x);
  const names = new Map(
    (optionIds.length
      ? await db.targetingOption.findMany({ where: { id: { in: optionIds } }, select: { id: true, name: true } })
      : []
    ).map((o) => [o.id, o.name]),
  );
  const byDim = new Map<string, string[]>();
  for (const t of li.targeting) {
    const label = (t.optionId && names.get(t.optionId)) || t.refId || t.valueText || 'on';
    const v = `${t.mode === 'EXCLUDE' ? 'exclude ' : ''}${label}`;
    byDim.set(t.dimension, [...(byDim.get(t.dimension) ?? []), v]);
  }
  for (const [dim, vals] of [...byDim].sort()) out[`Targeting, ${dim.toLowerCase().replace(/_/g, ' ')}`] = vals.sort().join(', ');
  return out;
}
