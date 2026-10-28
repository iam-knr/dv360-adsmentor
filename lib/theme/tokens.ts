/**
 * Design tokens (design-system.md 1.1 to 1.7). The only file that may contain raw hex values.
 * Values are the spec's starting values, not measured ones (design-system Q1).
 */

export const colors = {
  primary: { main: '#1a73e8', dark: '#1557b0', light: '#e8f0fe', contrastText: '#ffffff' },
  link: '#1967d2',
  nav: { activeBg: '#e8f0fe', activeText: '#0b57d0', hoverBg: '#f1f3f4', newDot: '#1a73e8' },
  status: {
    active: '#1e8e3e',
    warning: '#f29900',
    atRisk: '#e37400',
    error: '#d93025',
    paused: '#5f6368',
    draft: '#80868b',
    info: '#1a73e8',
  },
  statusText: {
    active: '#188038',
    warning: '#b06000',
    error: '#c5221f',
    paused: '#5f6368',
    info: '#1967d2',
  },
  banner: {
    info: { bg: '#e8f0fe', fg: '#174ea6', icon: '#1a73e8' },
    warning: { bg: '#fef7e0', fg: '#3c4043', icon: '#f29900' },
    error: { bg: '#fce8e6', fg: '#a50e0e', icon: '#d93025' },
    success: { bg: '#e6f4ea', fg: '#0d652d', icon: '#1e8e3e' },
  },
  background: { default: '#f8f9fa', paper: '#ffffff' },
  surface: {
    sunken: '#f1f3f4',
    selected: '#e8f0fe',
    scrim: 'rgba(32,33,36,0.32)',
    skeleton: '#e8eaed',
  },
  divider: '#dadce0',
  dividerStrong: '#bdc1c6',
  text: { primary: '#202124', secondary: '#5f6368', disabled: '#9aa0a6', inverse: '#ffffff' },
  toast: { bg: '#323232', action: '#8ab4f8' },
  tooltipBg: '#3c4043',
  hoverOverlay: 'rgba(60,64,67,.08)',
  outlinedHoverBg: '#f6fafe',
  progressTrack: '#d2e3fc',
  chart: ['#1a73e8', '#188038', '#f29900', '#d93025', '#9334e6', '#12b5cb', '#5f6368'],
  chartRamp: [
    '#d2e3fc',
    '#aecbfa',
    '#8ab4f8',
    '#669df6',
    '#4285f4',
    '#1a73e8',
    '#1967d2',
    '#185abc',
  ],
} as const;

export const fonts = {
  display: '"Figtree Variable", "Figtree", "Roboto", "Helvetica Neue", Arial, sans-serif',
  text: '"Roboto", "Helvetica Neue", Arial, sans-serif',
  mono: '"Roboto Mono", ui-monospace, Menlo, Consolas, monospace',
} as const;

/** Base unit is 4 px (theme.spacing = 4). */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

export const sizes = {
  appBarHeight: 56,
  navWidth: 256,
  navRailWidth: 72,
  railWidth: 48,
  panelWidth: 360,
  advisorPanelWidth: 400,
  footerHeight: 64,
  rowHeight: 40,
  groupHeaderHeight: 32,
  columnHeaderHeight: 40,
  pagerHeight: 48,
  inputHeight: 40,
  inputHeightSmall: 32,
  buttonHeight: 36,
  buttonHeightSmall: 28,
  chipHeight: 28,
  statusChipHeight: 24,
  navItemHeight: 40,
  navChildHeight: 36,
  selectColumn: 48,
  alertColumn: 40,
  statusColumn: 48,
  slideOver: { default: 480, wide: 640, xwide: 960 },
  dialog: { sm: 400, md: 560, lg: 720 },
  chartCard: { width: 296, height: 216 },
  iconDense: 20,
  iconBar: 24,
  iconHelp: 18,
} as const;

export const radii = {
  input: 4,
  button: 4,
  card: 8,
  chip: 16,
  pill: 20,
  dialog: 8,
  slideOver: 0,
  tooltip: 4,
} as const;

export const shadows = [
  'none',
  '0 1px 2px rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)',
  '0 1px 2px rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)',
  '0 1px 3px rgba(60,64,67,.30), 0 4px 8px 3px rgba(60,64,67,.15)',
  '0 2px 3px rgba(60,64,67,.30), 0 6px 10px 4px rgba(60,64,67,.15)',
] as const;

/** Level 1 mirrored upwards: the sticky form footer casts its shadow onto the content above it. */
export const footerShadow = '0 -1px 2px rgba(60,64,67,.30), 0 -1px 3px 1px rgba(60,64,67,.15)';

export const breakpoints = { xs: 0, sm: 768, md: 1024, lg: 1280, xl: 1680 } as const;

export const zLayers = {
  gridStickyColumn: 2,
  gridStickyHeader: 3,
  gridCorner: 4,
  stickyFooter: 10,
  bulkBar: 20,
  nav: 1100,
  appBar: 1200,
  rightPanel: 1250,
  slideOver: 1300,
  modal: 1400,
  searchOverlay: 1400,
  popover: 1500,
  toast: 1600,
  tooltip: 1700,
} as const;

export const motion = {
  hover: 100,
  slide: 200,
  menu: 150,
  nav: 250,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;
