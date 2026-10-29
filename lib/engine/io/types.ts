// Shapes shared by the engine runtime (P3-08b). The pure core never sees these.
import type { World } from '../world';

export interface ClockRow {
  sandboxId: string;
  classroomId: string;
  simStartMs: number;
  tickIndex: number;
  state: 'RUNNING' | 'PAUSED' | 'STEPPING' | 'LOCKED';
  minutesPerSimDay: number;
  lastAdvanceRealMs: number | null;
  remainderMs: number;
  marketSeed: string;
  sandboxSeed: string;
  paramsVersion: string;
  runOutsideSession: boolean;
}

/** One World per advertiser plus the lookups persistTick needs to place rows. */
export interface AdvertiserWorld {
  advertiserId: string;
  world: World;
  /** Budget segment id to its end day (advertiser dates). */
  segmentEnds: Map<string, string>;
  ioOfSegment: Map<string, string>;
  campaignOfIo: Map<string, string>;
  ioOfLi: Map<string, string>;
}

export interface LoadedSandbox {
  clock: ClockRow;
  worlds: AdvertiserWorld[];
}

export interface TickStats {
  ticks: number;
  rows: number;
  /** Alert codes raised in the run, for fast-forward stop conditions. */
  raised: string[];
}
