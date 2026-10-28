import { z } from 'zod';

// Validation for engine/params.json (engine.md 2.7). Unknown keys fail. Money is in the file's
// `currency` per 1,000 impressions unless the key says otherwise.

const num = z.number().finite();
const pos = z.number().finite().positive();
const share = z.number().min(0).max(1);
const rec = <T extends z.ZodTypeAny>(v: T) => z.record(z.string(), v);
const hours24 = z.array(pos).length(24);
const pair = z.tuple([num, num]);

export const FORMATS = ['display', 'native', 'video_instream', 'ctv', 'audio', 'youtube'] as const;
export const DEVICES = ['computer', 'smartphone', 'tablet', 'ctv'] as const;

const distSchema = z.object({ median: pos, sigma: pos }).strict();
const mult3 = z.object({ price: pos, ctr: pos, view: pos }).strict();

const formatSchema = z
  .object({
    floor: distSchema,
    clear: distSchema,
    internalDelta: num,
    ctr: share,
    measurable: share,
    viewable: share,
    viewableKappa: pos,
    cvrClick: share,
    cvrView: share,
    requestsPerUserPerDay: pos,
    engagementRate: share.optional(),
    startRate: share.optional(),
    quartiles: z.object({ q1: share, q2: share, q3: share, q4: share }).strict().optional(),
    skippableViewRate: share.optional(),
    completionSkippable: share.optional(),
    completionBumper: share.optional(),
  })
  .strict();

const exchangeSchema = z
  .object({
    auctionType: z.enum(['first', 'second']),
    priceIdx: pos,
    latencyDropRate: share,
    creativeRejectRate: share,
    lossReportedShare: share,
    ivtRate: share,
    enabledByDefault: z.boolean(),
  })
  .strict();

const marketSchema = z
  .object({
    priceIdx: pos,
    ctrIdx: pos,
    viewIdx: pos,
    cvrIdx: pos,
    volumeIdx: pos,
    tz: z.string(),
    currency: z.string().length(3),
    regionShare: rec(share).optional(),
    regionPriceIdx: rec(pos).optional(),
  })
  .strict();

const audienceKinds = rec(pos);

