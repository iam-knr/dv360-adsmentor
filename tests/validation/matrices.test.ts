// MX table tests: the constants must equal the tables of validation.md (V-06-11, V-07-19, V-08-19, V-08-20, V-08-21).
import { describe, expect, it } from 'vitest';
import { validate } from '@/lib/validation';
import {
  allowedBidStrategies,
  defaultBidMode,
  strategyNeedsTarget,
} from '@/lib/validation/constants/bids';
import {
  CAMPAIGN_GOALS,
  CAMPAIGN_KPI_UNIVERSE,
  KPIS,
  notRecommendedKpis,
  RECOMMENDED_KPIS,
  type Kpi,
} from '@/lib/validation/constants/goals-kpis';
import {
  AUTOMATED_STRATEGIES,
  IO_OBJECTIVES,
  IO_TYPES,
  ioBidStrategiesFor,
  ioKpisFor,
  isObjectiveEnabled,
  STANDARD_IO_MATRIX,
  type IoObjective,
  type IoType,
} from '@/lib/validation/constants/io-matrix';
import {
  CTV_OTT_ONLY_LI_TYPES,
  LI_TYPE_BY_OBJECTIVE,
  LI_TYPES,
  liTypeAllowedByIoType,
  liTypeAllowedByObjective,
  type LiType,
} from '@/lib/validation/constants/li-compat';
import { isIoPacingAllowed, isLiPacingAllowed } from '@/lib/validation/constants/pacing';
import {
  availabilityOf,
  MATRIX_DIMENSIONS,
  MATRIX_TO_DM,
  matrixDimensionOf,
  TARGETING_COLUMNS,
  type Availability,
  type MatrixDimension,
  type TargetingColumn,
} from '@/lib/validation/constants/targeting-availability';
import { applyPatch, makeCtx, validCampaign } from '@/lib/validation/testing/fixtures';
import { backtickSpans, readDoc, splitRow } from './docs';

const doc = readDoc('docs/specs/validation.md');

/** Table rows between a heading and the next heading of the same or higher level. */
function tableAfter(heading: string): string[][] {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.startsWith(heading));
  expect(start, heading).toBeGreaterThan(-1);
  const rows: string[][] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^#{1,3} /.test(line)) break;
    if (line.startsWith('| ') && !line.startsWith('|---')) rows.push(splitRow(line));
  }
  return rows;
}

describe('MX-01 goal to KPI (V-06-11)', () => {
  const rows = tableAfter('### MX-01').filter((r) => r[0]!.startsWith('`'));

  it('matches the document table', () => {
    expect(rows).toHaveLength(CAMPAIGN_GOALS.length);
    for (const row of rows) {
      const goal = backtickSpans(row[0]!)[0] as (typeof CAMPAIGN_GOALS)[number];
      const recommended = [...new Set(backtickSpans(row[2]!))];
      const not = [...new Set(backtickSpans(row[3]!))].filter((k) => k !== 'CPV (+ others)');
      expect([...RECOMMENDED_KPIS[goal]].sort(), goal).toEqual(recommended.sort());
      expect([...notRecommendedKpis(goal)].sort(), goal).toEqual(not.sort());
    }
  });

  it.each(CAMPAIGN_GOALS.flatMap((goal) => [...CAMPAIGN_KPI_UNIVERSE, 'OTHER' as Kpi].map((kpi) => [goal, kpi] as const)))(
    '%s x %s warns iff not recommended',
    (goal, kpi) => {
      const campaign = applyPatch(validCampaign(), { goal, kpi: { type: kpi, value: kpi === 'OTHER' ? null : 5 } });
      const issues = validate('campaign', campaign, makeCtx());
      const warned = issues.some((i) => i.ruleId === 'CMP-013');
      expect(warned).toBe(kpi !== 'OTHER' && notRecommendedKpis(goal).includes(kpi));
      expect(issues.filter((i) => i.blocking)).toEqual([]);
    },
  );

  it('keeps every KPI key from the registry', () => {
    for (const kpi of CAMPAIGN_KPI_UNIVERSE) expect(KPIS).toContain(kpi);
  });
});

