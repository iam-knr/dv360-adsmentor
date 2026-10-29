// Option lists of the editors, verbatim from docs/explore/07-targeting.md (module 10 2.3). Codes are stable keys
// stored as the TargetingOption `code`; labels are what the editors show.

export interface OptionDef {
  code: string;
  label: string;
}

const slug = (label: string) =>
  label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const list = (labels: readonly string[]): OptionDef[] =>
  labels.map((label) => ({ code: slug(label), label }));

export const ENVIRONMENTS: OptionDef[] = [
  { code: 'WEB', label: 'Web' },
  { code: 'APP', label: 'App' },
];
export const ENVIRONMENT_HINT: Record<string, string> = {
  WEB: 'Inventory displayed in browsers',
  APP: 'Inventory displayed in apps',
};

export const POSITION_ON_SCREEN = list(['Above the fold', 'Below the fold', 'Unknown']);
export const POSITION_IN_CONTENT = list([
  'In-article',
  'In-feed',
  'Interstitial',
  'In-banner',
  'Unknown',
]);
export const POSITION_NATIVE = list([
  'In-article',
  'In-feed',
  'Peripheral',
  'Recommendation',
  'Unknown',
]);
/** Video and CTV line items: "Position in content — In-stream" (explore 05, 19). */
export const POSITION_VIDEO = list(['In-stream']);

/** Predicted viewability steps; null = "All impressions (greatest reach)" (default). */
export const VIEWABILITY_STEPS = [90, 80, 70, 60, 50, 40, 30, 20, 10] as const;
export function viewabilityLabel(pct: number | null): string {
  if (pct === null) return 'All impressions (greatest reach)';
  return pct === 90 ? '90% or greater (most viewable)' : `${pct}% or greater`;
}
export const OPEN_MEASUREMENT_TEXT =
  'Target only Open Measurement enabled mobile display inventory.';

export const LANGUAGES = list([
  'Arabic',
  'Bengali',
  'Bulgarian',
  'Catalan',
  'Chinese (simplified)',
  'Chinese (traditional)',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'English',
  'Estonian',
  'Filipino',
  'Finnish',
  'French',
  'German',
  'Greek',
  'Gujarati',
  'Hebrew',
  'Hindi',
  'Hungarian',
  'Icelandic',
  'Indonesian',
  'Italian',
  'Japanese',
  'Kannada',
  'Korean',
  'Latvian',
  'Lithuanian',
  'Malay',
  'Malayalam',
  'Marathi',
  'Norwegian',
  'Persian',
  'Polish',
  'Portuguese',
  'Punjabi',
  'Romanian',
  'Russian',
  'Serbian',
  'Slovak',
  'Slovenian',
  'Spanish',
  'Swedish',
  'Tamil',
  'Telugu',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Urdu',
  'Vietnamese',
]);

/** The browser list as shown in explore 07 ("Safari 1…n, …" are not expanded: no invented versions). */
export const BROWSERS = list([
  'Android Browser',
  'Firefox',
  'Google Chrome',
  'Microsoft Edge',
  'Microsoft Internet Explorer 5-11 / Other',
  'Mozilla',
  'Netscape Navigator',
  'Opera',
  'Opera Next',
  'Other',
  'Safari',
]);

export const CATEGORIES_TOP = list([
  'Arts & Entertainment',
  'Autos & Vehicles',
  'Beauty & Fitness',
  'Books & Literature',
  'Business & Industrial',
  'Computers & Electronics',
  'Finance',
  'Food & Drink',
  'Games',
  'Health',
  'Hobbies & Leisure',
  'Home & Garden',
  'Internet & Telecom',
  'Jobs & Education',
  'Law & Government',
  'News',
  'Online Communities',
  'People & Society',
  'Pets & Animals',
  'Real Estate',
  'Reference',
  'Science',
  'Shopping',
  'Sports',
  'Travel & Transportation',
  'World Localities',
]);

export const DEVICE_TYPES: OptionDef[] = [
  { code: 'COMPUTER', label: 'Computer' },
  { code: 'SMARTPHONE', label: 'Smartphone' },
  { code: 'TABLET', label: 'Tablet' },
  { code: 'CONNECTED_TV', label: 'Connected TV' },
];

export const CONNECTION_SPEEDS: OptionDef[] = [
  ...list([
    'Unknown connection speed',
    'Dialup (56kbps and slower)',
    'Broadband/4G (2mbps and faster)',
    'EDGE/2G (57kbps and faster)',
    'UMTS/3G (384kbps and faster)',
    'Basic DSL (768kbps and faster)',
    'HSDPA/3.5G (1.8mbps and faster)',
  ]),
  { code: 'ALL', label: 'All connection speeds' },
];

/** The two example rows of explore 07; the rest of the Carrier & ISP catalogue is synthetic seed data. */
export const CARRIER_ISP_EXAMPLES = [
  { code: '3_AUSTRALIA', label: '3 - Australia', type: 'Carrier' },
  { code: '2KOM', label: '2KOM', type: 'ISP' },
] as const;

export const GENDERS = list(['Male', 'Female', 'Unknown']);
/** Age slider stops; 65 as the upper bound is shown as "65+". */
export const AGE_STOPS = [18, 25, 35, 45, 55, 65] as const;
export const PARENTAL_STATUSES = list(['Parent', 'Not a parent', 'Unknown']);
export const HOUSEHOLD_INCOMES = list([
  'Top 10%',
  'Top 11-20%',
  'Top 21-30%',
  'Top 31-40%',
  'Top 41-50%',
  'Lower 50%',
  'Unknown',
]);

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const DAY_LABEL: Record<(typeof DAYS)[number], string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};
export const DAY_PRESETS = [
  { id: 'CUSTOM', label: 'Custom' },
  { id: 'ALL_DAYS', label: 'All days' },
  { id: 'WEEKDAYS', label: 'Mondays-Fridays' },
  { id: 'WEEKENDS', label: 'Saturdays-Sundays' },
] as const;
export const TIME_ZONES = [
  { id: 'LOCAL', label: 'Local' },
  { id: 'ADVERTISER', label: 'Advertiser' },
] as const;

export const VIDEO_PLAYER_SIZES = list(['Small', 'Medium', 'Large', 'HD', 'Unknown']);

/** Label of a fixed-list code, or the code itself when the list does not know it. */
export function labelOf(options: readonly OptionDef[], code: string): string {
  return options.find((o) => o.code === code)?.label ?? code;
}