export const paramsSchema = z
  .object({
    schemaVersion: z.literal(1),
    currency: z.string().length(3),
    tickMinutesSimulated: z.literal(60),
    fx: z.object({ asOf: z.string(), perUSD: rec(pos) }).strict(),
    markets: rec(marketSchema),
    supply: z
      .object({
        supplyScale: pos,
        noiseSigma: z.number().min(0),
        hodPriceExponent: z.number().min(0),
        basePeakRequestsPerHour: rec(pos),
        exchangeShare: rec(rec(share)),
        deviceShare: rec(rec(share)),
        appShareBySmartphone: rec(share),
        appShareByDevice: rec(share),
        hourOfDay: z.object({ default: hours24, ctv: hours24, audio: hours24 }).strict(),
        dayOfWeek: z
          .object({ default: z.array(pos).length(7), ctv: z.array(pos).length(7) })
          .strict(),
        seasonality: z.array(z.object({ from: z.string(), to: z.string(), factor: pos }).strict()),
      })
      .strict(),
    exchanges: rec(exchangeSchema),
    formats: rec(formatSchema),
    multipliers: z
      .object({
        device: rec(mult3),
        environment: rec(mult3),
        position: rec(mult3),
        audiencePremium: rec(pos),
        vertical: rec(pos),
      })
      .strict(),
    competitors: z
      .object({
        pressure: pos,
        internalPresence: share,
        privateAuctionBidders: z.object({ mean: pos, min: pos }).strict(),
        preferredFirstLookFill: share,
      })
      .strict(),
    bidding: z
      .object({
        learning: z
          .object({
            exitEvents: rec(pos),
            tau: rec(pos),
            exploreSigmaStart: pos,
            exploreSigmaEnd: pos,
            initialQuality: share,
            relearnQualityFloor: share,
            relearnHours: pair,
            firstDaySpendCap: share,
            lambdaDamping: share,
            optimizedTargetingEventWeight: pos,
            significantChangePct: pos,
            significantBudgetChangePct: pos,
          })
          .strict(),
        bidNoise: z.number().min(0),
        maxBidMultipleOfClear: pos,
        firstPriceShadeMax: share,
        feeAwareBids: z.boolean(),
        lambdaIterations: z.number().int().min(4),
        tos10Share: z.object({ display: share, video: share }).strict(),
        audibleRate: z.object({ ctv: share, app: share, web: share }).strict(),
        ioOptimizer: z
          .object({
            credibilityEvents: pos,
            exponent: pos,
            minShare: share,
            lookbackDays: pos,
            autoAllocateStep: share,
          })
          .strict(),
      })
      .strict(),
    pacing: z
      .object({
        aheadFactor: share,
        aheadMaxDailyMultiple: pos,
        overshootMax: pos,
        allocationHeadroom: pos,
        intraday: z.enum(['flat', 'traffic']),
        ewmaAlpha: share,
        underpacing: z
          .object({
            defaultThresholdPct: pos,
            minHoursSinceSegmentStart: z.number().min(0),
            rateWindowDays: pos,
          })
          .strict(),
      })
      .strict(),
    outcomes: z
      .object({
        frequencyCtrDecay: share,
        frequencyCvrDecay: share,
        ivtRefundShare: share,
        reachNegBinK: pos,
        lag: z
          .object({
            click: z.object({ medianHours: pos, sigma: pos }).strict(),
            view: z.object({ medianHours: pos, sigma: pos }).strict(),
          })
          .strict(),
        windows: z.object({ clickDays: pos, viewDays: pos }).strict(),
        multiTouchShare: share,
        identifiedShare: z.object({ web: share, app: share, ctv: share }).strict(),
        conversionDateBasis: z.enum(['conversion_date', 'ad_event_date']),
        ivtFraudVerifyCut: share,
        invalidClickShare: share,
        beginToRenderRate: share,
        creativeQualitySigma: z.number().min(0),
        ctrNoise: z.number().min(0),
        hodCtr: hours24,
        audienceLift: audienceKinds,
        audienceCvrLift: audienceKinds,
        quartileSmartphoneScale: pos,
        quartileLargePlayerScale: pos,
        coViewShare: z.object({ ctv: share, default: share }).strict(),
        categoryMult: rec(pos),
        repeatPerUserDay: rec(share),
        defaultAverageOrderValue: pos,
        defaultItemsPerTransaction: pos,
        attribution: z
          .object({ timeDecayHalfLifeDays: pos, dataDrivenIncrementality: rec(pos) })
          .strict(),
      })
      .strict(),
    costs: z
      .object({
        dv360FeePct: share,
        adServingCpm: z.number().min(0),
        dataCpm: rec(z.number().min(0)),
        verificationCpm: rec(z.number().min(0)),
      })
      .strict(),
    targeting: z
      .object({
        inventoryQuality: z
          .object({ DIRECT_ONLY: share, DIRECT_AND_RESELLERS: share, ALL: share })
          .strict(),
        pincodeShare: rec(share),
        languageShare: rec(rec(share)),
        allocation: z
          .object({
            deviceDetail: rec(share),
            browser: rec(share),
            connection: rec(share),
            carrier: rec(share),
            category: rec(share),
            position: rec(share),
            age: rec(share),
            gender: rec(share),
            parental: rec(share),
            income: rec(share),
          })
          .strict(),
        keyword: z
          .object({
            minShare: share,
            maxShare: share,
            listSizeForMax: pos,
            negativeShareEach: share,
            negativeShareMax: share,
          })
          .strict(),
        appUrl: z.object({ universeSize: pos, includeExponent: pos }).strict(),
        brandSuitability: z
          .object({
            maximum: share,
            standard: share,
            limited: share,
            perLabelShare: share,
            perCategoryShare: share,
          })
          .strict(),
        verificationBlockShare: rec(share),
        audience: z
          .object({
            sizeRange: rec(pair),
            userPool: pos,
            lookalikeExpansion: pos,
            lookalikeCap: share,
            minUsableSize: pos,
            usableAfterHours: z.number().min(0),
            premiumPerSizeBoost: z.number().min(0),
          })
          .strict(),
        optimizedExpansion: z.number().min(0),
        optimizedRateMult: pos,
        viewabilityPremiumSlope: z.number().min(0),
      })
      .strict(),
    creatives: z
      .object({
        slotSizes: rec(share),
        explorationTicks: z.number().min(0),
        optimizationSharpness: pos,
        qualityBonusRich: z.number().min(0),
        qualityPenaltyScaled: z.number().min(0),
        qualityPenaltyTracking: z.number().min(0),
      })
      .strict(),
    alerts: z
      .object({
        limitedAudienceMinRequestsPerHour: pos,
        underperformingPct: pos,
        noSpendMinTicksIntoDay: z.number().min(0),
        resolveAfterClearTicks: z.number().int().min(1),
        minSample: z
          .object({ impressions: pos, clicks: pos, conversions: pos, views: pos })
          .strict(),
        suggestions: z
          .object({
            rateThreshold: share,
            sizeMismatchThreshold: share,
            targetingThreshold: share,
            limitedByCreatives: share,
          })
          .strict(),
      })
      .strict(),
    aggregation: z.object({ dailySliceKinds: z.array(z.string()) }).strict(),
    experiments: z
      .object({
        contaminationShare: share,
        identifiedOnlyShare: share,
        zCritical: rec(pos),
      })
      .strict(),
    lift: z.object({ costPerResponse: pos, baseline: rec(share), maxRelLift: rec(share) }).strict(),
    calibration: z
      .object({
        ctrBand: pair,
        ctrBandByFormat: rec(pair),
        videoCompletionBand: pair,
        viewRateBand: rec(pair),
        marketPriceTolerance: share,
        cpmBand: rec(pair),
        viewabilityBand: rec(pair),
        winRateAtClear: pair,
        winRateAt06: pair,
        winRateAt15Min: share,
        targetingFilteredSingleRegion: pair,
        lostInternalShare: pair,
        eOtherShare: pair,
        flightEvenPct: pair,
        aheadShareByDay27: pair,
      })
      .strict(),
  })
  .strict();

export type Params = z.infer<typeof paramsSchema>;
export type FormatParams = Params['formats'][string];