describe('MX-02 IO type x objective (V-07-19)', () => {
  const rows = tableAfter('### MX-02')
    .filter((r) => r.length === 4 && r[0]!.startsWith('`') && /BRAND_AWARENESS|CLICKS|CONVERSIONS|CUSTOM|NONE/.test(r[0]!))
    .filter((r) => backtickSpans(r[0]!).length === 1);

  it('matches the STANDARD table B', () => {
    const objectives = rows.map((r) => backtickSpans(r[0]!)[0] as IoObjective);
    expect(objectives.sort()).toEqual([...IO_OBJECTIVES].sort());
    for (const row of rows) {
      const objective = backtickSpans(row[0]!)[0] as IoObjective;
      const matrix = STANDARD_IO_MATRIX[objective];
      if (objective !== 'NONE') {
        expect([...matrix.kpis].sort(), `${objective} kpis`).toEqual(backtickSpans(row[1]!).sort());
        expect([...matrix.bidStrategies].sort(), `${objective} bids`).toEqual(backtickSpans(row[2]!).filter((s) => s !== 'FIXED_BID').sort());
        expect([...matrix.liTypes].sort(), `${objective} types`).toEqual(backtickSpans(row[3]!).sort());
      } else {
        expect([...matrix.liTypes].sort()).toEqual(backtickSpans(row[3]!).sort());
      }
    }
  });

  const enabled: Record<IoType, IoObjective[]> = {
    STANDARD: ['BRAND_AWARENESS', 'CLICKS', 'CONVERSIONS', 'CUSTOM', 'NONE'],
    CTV_OTT: ['BRAND_AWARENESS', 'CONVERSIONS', 'CUSTOM', 'NONE'],
    DOOH: ['NONE'],
  };

  it.each(IO_TYPES.flatMap((t) => IO_OBJECTIVES.map((o) => [t, o] as const)))('%s x %s', (type, objective) => {
    expect(isObjectiveEnabled(type, objective)).toBe(enabled[type].includes(objective));
  });

  it('gives CTV and OTT insertion orders their own KPI and strategy lists', () => {
    expect(ioKpisFor('CTV_OTT', 'BRAND_AWARENESS')).toEqual(['CPM', 'VALUE_COST']);
    expect(ioKpisFor('CTV_OTT', 'CONVERSIONS')).toEqual(['CPA', 'VALUE_COST']);
    expect(ioKpisFor('CTV_OTT', 'CUSTOM')).toEqual(['VALUE_COST']);
    expect(ioBidStrategiesFor('CTV_OTT', 'BRAND_AWARENESS')).toEqual(['MAX_REACH']);
    expect(ioKpisFor('DOOH', 'NONE')).toEqual([]);
    expect(ioBidStrategiesFor('DOOH', 'NONE')).toEqual([]);
    expect(ioKpisFor('STANDARD', 'NONE').length).toBeGreaterThan(10);
    expect(ioBidStrategiesFor('STANDARD', 'NONE')).toEqual(AUTOMATED_STRATEGIES);
  });
});

describe('MX-03 line item type x IO objective (V-08-19)', () => {
  const rows = tableAfter('### MX-03').filter((r) => r.length === 6 && /^`[A-Z_]+`$/.test(r[0]!) && (r[1] === 'Y' || r[1] === 'N'));

  it('matches the document table', () => {
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      const type = backtickSpans(row[0]!)[0] as LiType;
      IO_OBJECTIVES.forEach((objective, i) => {
        expect(liTypeAllowedByObjective(objective, type), `${type} x ${objective}`).toBe(row[i + 1] === 'Y');
        expect(LI_TYPE_BY_OBJECTIVE[objective][type as keyof (typeof LI_TYPE_BY_OBJECTIVE)['NONE']]).toBe(row[i + 1] === 'Y');
      });
    }
  });

  it('agrees with MX-02 table B (derived from the same data)', () => {
    for (const objective of IO_OBJECTIVES) {
      const allowed = LI_TYPES.filter((t) => liTypeAllowedByObjective(objective, t) && !CTV_OTT_ONLY_LI_TYPES.includes(t) && !t.startsWith('DOOH'));
      expect(allowed.sort(), objective).toEqual([...STANDARD_IO_MATRIX[objective].liTypes].sort());
    }
  });

  it.each(IO_TYPES.flatMap((t) => LI_TYPES.map((l) => [t, l] as const)))('IO %s accepts %s', (ioType, liType) => {
    const expected =
      ioType === 'DOOH'
        ? liType.startsWith('DOOH')
        : ioType === 'CTV_OTT'
          ? liType === 'CTV' || liType === 'YT_ON_CTV'
          : !liType.startsWith('DOOH') && liType !== 'YT_ON_CTV';
    expect(liTypeAllowedByIoType(ioType, liType)).toBe(expected);
  });
});

