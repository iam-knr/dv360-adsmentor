// Active View (60), In-Stream Video (30), In-Stream Audio (10), YouTube (60), Brand Controls (15), Audience (40).
import {
  QUARTILES,
  counter,
  currencyTriplet,
  derivedDim,
  moneyCounter,
  moneyRatio,
  moneyZero,
  ratio,
  sliceDim,
  zeroDim,
  zeroMetric,
} from './generators';
import { slug } from './generators';
import type { ReportFieldDef } from './types';

const AV = 'Active View' as const;
const QCOLS = ['Start', 'Q1', 'Mid', 'Q3', 'Complete'] as const;

export function activeViewFields(): ReportFieldDef[] {
  const out: ReportFieldDef[] = [
    counter(AV, 'Measurable Impressions', 'measurableImpressions'),
    counter(AV, 'Viewable Impressions', 'viewableImpressions'),
    counter(AV, 'Eligible Impressions', 'impressions'),
    {
      ...counter(AV, 'Not Measurable Impressions', 'impressions'),
      source: { t: 'DIFF', of: ['eligible_impressions', 'measurable_impressions'] },
    },
    {
      ...counter(AV, 'Not Viewable Impressions', 'impressions'),
      source: { t: 'DIFF', of: ['measurable_impressions', 'viewable_impressions'] },
    },
    counter(AV, 'Impressions Visible for 10 Seconds', 'viewable10sImpressions'),
    counter(AV, 'Audible Impressions', 'audibleImpressions'),
    zeroMetric(AV, 'Full-Screen Impressions'),
    counter(AV, 'Fully On-Screen 2 Sec Impressions', 'fullyOnScreen2s'),
    counter(AV, 'In Background Impressions', 'inBackgroundImpressions'),
    ratio(AV, '% Measurable Impressions', 'measurable_impressions', 'eligible_impressions', 100),
    ratio(AV, '% Viewable Impressions', 'viewable_impressions', 'measurable_impressions', 100),
    ratio(AV, '% Audible Impressions', 'audible_impressions', 'video_starts', 100),
    zeroMetric(AV, '% Full-Screen', 'PERCENT'),
    ratio(
      AV,
      '% Fully On-Screen 2 sec',
      'fully_on_screen_2_sec_impressions',
      'measurable_impressions',
      100,
    ),
    ratio(AV, '% In Background', 'in_background_impressions', 'measurable_impressions', 100),
    ratio(
      AV,
      '% Visible 10 Seconds',
      'impressions_visible_for_10_seconds',
      'measurable_impressions',
      100,
    ),
  ];
  QUARTILES.forEach((q, i) => {
    out.push(counter(AV, `Audible and Visible at ${q} Impressions`, `audibleVisible${QCOLS[i]}`));
  });
  QUARTILES.forEach((q) => {
    out.push(
      ratio(
        AV,
        `% Audible and Visible at ${q}`,
        `audible_and_visible_at_${slug(q)}_impressions`,
        'video_starts',
        100,
      ),
    );
  });
  QUARTILES.forEach((q) => out.push(zeroMetric(AV, `Visible at ${q} Impressions`)));
  QUARTILES.forEach((q) => out.push(zeroMetric(AV, `% Visible at ${q}`, 'PERCENT')));
  QUARTILES.forEach((q) => out.push(zeroMetric(AV, `Full-Screen at ${q} Impressions`)));
  QUARTILES.forEach((q) => out.push(zeroMetric(AV, `% Full-Screen at ${q}`, 'PERCENT')));
  out.push(
    zeroMetric(AV, '% Play Time Audible', 'PERCENT'),
    zeroMetric(AV, '% Play Time Visible', 'PERCENT'),
    zeroMetric(AV, '% Play Time Audible and Visible', 'PERCENT'),
    zeroMetric(AV, '% of Ad Played', 'PERCENT'),
    zeroMetric(AV, 'Average Viewable Time (Seconds)', 'DECIMAL'),
    zeroMetric(AV, 'Average Audible Time (Seconds)', 'DECIMAL'),
    zeroMetric(AV, 'Average Visible Time (Seconds)', 'DECIMAL'),
    zeroMetric(AV, 'Total Viewable Time (Seconds)', 'DECIMAL'),
    zeroMetric(AV, 'Total Audible Time (Seconds)', 'DECIMAL'),
    zeroMetric(AV, 'Ad Played Seconds', 'DECIMAL'),
    zeroMetric(AV, 'Viewable Impressions (Video)'),
    zeroMetric(AV, 'Measurable Impressions (Video)'),
    zeroMetric(AV, '% Viewable Impressions (Video)', 'PERCENT'),
  );
  return out;
}

