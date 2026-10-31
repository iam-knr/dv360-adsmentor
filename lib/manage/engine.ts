import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withBypass } from '@/lib/db';
import { sandboxStateLabel, type SandboxStateLabel } from '@/lib/sandbox/labels';

export interface ParamRow {
  section: string;
  name: string;
  value: string;
}

/** A parameter value as one short line: scalars as they are, lists and objects as compact text cut at 90 characters. */
export function paramText(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = JSON.stringify(v);
  return s.length > 90 ? `${s.slice(0, 87)}...` : s;
}

/** One row per parameter: the top-level sections of `engine/params.json`, one level deep. Pure. */
export function paramRows(parsed: Record<string, unknown>): ParamRow[] {
  const rows: ParamRow[] = [];
  for (const [section, value] of Object.entries(parsed)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [name, v] of Object.entries(value as Record<string, unknown>))
        rows.push({ section, name, value: paramText(v) });
    } else {
      rows.push({ section: 'general', name: section, value: paramText(value) });
    }
  }
  return rows;
}

/** Engine parameters, read only: the version is the content hash (engine.md 2.7). Editing is not in v1. */
export function readEngineParams(): {
  hash: string;
  bytes: number;
  top: [string, unknown][];
  rows: ParamRow[];
  tickMinutes: number | null;
  raw: string;
} {
  const raw = readFileSync(join(process.cwd(), 'engine', 'params.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    hash: createHash('sha256').update(raw).digest('hex').slice(0, 12),
    bytes: raw.length,
    top: Object.entries(parsed).map(([k, v]) => [k, v]),
    rows: paramRows(parsed),
    tickMinutes:
      typeof parsed.tickMinutesSimulated === 'number' ? parsed.tickMinutesSimulated : null,
    raw: JSON.stringify(parsed, null, 2),
  };
}

export interface EngineStatus {
  /** Real time of the latest tick in any sandbox, or null when nothing has run. */
  lastRunAt: Date | null;
  /** Latest simulated time reached by any sandbox clock. */
  simNow: Date | null;
  clocks: number;
  /** Sandboxes by the shared vocabulary (Queued, Building, Ready, Failed). */
  counts: Record<SandboxStateLabel, number>;
}

/** Live numbers for the engine page. */
export async function readEngineStatus(): Promise<EngineStatus> {
  return withBypass(async (tx) => {
    const [clocks, states] = await Promise.all([
      tx.simClock.findMany({
        select: { simStart: true, tickIndex: true, lastAdvanceRealAt: true },
      }),
      tx.sandbox.groupBy({
        by: ['provisionState'],
        where: { status: { not: 'ARCHIVED' } },
        _count: { _all: true },
      }),
    ]);
    const counts: Record<SandboxStateLabel, number> = {
      'Not created': 0,
      Queued: 0,
      Building: 0,
      Ready: 0,
      Failed: 0,
    };
    for (const g of states) counts[sandboxStateLabel(g.provisionState)] += g._count._all;
    let lastRunAt: Date | null = null;
    let simMs: number | null = null;
    for (const c of clocks) {
      if (c.lastAdvanceRealAt && (!lastRunAt || c.lastAdvanceRealAt > lastRunAt))
        lastRunAt = c.lastAdvanceRealAt;
      const ms = c.simStart.getTime() + Number(c.tickIndex) * 3_600_000;
      if (simMs === null || ms > simMs) simMs = ms;
    }
    return {
      lastRunAt,
      simNow: simMs === null ? null : new Date(simMs),
      clocks: clocks.length,
      counts,
    };
  });
}