describe('MX-04 bid strategies (V-08-20)', () => {
  it('follows the line item refinements', () => {
    expect(allowedBidStrategies('STANDARD', 'CLICKS', 'DISPLAY')).toEqual(['MAX_CLICKS', 'MAX_CUSTOM_VALUE_COST']);
    expect(allowedBidStrategies('STANDARD', 'BRAND_AWARENESS', 'CTV')).toEqual(['MAX_REACH']);
    expect(allowedBidStrategies('STANDARD', 'BRAND_AWARENESS', 'DISPLAY')).toEqual(STANDARD_IO_MATRIX.BRAND_AWARENESS.bidStrategies);
    expect(allowedBidStrategies('STANDARD', 'BRAND_AWARENESS', 'VIDEO')).toContain('MAX_VIEWABLE_IMPRESSIONS');
    expect(allowedBidStrategies('DOOH', 'NONE', 'DOOH_DISPLAY')).toEqual([]);
    expect(allowedBidStrategies('STANDARD', 'NONE', 'DISPLAY')).toEqual(AUTOMATED_STRATEGIES);
  });

  it.each(IO_OBJECTIVES.flatMap((o) => (['DISPLAY', 'VIDEO', 'AUDIO', 'MOBILE_APP_INSTALL'] as LiType[]).map((l) => [o, l] as const)))(
    '%s x %s uses the objective list unless refined',
    (objective, type) => {
      const refined = objective === 'CLICKS' && type === 'DISPLAY';
      if (!refined) expect(allowedBidStrategies('STANDARD', objective, type)).toEqual(ioBidStrategiesFor('STANDARD', objective));
    },
  );

  it('knows which strategies need a target value', () => {
    for (const s of ['TARGET_CPM', 'TARGET_CPV', 'TARGET_CPC', 'TARGET_CPA', 'TARGET_VIEWABLE_IMPRESSIONS', 'TARGET_CUSTOM_VALUE_COST', 'MAX_CPV', 'TARGET_ROAS'] as const) {
      expect(strategyNeedsTarget(s), s).toBe(true);
    }
    for (const s of ['MAX_REACH', 'MAX_CONVERSIONS', 'MAX_VIEWABLE_IMPRESSIONS'] as const) expect(strategyNeedsTarget(s), s).toBe(false);
    expect(strategyNeedsTarget('MAX_CLICKS')).toBe(false);
    expect(strategyNeedsTarget('MAX_CLICKS', 'TARGET')).toBe(true);
  });

  it('defaults to automated, except Audio and DOOH (V-08-17)', () => {
    expect(defaultBidMode('AUDIO')).toBe('FIXED');
    expect(defaultBidMode('DOOH_DISPLAY')).toBe('FIXED');
    expect(defaultBidMode('DOOH_VIDEO')).toBe('FIXED');
    expect(defaultBidMode('DISPLAY')).toBe('AUTOMATED');
    expect(defaultBidMode('CTV')).toBe('AUTOMATED');
  });
});

describe('MX-05 pacing', () => {
  it('matches the IO and line item tables', () => {
    expect(isIoPacingAllowed('FLIGHT', 'AHEAD')).toBe(true);
    expect(isIoPacingAllowed('FLIGHT', 'EVEN')).toBe(true);
    expect(isIoPacingAllowed('FLIGHT', 'ASAP')).toBe(false);
    expect(isIoPacingAllowed('DAILY', 'EVEN')).toBe(true);
    expect(isIoPacingAllowed('DAILY', 'ASAP')).toBe(true);
    expect(isIoPacingAllowed('DAILY', 'AHEAD')).toBe(false);
    // RC-039: Flight x Ahead is allowed for line items
    for (const type of ['EVEN', 'AHEAD', 'ASAP'] as const) expect(isLiPacingAllowed('FLIGHT', type)).toBe(true);
    expect(isLiPacingAllowed('DAILY', 'AHEAD')).toBe(false);
  });
});