const VID = 'In-Stream Video' as const;
export function inStreamVideoFields(): ReportFieldDef[] {
  return [
    counter(VID, 'Video Starts', 'videoStarts'),
    counter(VID, 'Video First Quartile Views', 'videoQ1'),
    counter(VID, 'Video Midpoint Views', 'videoMid'),
    counter(VID, 'Video Third Quartile Views', 'videoQ3'),
    counter(VID, 'Video Completions', 'videoCompletions'),
    ratio(VID, 'Video Start Rate', 'video_starts', 'impressions', 100),
    ratio(VID, 'Video Completion Rate', 'video_completions', 'video_starts', 100),
    ratio(VID, 'Video First Quartile Rate', 'video_first_quartile_views', 'video_starts', 100),
    ratio(VID, 'Video Midpoint Rate', 'video_midpoint_views', 'video_starts', 100),
    ratio(VID, 'Video Third Quartile Rate', 'video_third_quartile_views', 'video_starts', 100),
    counter(VID, 'Skips (Video)', 'skips'),
    ratio(VID, 'Skip Rate', 'skips_video', 'video_starts', 100),
    counter(VID, 'Companion Clicks (Video)', 'companionClicks'),
    counter(VID, 'Companion Views (Video)', 'companionViews'),
    ratio(VID, 'Companion Click Rate', 'companion_clicks_video', 'companion_views_video', 100),
    counter(VID, 'QR Scans', 'qrScans'),
    zeroMetric(VID, 'Video Continuous Play Starts'),
    zeroMetric(VID, 'Video Continuous Play First Quartile Views'),
    zeroMetric(VID, 'Video Continuous Play Midpoint Views'),
    zeroMetric(VID, 'Video Continuous Play Third Quartile Views'),
    zeroMetric(VID, 'Video Continuous Play Completions'),
    ...moneyRatio(VID, 'Total Media Cost eCPCV', 'total_media_cost', 'video_completions', 1),
    ...moneyRatio(VID, 'Total Media Cost per Video Start', 'total_media_cost', 'video_starts', 1),
    zeroMetric(VID, 'Video Pauses'),
    zeroMetric(VID, 'Video Mutes'),
    zeroMetric(VID, 'Video Full-Screens'),
  ];
}

const AUD = 'In-Stream Audio' as const;
export function inStreamAudioFields(): ReportFieldDef[] {
  return [
    counter(AUD, 'Audio Starts', 'videoStarts'),
    counter(AUD, 'Audio First Quartile Views', 'videoQ1'),
    counter(AUD, 'Audio Midpoint Views', 'videoMid'),
    counter(AUD, 'Audio Third Quartile Views', 'videoQ3'),
    counter(AUD, 'Audio Completions', 'videoCompletions'),
    ratio(AUD, 'Audio Completion Rate', 'audio_completions', 'audio_starts', 100),
    ...moneyRatio(AUD, 'Audio Media Cost eCPCL', 'media_cost', 'audio_completions', 1),
    zeroMetric(AUD, 'Audio Skips'),
  ];
}

const YT = 'YouTube' as const;
export function youtubeFields(): ReportFieldDef[] {
  const out: ReportFieldDef[] = [
    sliceDim(YT, 'Ad Group', 'adGroup', 'name'),
    sliceDim(YT, 'Ad Group ID', 'adGroup', 'id', 'ID'),
    sliceDim(YT, 'Ad', 'ad', 'name'),
    sliceDim(YT, 'Ad ID', 'ad', 'id', 'ID'),
    zeroDim(YT, 'Age (YouTube)'),
    zeroDim(YT, 'Gender (YouTube)'),
    zeroDim(YT, 'Audience Segment'),
    zeroDim(YT, 'Audience Segment Type'),
    zeroDim(YT, 'Asset'),
    zeroDim(YT, 'Asset Status'),
    zeroDim(YT, 'Asset Type'),
    zeroDim(YT, 'Asset (Upgraded)'),
    counter(YT, 'TrueView Views', 'videoViews'),
    ratio(YT, 'TrueView View Rate', 'trueview_views', 'impressions', 100),
    ...moneyRatio(YT, 'TrueView Average CPV', 'total_media_cost', 'trueview_views', 1),
    counter(YT, 'Impressions (Co-Viewed)', 'coViewedImpressions'),
    counter(YT, 'Ad Sequence Impressions', 'adSequenceImpressions'),
    {
      ...ratio(YT, 'Average Watch Time per Impression', 'impressions', 'impressions', 1),
      source: { t: 'RATIO', num: 'watch_seconds_total', den: 'impressions', scale: 1 },
    },
    counter(YT, 'Watch Seconds Total', 'watchSecondsTotal'),
    zeroMetric(YT, 'Average Impression Frequency per User', 'DECIMAL'),
    zeroMetric(YT, 'Average Impression Frequency per User (7 days)', 'DECIMAL'),
  ];
  const zeros = [
    'Absolute Brand Lift',
    'Baseline Positive Response Rate',
    'Exposed Positive Response Rate',
    'Relative Brand Lift',
    'Lifted Users',
    'Survey Responses',
    'Earned Views',
    'Earned Subscribers',
    'Earned Likes',
    'Earned Shares',
    'Earned Playlist Additions',
    'Subscribers',
    'Likes',
    'Shares',
    'Playlist Additions',
    'Card Impressions',
    'Card Clicks',
    'End Screen Impressions',
    'End Screen Clicks',
    'Companion Banner Impressions',
    'Companion Banner Clicks',
    'Views (Skippable)',
    'Views (Non-Skippable)',
    'Bumper Impressions',
    'Non-Skippable Impressions',
    'Views (Co-Viewed)',
    'Active View Views',
    'View Rate (Co-Viewed)',
    'Average Percentage Viewed',
    'Average Time Watched',
    'Audience Retention at 25%',
    'Audience Retention at 50%',
    'Engagements (YouTube)',
    'Engagement Rate (YouTube)',
  ];
  for (const z of zeros) out.push(zeroMetric(YT, z));
  out.push(...moneyZero(YT, 'Cost per Lifted User'));
  return out;
}

