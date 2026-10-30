// Wire types of module 17. Plain serialisable data shared by services, server actions and components.
import type {
  BrandLiftMetric,
  ConfidenceLevel,
  ExperimentChannelScope,
  ExperimentGoal,
  ExperimentStatus,
  ExperimentTarget,
  IntendedAction,
  LiftSlice,
  LiftStatus,
  LiftStrength,
  LiftType,
} from '@prisma/client';

export type Num = number | string | null | undefined;

export interface BrandLiftInput {
  metrics: BrandLiftMetric[];
  brandName: string;
  competitors: string[];
  language: string;
  objectType: string | null;
  intendedAction: IntendedAction | null;
}

export interface AbArmInput {
  /** Existing arm id when editing. */
  id?: string;
  name: string;
  splitPct: Num;
  isControl: boolean;
  /** IO or line item ids (internal). */
  entityIds: string[];
}

export interface AbTestInput {
  name: string;
  hypothesis?: string | null;
  startDate: string;
  endDate?: string | null;
  target: ExperimentTarget;
  arms: AbArmInput[];
  goal: ExperimentGoal;
  confidence: ConfidenceLevel;
  excludeUnidentifiedUsers: boolean;
  /** Brand lift block (IO arms with YouTube or Demand Gen line items only). */
  brandLift?: BrandLiftInput | null;
  liftEnabled?: boolean;
  /** Edit: version read with the form (optimistic lock). */
  version?: number;
}

export interface LiftStudyInput {
  name: string;
  ioIds: string[];
  /** Radio of the IO picker: IOs containing YouTube PG, or all other IOs. */
  ioGroup: 'YOUTUBE_PG' | 'OTHER';
  liftTypes: LiftType[];
  brandLift: BrandLiftInput;
  strength: LiftStrength;
  searchGroups: string[][];
  version?: number;
}

export interface AbRow {
  id: string;
  publicId: string;
  name: string;
  arms: number;
  status: ExperimentStatus;
  startDate: string;
  endDate: string | null;
  target: ExperimentTarget;
}

export interface AbList {
  rows: AbRow[];
  canWrite: boolean;
  today: string;
}

export interface CandidateRow {
  id: string;
  publicId: string;
  name: string;
  /** Line items: the IO the line item belongs to. */
  parent?: string | undefined;
  scope: ExperimentChannelScope;
  warning?: string | undefined;
  inOtherTest?: string | undefined;
  inactive?: boolean | undefined;
}

export interface AbArmView {
  id: string;
  name: string;
  splitPct: number;
  isControl: boolean;
  entities: { id: string; publicId: string; name: string }[];
}

export interface AbTestView {
  id: string;
  publicId: string;
  name: string;
  hypothesis: string | null;
  startDate: string;
  endDate: string | null;
  target: ExperimentTarget;
  goal: ExperimentGoal;
  confidence: ConfidenceLevel;
  excludeUnidentifiedUsers: boolean;
  channelScope: ExperimentChannelScope;
  status: ExperimentStatus;
  arms: AbArmView[];
  controlArmId: string | null;
  version: number;
  canEdit: boolean;
  locked: { dates: boolean; arms: boolean };
  endedAt: string | null;
  liftStudyId: string | null;
  liftStudyPublicId: string | null;
  brandLift: BrandLiftInput | null;
  today: string;
}

export type TileKind = 'count' | 'percent' | 'money' | 'decimal';

export interface TileArm {
  armId: string;
  value: number | null;
  /** Relative difference to the control arm, percent. Null for the control and for empty values. */
  diffPct: number | null;
  significant: boolean;
  z: number | null;
}

export interface Tile {
  key: string;
  label: string;
  kind: TileKind;
  currency?: string | undefined;
  arms: TileArm[];
  best: { armId: string; name: string } | 'N/A' | null;
}

export interface AbReport {
  metric: AbMetric;
  metricLabel: string;
  controlArmId: string;
  confidence: ConfidenceLevel;
  range: { from: string; to: string };
  tiles: Tile[];
  /** Per arm daily values of the chosen metric. */
  series: { armId: string; name: string; points: { date: string; value: number }[] }[];
  best: { armId: string; name: string } | 'N/A';
  significance: Record<string, { z: number | null; p: number | null; significant: boolean }>;
  perArm: { armId: string; name: string; isControl: boolean; splitPct: number; counters: Record<string, number> }[];
  media: { spend: number; arms: number; currency: string };
  hasData: boolean;
  asOf: string;
  status: ExperimentStatus;
  notStartedUntil: string | null;
}

import type { AbMetric } from './constants';

export interface LiftFlightRow {
  type: LiftType;
  flightNo: number;
  status: LiftStatus;
  pctComplete: number;
  requiredMediaCost: number | null;
  mediaCostSoFar: number;
  hasResults: boolean;
}

export interface LiftRow {
  id: string;
  publicId: string;
  name: string;
  ios: number;
  status: LiftStatus;
  brand: LiftFlightRow | null;
  search: LiftFlightRow | null;
  hasBrand: boolean;
  hasSearch: boolean;
}

export interface LiftList {
  rows: LiftRow[];
  canWrite: boolean;
}

export interface EligibilityType {
  type: LiftType;
  eligible: boolean;
  measurableLis: number;
  requiredMediaCost: number;
  yourMediaCost: number;
  window: [string, string];
}

export interface LiftStudyView {
  id: string;
  publicId: string;
  name: string;
  ios: { id: string; publicId: string; name: string }[];
  ioGroup: 'YOUTUBE_PG' | 'OTHER';
  liftTypes: LiftType[];
  brandLift: BrandLiftInput;
  strength: LiftStrength;
  searchGroups: string[][];
  status: LiftStatus;
  flights: LiftFlightRow[];
  version: number;
  canEdit: boolean;
  currency: string;
}

export interface LiftMetricResult {
  metric: BrandLiftMetric;
  baselineRate: number | null;
  exposedRate: number | null;
  absoluteLift: number | null;
  relativeLift: number | null;
  headroomLift: number | null;
  /** Interval of the chosen lift measure. */
  ci: [number, number] | null;
  significant: boolean;
  responses: number;
  slices: {
    value: string;
    responses: number;
    enough: boolean;
    lift: number | null;
    significant: boolean;
  }[];
}

export interface LiftReport {
  tab: 'YT_DG' | 'CROSS_EXCHANGE';
  liftType: 'ABSOLUTE' | 'RELATIVE' | 'HEADROOM';
  slice: LiftSlice;
  metrics: LiftMetricResult[];
  search: { groups: { terms: string[]; relUplift: number; significant: boolean }[] } | null;
  surveyResponses: number;
  insertionOrders: number;
  lineItems: number;
  flightNo: number | null;
  empty: boolean;
  sliceOptions: LiftSlice[];
}
