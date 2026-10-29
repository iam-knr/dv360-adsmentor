// `GET /api/dv/meta/io-objective-matrix` response (module 07 Δ-07-5, Δ-07-10): built from the MX-02 constants of
// lib/validation, so the step 1 preview pane, the LI type picker and the rules read one source. Pure.
import { DOOH_LI_TYPES, type LiType } from '@/lib/validation/constants/li-compat';
import {
  IO_OBJECTIVES,
  IO_OBJECTIVE_LABEL,
  IO_TYPE_RULES,
  STANDARD_IO_MATRIX,
  ioBidStrategiesFor,
  ioKpisFor,
  isObjectiveEnabled,
  type BidStrategy,
  type IoObjective,
  type IoType,
} from '@/lib/validation/constants/io-matrix';
import type { Kpi } from '@/lib/validation';

export interface ObjectiveEntry {
  key: IoObjective;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
  kpis: Kpi[];
  bidStrategies: BidStrategy[];
  lineItemTypes: LiType[];
}

export interface IoObjectiveMatrix {
  type: IoType;
  objectives: ObjectiveEntry[];
}

/** Short descriptions under each objective radio ([SIM] wording; the demo shows icons and one line each). */
export const OBJECTIVE_DESCRIPTION: Record<IoObjective, string> = {
  BRAND_AWARENESS: 'Reach the right people and make them aware of your brand or product.',
  CLICKS: 'Get people to click your ads and visit your website.',
  CONVERSIONS: 'Get people to take an action on your website or app, such as a purchase.',
  CUSTOM: 'Optimize towards a custom value you define with custom bidding.',
  NONE: 'No objective. Any KPI and bid strategy can be used.',
};

const DISABLED_REASON: Partial<Record<IoType, string>> = {
  CTV_OTT: "Clicks isn't available for Connected TV and OTT insertion orders.",
  DOOH: 'Digital out of home insertion orders can only be created without an objective.',
};

function liTypesFor(type: IoType, objective: IoObjective): LiType[] {
  const rule = IO_TYPE_RULES[type].liTypes;
  if (rule === 'STANDARD_MATRIX') return [...STANDARD_IO_MATRIX[objective].liTypes];
  return type === 'DOOH' ? [...DOOH_LI_TYPES] : [...rule];
}

export function ioObjectiveMatrix(type: IoType): IoObjectiveMatrix {
  return {
    type,
    objectives: IO_OBJECTIVES.map((key): ObjectiveEntry => {
      const enabled = isObjectiveEnabled(type, key);
      return {
        key,
        label: IO_OBJECTIVE_LABEL[key],
        description: OBJECTIVE_DESCRIPTION[key],
        enabled,
        ...(enabled ? {} : { disabledReason: DISABLED_REASON[type] ?? '' }),
        kpis: [...ioKpisFor(type, key)],
        bidStrategies: type === 'DOOH' ? ['FIXED_BID'] : [...ioBidStrategiesFor(type, key)],
        lineItemTypes: liTypesFor(type, key),
      };
    }),
  };
}

export function isIoType(v: unknown): v is IoType {
  return v === 'STANDARD' || v === 'CTV_OTT' || v === 'DOOH';
}

export function isIoObjective(v: unknown): v is IoObjective {
  return typeof v === 'string' && (IO_OBJECTIVES as readonly string[]).includes(v);
}