const BC = 'Brand Controls' as const;
export function brandControlFields(): ReportFieldDef[] {
  return [
    derivedDim(BC, 'Domain', 'exchange', 'domain'),
    derivedDim(BC, 'Digital Content Label', 'exchange', 'digitalContentLabel'),
    derivedDim(BC, 'Sensitive Category', 'exchange', 'sensitiveCategory'),
    derivedDim(BC, 'Subdomain', 'exchange', 'subdomain'),
    counter(BC, 'Verifiable Impressions', 'measurableImpressions'),
    zeroDim(BC, 'Audibility At Start'),
    zeroDim(BC, 'Audibility At Complete'),
    zeroDim(BC, 'Verification Video Player Size'),
    zeroDim(BC, 'Verification Video Player Position'),
    zeroDim(BC, 'Video Player Size at Start'),
    zeroDim(BC, 'Video Player Size at First Quartile'),
    zeroDim(BC, 'Video Player Size at Midpoint'),
    zeroDim(BC, 'Video Player Size at Third Quartile'),
    zeroDim(BC, 'Video Player Size at Completion'),
    zeroDim(BC, 'Video Resized'),
  ];
}

const AU = 'Audience' as const;
export function audienceFields(): ReportFieldDef[] {
  const out: ReportFieldDef[] = [
    zeroDim(AU, 'Age (Targeted)'),
    zeroDim(AU, 'Gender (Targeted)'),
    sliceDim(AU, 'Audience List', 'audience', 'name'),
    sliceDim(AU, 'Audience List ID', 'audience', 'id', 'ID'),
    sliceDim(AU, 'Audience List Type', 'audience', 'type'),
    ...moneyCounter(AU, 'Audience List Cost', 'dataCost'),
  ];
  for (const who of ['First Party', 'Third Party']) {
    out.push(
      zeroDim(AU, `${who} Audience List`),
      zeroDim(AU, `${who} Audience List ID`),
      zeroDim(AU, `${who} Audience List Type`),
      ...moneyZero(AU, `${who} Audience List Cost`),
    );
  }
  out.push(
    zeroDim(AU, 'Attributed Userlist'),
    zeroDim(AU, 'Attributed Userlist ID'),
    zeroDim(AU, 'Attributed Userlist Type'),
    ...moneyZero(AU, 'Attributed Userlist Cost'),
    zeroDim(AU, 'Commerce Partner'),
    zeroDim(AU, 'Is Commerce'),
    zeroMetric(AU, 'Match Ratio', 'PERCENT'),
    zeroMetric(AU, 'Potential Impressions'),
    zeroMetric(AU, 'Potential Viewable Impressions'),
    zeroMetric(AU, 'Eligible Cookies on First-Party Lists'),
    zeroMetric(AU, 'Eligible Cookies on Third-Party Lists'),
    zeroMetric(AU, 'Unique Cookies with Impressions'),
    sliceDim(AU, 'Targeted Audience List', 'audience', 'name'),
    sliceDim(AU, 'Targeted Audience List ID', 'audience', 'id', 'ID'),
    sliceDim(AU, 'Targeted Audience List Type', 'audience', 'type'),
    ...currencyTriplet(AU, 'Audience Cost eCPM', (_c, suffix) => ({
      t: 'RATIO',
      num: `audience_list_cost_${suffix}`,
      den: 'impressions',
      scale: 1000,
    })),
  );
  return out;
}