describe('MX-10 targeting availability (V-08-21)', () => {
  const headerCols = [...TARGETING_COLUMNS];
  const rows = tableAfter('### MX-10').filter((r) => r.length === 11 && /^`[A-Z_]+`/.test(r[0]!));

  function cellOf(text: string): Availability {
    if (text.startsWith('Y if adType')) return 'V';
    return text[0] as Availability;
  }

  it('matches the document matrix cell by cell', () => {
    expect(rows).toHaveLength(23);
    for (const row of rows) {
      const labels = backtickSpans(row[0]!).filter((s) => /^[A-Z_]+$/.test(s)) as MatrixDimension[];
      for (const label of labels) {
        expect(MATRIX_DIMENSIONS, label).toContain(label);
        headerCols.forEach((col: TargetingColumn, i) => {
          let text = row[i + 1]!;
          // the combined row "LIVESTREAM, REWARDED": CTV supports the livestream only
          if (labels.length === 2 && col === 'CTV' && label === 'REWARDED') text = 'N';
          expect(cellOf(text), `${label} x ${col}`).toBe(
            // the raw matrix keeps 'V' for "Y if adType VIDEO"
            (availabilityRaw(label, col)),
          );
        });
      }
    }
  });

  function availabilityRaw(label: MatrixDimension, col: TargetingColumn): Availability {
    // availabilityOf resolves V with the ad type; ask with VIDEO and with no ad type to recover the raw cell
    const typeForColumn: Record<TargetingColumn, LiType> = {
      DSP: 'DISPLAY',
      VID: 'VIDEO',
      CTV: 'CTV',
      AUD: 'AUDIO',
      MAI: 'MOBILE_APP_INSTALL',
      AIA: 'ADS_IN_MOBILE_APPS',
      YTLI: 'YT_VIDEO',
      YTAG: 'YT_VIDEO',
      DG: 'DEMAND_GEN',
      DOOH: 'DOOH_DISPLAY',
    };
    if (col === 'YTAG') return rawYtag(label);
    const withVideo = availabilityOf(typeForColumn[col], label, 'VIDEO');
    const without = availabilityOf(typeForColumn[col], label, null);
    return withVideo !== without ? 'V' : without;
  }

  function rawYtag(label: MatrixDimension): Availability {
    // YTAG has no line item type; read the exported matrix directly
    return TARGETING_MATRIX_YTAG[label];
  }

  it('maps every matrix label to DM TargetingDimension keys (RC-011)', () => {
    const dm = readDoc('docs/specs/data-model.md');
    const line = dm.split('\n').find((l) => l.startsWith('| `TargetingDimension`'))!;
    const known = new Set(backtickSpans(line));
    for (const label of MATRIX_DIMENSIONS) {
      expect(MATRIX_TO_DM[label].length, label).toBeGreaterThan(0);
      for (const key of MATRIX_TO_DM[label]) expect(known.has(key.split(':')[0]!), `${label} -> ${key}`).toBe(true);
    }
    for (const named of ['INVENTORY_SOURCE', 'APPS_AND_URLS', 'AUDIENCE_LIST', 'CONTENT_STREAM_TYPE', 'DOOH_VENUE']) {
      expect(matrixDimensionOf(named), named).not.toBeNull();
    }
    expect(matrixDimensionOf('KEYWORD')).toBe('KEYWORDS');
    expect(matrixDimensionOf('KEYWORD:EXCLUDE')).toBe('KEYWORD_EXCLUSIONS');
    expect(matrixDimensionOf('CONTENT_GENRE')).toBeNull();
  });

  it('resolves "Y if adType VIDEO" with the ad type of the line item', () => {
    expect(availabilityOf('ADS_IN_MOBILE_APPS', 'VIDEO_PLAYER_SIZE', 'VIDEO')).toBe('Y');
    expect(availabilityOf('ADS_IN_MOBILE_APPS', 'VIDEO_PLAYER_SIZE', 'DISPLAY')).toBe('N');
    expect(availabilityOf('CTV', 'REWARDED')).toBe('N');
    expect(availabilityOf('CTV', 'LIVESTREAM')).toBe('Y');
  });
});

// The YouTube ad group column is not tied to a line item type, so the test reads it from the constants module.
import { TARGETING_AVAILABILITY } from '@/lib/validation/constants/targeting-availability';
const TARGETING_MATRIX_YTAG = Object.fromEntries(
  MATRIX_DIMENSIONS.map((d) => [d, TARGETING_AVAILABILITY[d].YTAG]),
) as Record<MatrixDimension, Availability>;
