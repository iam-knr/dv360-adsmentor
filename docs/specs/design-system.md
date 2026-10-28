# Design system: DV360 Simulator by Adsmetor

Task P2-03. Status: draft 1 (2026-10-28). Owner: Kailas Nath R (Adsmetor).
Inputs: `PROJECT.md` (R1, R2, §7.1), `docs/PROJECT-LOG.md`, `docs/explore/01` to `18`.
Used by: P3-03 (app shell), P3-04 (shared components), every module spec in P2-06, SOP-3 fidelity reviews.

## 0. How to read this file

- Section 1 is the single source of truth for tokens. Section 1.8 holds the ready-to-paste MUI theme.
- Section 2 specs every shared component: anatomy, states, props, and the explore file that shows it.
- Section 3 maps every icon seen in the explore files to a Material Symbols name.
- Sections 4 to 7 cover layout, accessibility, the fidelity checklist and branding.
- Section 8 lists open questions.

Important caveat. The repo has no screenshots yet (`docs/screenshots/` is empty), so the explore files describe layout and behaviour in words only. Every hex value, pixel size and radius below comes from the public Google Material palette and from what the explore notes say ("filled blue pill", "grey circle", "blue bar"). Treat them as the best starting values, not measured values. Task SOP-3 step 1 (first fidelity review of the app shell) must sample real colours and sizes from the demo account and update the token table. Rows that are most likely to need a change are marked **verify**.

---

## 1. Design tokens

### 1.1 Colour palette

Naming: tokens are role based, not value based. Components never use a raw hex.

**Brand and action**

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `primary.main` | `#1a73e8` | Primary buttons, focus ring, selected tab indicator, links on tinted surfaces, bulk Action bar, date-range selected day | white on it 4.51:1 (AA for 14px medium text and above) |
| `primary.dark` | `#1557b0` | Primary button hover and pressed | white on it 6.95:1 |
| `primary.light` | `#e8f0fe` | Selected row, hover on outlined primary, info banner background | |
| `primary.contrastText` | `#ffffff` | | |
| `link` | `#1967d2` | Text links on white and grey surfaces | on white 5.6:1 |
| `nav.activeBg` | `#e8f0fe` | Active left-nav pill fill (**verify**: may be a stronger blue) | |
| `nav.activeText` | `#0b57d0` | Active left-nav label and icon | on `#e8f0fe` 5.57:1 |
| `nav.hoverBg` | `#f1f3f4` | Nav item hover | |
| `nav.newDot` | `#1a73e8` | The small blue "new" dot beside a nav label | |

**Status colours** (always paired with an icon shape or text; never colour alone)

| Token | Hex (fill / icon) | Text-safe hex | Meaning | Where |
|---|---|---|---|---|
| `status.active` | `#1e8e3e` | `#188038` (5.02:1) | Active, Servable, Approved, Completed, Likely to spend | status dot, review chips, Bulk status "Completed" |
| `status.warning` | `#f29900` | `#b06000` (4.65:1) | Needs attention, At risk, Pending, amber banner | alert rows, "Pending" exchange status, KPI warning |
| `status.atRisk` | `#e37400` | `#b06000` | Budget at risk (donut segment) | Advertisers summary card |
| `status.error` | `#d93025` | `#c5221f` (5.8:1) | Critical, Failed, Disapproved, Underpacing, validation error | alert bell, error text, red border |
| `status.paused` | `#5f6368` | `#5f6368` | Paused, Archived, inactive | pause icon in status column |
| `status.draft` | `#80868b` | `#5f6368` | Draft (hollow circle), scheduled, unknown | status column |
| `status.info` | `#1a73e8` | `#1967d2` | Info, Spend segment, Pacing segment | info banner, donut |

**Banner and surface tints**

| Token | Hex | Use |
|---|---|---|
| `banner.info.bg` / `.fg` / `.icon` | `#e8f0fe` / `#174ea6` / `#1a73e8` | Advertiser-paused banner, inventory/targeting notice, "Recently added audiences..." |
| `banner.warning.bg` / `.fg` / `.icon` | `#fef7e0` / `#3c4043` / `#f29900` | Amber warnings (KPI not recommended, ad group has no ads, EU consent notice) |
| `banner.error.bg` / `.fg` / `.icon` | `#fce8e6` / `#a50e0e` / `#d93025` | Failed jobs, blocking errors |
| `banner.success.bg` / `.fg` / `.icon` | `#e6f4ea` / `#0d652d` / `#1e8e3e` | Empty-state "no rejected creatives", success notices |

**Surfaces, lines and text**

| Token | Hex | Use |
|---|---|---|
| `background.default` | `#f8f9fa` | Page canvas behind cards (**verify**: could be `#f1f3f4`) |
| `background.paper` | `#ffffff` | Cards, app bar, nav, dialogs, grid body |
| `surface.sunken` | `#f1f3f4` | Grid header row, row hover, empty-state circle, disabled input fill |
| `surface.selected` | `#e8f0fe` | Selected grid row |
| `surface.scrim` | `rgba(32,33,36,0.32)` | Behind slide-overs and modals |
| `divider` | `#dadce0` | 1px borders of cards, inputs, grid lines, app bar bottom, sticky footer top |
| `divider.strong` | `#bdc1c6` | Input hover border, table group separators |
| `text.primary` | `#202124` | Body text, titles (16.1:1) |
| `text.secondary` | `#5f6368` | Labels, helper text, IDs under names, column headers (6.05:1) |
| `text.disabled` | `#9aa0a6` | Disabled text. Decorative only, fails AA by design |
| `text.inverse` | `#ffffff` | Text on blue bar and dark toast |
| `toast.bg` | `#323232` | Neutral toast |
| `toast.action` | `#8ab4f8` | Action text on the dark toast |
| `tooltip.bg` | `#3c4043` | Tooltip |

**Chart palette** (series order; all checked against white, labelled directly so colour is never the only cue)

`#1a73e8` blue, `#188038` green, `#f29900` orange, `#d93025` red, `#9334e6` purple, `#12b5cb` teal, `#5f6368` grey. Sequential blue ramp for heat/bars: `#d2e3fc`, `#aecbfa`, `#8ab4f8`, `#669df6`, `#4285f4`, `#1a73e8`, `#1967d2`, `#185abc`.

Fixed meanings in charts: Likely to spend = green, At risk = orange, Spend = blue (Advertisers summary); Pacing = blue, Underpacing = red; Enabled = blue, Disabled = grey (Brand controls bars); selected day in date picker = blue circle.

### 1.2 Typography

Google Sans is licensed for Google products and is not allowed here (R2). Plan:

| Role | Family stack | Why |
|---|---|---|
| Display and titles (page title, card title, dialog title, app name) | `"Figtree", "Roboto", "Helvetica Neue", Arial, sans-serif` | Figtree is open (OFL), geometric like Google Sans, and is already part of the Adsmetor brand set. **verify** against DV360 headings; fall back to Roboto if the shapes look too far apart |
| Body, tables, forms, buttons | `"Roboto", "Helvetica Neue", Arial, sans-serif` | Open (Apache 2.0), close to the text face DV360 uses |
| Numbers in grids | same as body with `font-variant-numeric: tabular-nums` | Columns of currency must align |

Load both with `next/font/google` (self-hosted at build, no runtime call to Google). Weights: Roboto 400, 500, 700; Figtree 400, 500, 600.

| Variant (theme key) | Size / line | Weight | Colour | Use |
|---|---|---|---|---|
| `pageTitle` | 22 / 28 | 400 (Figtree) | text.primary | "Campaigns", "Plans", "Advertisers", full-screen form header |
| `cardTitle` | 16 / 24 | 500 (Figtree) | text.primary | Card headings ("Pacing", "Basic details", "Frequency cap") |
| `h6` dialog title | 20 / 28 | 400 (Figtree) | text.primary | "Unsaved Changes", "Select campaign" |
| `subtitle1` | 14 / 20 | 500 | text.primary | Section label inside a card, panel header |
| `body1` | 14 / 20 | 400 | text.primary | Default text, form values, menu items |
| `body2` | 13 / 20 | 400 | text.secondary | Helper text beside fields, side notes |
| `tableCell` | 13 / 20 | 400 | text.primary | Grid cells |
| `tableHeader` | 12 / 16 | 500 | text.secondary | Grid column and group headers |
| `caption` | 12 / 16 | 400 | text.secondary | Field counter "0 / 240", error text, IDs, footnotes |
| `panelOverline` | 11 / 16, letter-spacing 0.8px, uppercase | 500 | text.secondary | "ADVERTISER HEALTH", "OPTIMIZATION SUGGESTIONS", "CAMPAIGN HEALTH" |
| `kpiValue` | 28 / 36 | 400 (Figtree) | text.primary | Chart-card value, Overview KPI tiles, forecast KPI strip |
| `kpiValueSmall` | 20 / 28 | 400 (Figtree) | text.primary | Summary strip on creative page, KPI tiles in dense cards |
| `button` | 14 / 20, letter-spacing 0.25px, no uppercase | 500 | inherits | All buttons, tabs, chips-as-buttons |
| `badge` | 10 / 14, uppercase, letter-spacing 0.5px | 500 | | BETA, NEW, ALPHA, ONLY IN GWD style tags |
| `mono` | 12 / 16 `"Roboto Mono"` | 400 | | Tag snippets, SDF column names, integration code textareas |

Rules: sentence case everywhere (DV360 does not title-case). Only `panelOverline`, `badge` and the Offline report buttons (SAVE AND RUN) are uppercase. Truncate with ellipsis and show the full text in a tooltip for crumbs and names; names in grids wrap to two lines before truncating.

### 1.3 Spacing, density and sizes

Base unit 4 px. Set `theme.spacing = 4` so `sx={{ p: 4 }}` equals 16 px. Document to every builder: `spacing(2)` is 8 px, `spacing(4)` is 16 px, `spacing(6)` is 24 px.

| Token | px | Use |
|---|---|---|
| `space.1` | 4 | Icon to text gap in dense chips |
| `space.2` | 8 | Between inline controls, chip gap, nav item vertical gap |
| `space.3` | 12 | Grid cell horizontal padding, input inner padding |
| `space.4` | 16 | Card padding in chart cards and panels, gap between cards |
| `space.6` | 24 | Page padding, form card padding, gap between form sections |
| `space.8` | 32 | Large section gap, empty-state internal padding |
| `space.12` | 48 | Empty-state vertical padding |

Component sizes (density is **compact by default**; one density, no toggle in v1):

| Item | Size |
|---|---|
| App bar height | 56 |
| Left nav width, expanded / collapsed rail | 256 / 72 (**verify**) |
| Nav item height | 40, pill radius 20, side margin 8 |
| Right rail icon strip width | 48 |
| Right panel width | 360 (Ask Advisor 400) |
| Grid group header row / column header row / body row (min) / total row | 32 / 40 / 40 / 40 |
| Grid checkbox column | 48. Alert column 40. Status column 48 |
| Outlined input / select height | 40 (small variant 32, used inside grids and filter popovers) |
| Button height | 36 (small 28, used in cards and chips) |
| Chip height | 28 (filter chips), 24 (status chips, tags) |
| Icon size | 20 in grids, nav and buttons; 24 in app bar and rail; 18 for help "?" icons |
| Sticky form footer height | 64 |
| Slide-over width | 480 default, 640 wide (audience picker, creative picker), 960 extra wide (geography with map, ad create with preview) |
| Chart card | 296 wide, 216 tall (min), gap 16 |
| Dialog width | 400 (confirm), 560 (form dialog), 720 (two-pane picker) |

### 1.4 Shape (radii)

| Token | px | Use |
|---|---|---|
| `shape.input` | 4 | Inputs, selects, buttons (**verify**: buttons may be fully rounded in the current DV360 skin; switch via `shape.button`) |
| `shape.button` | 4 | |
| `shape.card` | 8 | Cards, chart cards, banners, menus |
| `shape.chip` | 16 | Filter chips, status chips, tags |
| `shape.pill` | 20 | Active nav pill, date preset highlight |
| `shape.dialog` | 8 | Modals |
| `shape.slideOver` | 0 | Slide-over left edge is square |
| `shape.tooltip` | 4 | |

### 1.5 Elevation

DV360 is mostly flat: surfaces are separated by 1 px `divider` borders, shadows appear only on floating layers. Use these exact shadows (Google ambient + key pair):

| Level | Shadow | Use |
|---|---|---|
| 0 | none, 1 px `divider` border | Cards, grids, form sections, banners |
| 1 | `0 1px 2px rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)` | Chart card hover, sticky column edge when scrolled, sticky footer (upward) |
| 2 | `0 1px 2px rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)` | Menus, popovers (filter chip editor, date picker), search overlay |
| 3 | `0 1px 3px rgba(60,64,67,.30), 0 4px 8px 3px rgba(60,64,67,.15)` | Right panel, slide-over |
| 4 | `0 2px 3px rgba(60,64,67,.30), 0 6px 10px 4px rgba(60,64,67,.15)` | Modals, toasts |

In MUI terms: set the `shadows` array so index 0 is none, 1 to 4 are the values above, and indexes 5 to 24 repeat level 4.

### 1.6 Breakpoints

Desktop first. Design target is 1280 px and wider (PROJECT scope: classroom desktops).

| Name | Min width | Behaviour |
|---|---|---|
| `xs` | 0 | Unsupported. Show the "works best on a desktop screen" interstitial with a Continue anyway button |
| `sm` | 768 | Tablet portrait fallback (see 4.5) |
| `md` | 1024 | Tablet landscape fallback |
| `lg` | 1280 | **Design minimum.** Full layout |
| `xl` | 1680 | Wide. Content keeps 1680 px max for forms; grids expand |

Tests (Playwright) run at 1280×720, 1440×900 and 1920×1080 as the fidelity sizes, plus 1024×768 for the fallback.

### 1.7 z-index layers

| Layer | z-index | Notes |
|---|---|---|
| Grid sticky column | 2 | |
| Grid sticky header | 3 | Corner cell (sticky both ways) 4 |
| Page sticky footer (Create/Save bar) | 10 | |
| Bulk Action bar | 20 | Sits in the toolbar slot, above header |
| Left nav, right rail | 1100 | |
| App bar | 1200 | Above nav so the nav slides under it on small screens |
| Right panel (when overlaying) | 1250 | |
| Slide-over scrim and panel | 1300 | A slide-over opened from a slide-over gets +10 per level |
| Modal and search overlay | 1400 | Always above slide-overs |
| Menu, popover, select list | 1500 | Opened from any layer above must still show |
| Toast | 1600 | |
| Tooltip | 1700 | Top of everything |

### 1.8 MUI theme (ready to use)

File: `lib/theme/theme.ts`. Needs `@mui/material` v6 or later, `@mui/x-data-grid` only if the Data Grid is chosen (see 2.4 recommendation; the DataGrid block is optional).

```ts
// lib/theme/theme.ts
import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    status: Record<'active' | 'warning' | 'atRisk' | 'error' | 'paused' | 'draft' | 'info', string>;
    statusText: Record<'active' | 'warning' | 'error' | 'paused' | 'info', string>;
    nav: { activeBg: string; activeText: string; hoverBg: string; newDot: string };
    banner: Record<'info' | 'warning' | 'error' | 'success', { bg: string; fg: string; icon: string }>;
    surface: { sunken: string; selected: string; scrim: string };
    link: string;
    chart: string[];
  }
  interface PaletteOptions {
    status?: Partial<Palette['status']>;
    statusText?: Partial<Palette['statusText']>;
    nav?: Partial<Palette['nav']>;
    banner?: Partial<Palette['banner']>;
    surface?: Partial<Palette['surface']>;
    link?: string;
    chart?: string[];
  }
  interface TypographyVariants {
    pageTitle: React.CSSProperties;
    cardTitle: React.CSSProperties;
    panelOverline: React.CSSProperties;
    kpiValue: React.CSSProperties;
    kpiValueSmall: React.CSSProperties;
    tableCell: React.CSSProperties;
    tableHeader: React.CSSProperties;
    badge: React.CSSProperties;
    mono: React.CSSProperties;
  }
  interface TypographyVariantsOptions extends Partial<TypographyVariants> {}
  interface ZIndex {
    gridStickyColumn: number; gridStickyHeader: number; stickyFooter: number; bulkBar: number;
    nav: number; rightPanel: number; slideOver: number; searchOverlay: number; popover: number; toast: number;
  }
  interface Theme { custom: { appBarHeight: number; navWidth: number; navRailWidth: number; railWidth: number; panelWidth: number; footerHeight: number; rowHeight: number } }
  interface ThemeOptions { custom?: Partial<Theme['custom']> }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true; cardTitle: true; panelOverline: true; kpiValue: true; kpiValueSmall: true;
    tableCell: true; tableHeader: true; badge: true; mono: true;
  }
}

const display = 'var(--font-figtree), "Roboto", "Helvetica Neue", Arial, sans-serif';
const text = 'var(--font-roboto), "Roboto", "Helvetica Neue", Arial, sans-serif';
const mono = '"Roboto Mono", ui-monospace, Menlo, Consolas, monospace';

const line = '#dadce0';
const shadow = [
  'none',
  '0 1px 2px rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)',
  '0 1px 2px rgba(60,64,67,.30), 0 2px 6px 2px rgba(60,64,67,.15)',
  '0 1px 3px rgba(60,64,67,.30), 0 4px 8px 3px rgba(60,64,67,.15)',
  '0 2px 3px rgba(60,64,67,.30), 0 6px 10px 4px rgba(60,64,67,.15)',
];

export const theme = createTheme({
  spacing: 4,
  breakpoints: { values: { xs: 0, sm: 768, md: 1024, lg: 1280, xl: 1680 } },
  shape: { borderRadius: 4 },
  custom: { appBarHeight: 56, navWidth: 256, navRailWidth: 72, railWidth: 48, panelWidth: 360, footerHeight: 64, rowHeight: 40 },
  palette: {
    mode: 'light',
    primary: { main: '#1a73e8', dark: '#1557b0', light: '#e8f0fe', contrastText: '#ffffff' },
    secondary: { main: '#5f6368' },
    error: { main: '#d93025', dark: '#c5221f', light: '#fce8e6' },
    warning: { main: '#f29900', dark: '#b06000', light: '#fef7e0' },
    success: { main: '#1e8e3e', dark: '#188038', light: '#e6f4ea' },
    info: { main: '#1a73e8', dark: '#174ea6', light: '#e8f0fe' },
    text: { primary: '#202124', secondary: '#5f6368', disabled: '#9aa0a6' },
    divider: line,
    background: { default: '#f8f9fa', paper: '#ffffff' },
    action: { hover: '#f1f3f4', selected: '#e8f0fe', disabledBackground: '#f1f3f4', disabled: '#9aa0a6', focus: alpha('#1a73e8', 0.12) },
    status: { active: '#1e8e3e', warning: '#f29900', atRisk: '#e37400', error: '#d93025', paused: '#5f6368', draft: '#80868b', info: '#1a73e8' },
    statusText: { active: '#188038', warning: '#b06000', error: '#c5221f', paused: '#5f6368', info: '#1967d2' },
    nav: { activeBg: '#e8f0fe', activeText: '#0b57d0', hoverBg: '#f1f3f4', newDot: '#1a73e8' },
    banner: {
      info: { bg: '#e8f0fe', fg: '#174ea6', icon: '#1a73e8' },
      warning: { bg: '#fef7e0', fg: '#3c4043', icon: '#f29900' },
      error: { bg: '#fce8e6', fg: '#a50e0e', icon: '#d93025' },
      success: { bg: '#e6f4ea', fg: '#0d652d', icon: '#1e8e3e' },
    },
    surface: { sunken: '#f1f3f4', selected: '#e8f0fe', scrim: 'rgba(32,33,36,0.32)' },
    link: '#1967d2',
    chart: ['#1a73e8', '#188038', '#f29900', '#d93025', '#9334e6', '#12b5cb', '#5f6368'],
  },
  shadows: [...shadow, ...Array(20).fill(shadow[4])] as any,
  zIndex: {
    mobileStepper: 1000, fab: 1050, speedDial: 1050,
    gridStickyColumn: 2, gridStickyHeader: 3, stickyFooter: 10, bulkBar: 20,
    nav: 1100, rightPanel: 1250, appBar: 1200, drawer: 1300, slideOver: 1300,
    modal: 1400, searchOverlay: 1400, popover: 1500, snackbar: 1600, toast: 1600, tooltip: 1700,
  },
  typography: {
    fontFamily: text,
    fontSize: 14,
    h1: { fontFamily: display, fontSize: 28, lineHeight: '36px', fontWeight: 400 },
    h2: { fontFamily: display, fontSize: 24, lineHeight: '32px', fontWeight: 400 },
    h3: { fontFamily: display, fontSize: 22, lineHeight: '28px', fontWeight: 400 },
    h4: { fontFamily: display, fontSize: 20, lineHeight: '28px', fontWeight: 400 },
    h5: { fontFamily: display, fontSize: 18, lineHeight: '24px', fontWeight: 500 },
    h6: { fontFamily: display, fontSize: 16, lineHeight: '24px', fontWeight: 500 },
    subtitle1: { fontSize: 14, lineHeight: '20px', fontWeight: 500 },
    subtitle2: { fontSize: 13, lineHeight: '20px', fontWeight: 500 },
    body1: { fontSize: 14, lineHeight: '20px', fontWeight: 400 },
    body2: { fontSize: 13, lineHeight: '20px', fontWeight: 400, color: '#5f6368' },
    caption: { fontSize: 12, lineHeight: '16px', fontWeight: 400, color: '#5f6368' },
    button: { fontSize: 14, lineHeight: '20px', fontWeight: 500, letterSpacing: '0.25px', textTransform: 'none' },
    pageTitle: { fontFamily: display, fontSize: 22, lineHeight: '28px', fontWeight: 400 },
    cardTitle: { fontFamily: display, fontSize: 16, lineHeight: '24px', fontWeight: 500 },
    panelOverline: { fontSize: 11, lineHeight: '16px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#5f6368' },
    kpiValue: { fontFamily: display, fontSize: 28, lineHeight: '36px', fontWeight: 400, fontVariantNumeric: 'tabular-nums' },
    kpiValueSmall: { fontFamily: display, fontSize: 20, lineHeight: '28px', fontWeight: 400, fontVariantNumeric: 'tabular-nums' },
    tableCell: { fontSize: 13, lineHeight: '20px', fontWeight: 400, fontVariantNumeric: 'tabular-nums' },
    tableHeader: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: '#5f6368' },
    badge: { fontSize: 10, lineHeight: '14px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' },
    mono: { fontFamily: mono, fontSize: 12, lineHeight: '16px' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#f8f9fa', color: '#202124', WebkitFontSmoothing: 'antialiased', minWidth: 1024 },
        'a': { color: '#1967d2', textDecoration: 'none' },
        'a:hover': { textDecoration: 'underline' },
        ':focus-visible': { outline: '2px solid #1a73e8', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' } },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { height: 36, borderRadius: 4, padding: '0 16px' },
        sizeSmall: { height: 28, padding: '0 12px' },
        outlined: { borderColor: line, color: '#1a73e8', '&:hover': { borderColor: line, backgroundColor: '#f6fafe' } },
        text: { padding: '0 8px' },
        containedPrimary: { '&.Mui-disabled': { backgroundColor: '#e8eaed', color: '#9aa0a6' } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { color: '#5f6368', '&:hover': { backgroundColor: 'rgba(60,64,67,.08)' } } } },
    MuiOutlinedInput: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          height: 40, borderRadius: 4, backgroundColor: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: line },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#bdc1c6' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8', borderWidth: 2 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#d93025', borderWidth: 2 },
          '&.Mui-disabled': { backgroundColor: '#f1f3f4' },
        },
        multiline: { height: 'auto' },
        input: { padding: '0 12px', fontSize: 14 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14, color: '#5f6368' } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, marginTop: 4, fontSize: 12, lineHeight: '16px', '&.Mui-error': { color: '#c5221f' } } } },
    MuiChip: {
      styleOverrides: {
        root: { height: 28, borderRadius: 16, fontSize: 13, color: '#202124' },
        outlined: { borderColor: line, backgroundColor: '#ffffff' },
        sizeSmall: { height: 24 },
        deleteIcon: { fontSize: 16, color: '#5f6368' },
      },
    },
    MuiTabs: { styleOverrides: { root: { minHeight: 48, borderBottom: `1px solid ${line}` }, indicator: { height: 3, borderRadius: '3px 3px 0 0' } } },
    MuiTab: { styleOverrides: { root: { minHeight: 48, minWidth: 0, padding: '0 16px', color: '#5f6368', '&.Mui-selected': { color: '#1a73e8' } } } },
    MuiTooltip: {
      defaultProps: { enterDelay: 500, enterNextDelay: 200 },
      styleOverrides: { tooltip: { backgroundColor: '#3c4043', fontSize: 12, lineHeight: '16px', padding: '6px 8px', borderRadius: 4 } },
    },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 8, boxShadow: shadow[2], border: `1px solid ${line}` } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 40, fontSize: 14 } } },
    MuiPopover: { styleOverrides: { paper: { borderRadius: 8, boxShadow: shadow[2] } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 8, boxShadow: shadow[4] } } },
    MuiDialogTitle: { styleOverrides: { root: { fontFamily: display, fontSize: 20, lineHeight: '28px', fontWeight: 400, padding: '20px 24px 8px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px' } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: 'rgba(32,33,36,0.32)' } } },
    MuiDrawer: { styleOverrides: { paperAnchorRight: { boxShadow: shadow[3], borderRadius: 0 } } },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: `1px solid ${line}`, borderRadius: 8 } } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 40, borderRadius: 20, margin: '0 8px', padding: '0 16px',
          '&:hover': { backgroundColor: '#f1f3f4' },
          '&.Mui-selected': { backgroundColor: '#e8f0fe', color: '#0b57d0', '&:hover': { backgroundColor: '#e8f0fe' }, '& .MuiListItemIcon-root': { color: '#0b57d0' } },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 40, color: '#5f6368' } } },
    MuiCheckbox: { styleOverrides: { root: { padding: 8, color: '#5f6368' } } },
    MuiRadio: { styleOverrides: { root: { padding: 8, color: '#5f6368' } } },
    MuiSwitch: { styleOverrides: { root: { padding: 8 } } },
    MuiLinearProgress: { styleOverrides: { root: { height: 4, backgroundColor: '#d2e3fc' } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '8px 16px', fontSize: 14, alignItems: 'center' },
        standardInfo: { backgroundColor: '#e8f0fe', color: '#174ea6', '& .MuiAlert-icon': { color: '#1a73e8' } },
        standardWarning: { backgroundColor: '#fef7e0', color: '#3c4043', '& .MuiAlert-icon': { color: '#f29900' } },
        standardError: { backgroundColor: '#fce8e6', color: '#a50e0e', '& .MuiAlert-icon': { color: '#d93025' } },
        standardSuccess: { backgroundColor: '#e6f4ea', color: '#0d652d', '& .MuiAlert-icon': { color: '#1e8e3e' } },
      },
    },
    MuiSnackbarContent: { styleOverrides: { root: { backgroundColor: '#323232', color: '#ffffff', borderRadius: 4, boxShadow: shadow[4], fontSize: 14 } } },
    MuiSlider: { styleOverrides: { root: { height: 4 }, thumb: { width: 16, height: 16 } } },
    // Only if MUI X Data Grid is used (see 2.4). Needs: import type {} from '@mui/x-data-grid/themeAugmentation'
    MuiDataGrid: {
      defaultProps: { density: 'compact', disableColumnMenu: true, disableRowSelectionOnClick: true },
      styleOverrides: {
        root: { border: 'none', fontSize: 13, '--DataGrid-rowBorderColor': line },
        columnHeaders: { backgroundColor: '#f1f3f4' },
        columnHeaderTitle: { fontSize: 12, fontWeight: 500, color: '#5f6368' },
        row: { '&:hover': { backgroundColor: '#f1f3f4' }, '&.Mui-selected': { backgroundColor: '#e8f0fe' } },
        cell: { '&:focus, &:focus-within': { outline: 'none' }, '&:focus-visible': { outline: '2px solid #1a73e8', outlineOffset: -2 } },
      },
    },
  },
});
```

---

## 2. Component specs

Conventions for this section.
- Folder: `components/dv/<Name>/`. Prefix every shared component `Dv` (for example `DvAppBar`).
- All text labels are copied from the explore files exactly, including capitalisation ("Show rows", "Enter a value").
- Props are TypeScript. Only the props that matter for fidelity are listed; builders may add more.
- "States" lists every visual state that must exist before the component passes SOP-3.
- Colours and sizes refer to Section 1 tokens.

### 2.1 App bar and breadcrumbs (`DvAppBar`, `DvBreadcrumbs`)

Explore: `01-global-shell.md` (Top app bar), `02` (Reports app header), `05` and `04` (Overview › crumb row), `08` (creative page header).

Anatomy (left to right, 56 px high, white, 1 px bottom `divider`):
1. Hamburger `menu` (24 px, toggles nav rail/expanded).
2. Adsmetor logo (28 px high) + wordmark "DV360 Simulator by Adsmetor" (`h5`, text.primary). See Section 7.
3. Home `home` icon button (to Partner Overview).
4. Breadcrumbs, two lines per crumb: line 1 label in `caption` grey ("Partner", "Advertiser", "Campaign"), line 2 the entity name in `body1`. Separator `chevron_right` 16 px grey. Name truncates at 200 px with tooltip of the full name. Partner crumb always shown on partner and deeper pages; Advertiser crumb from advertiser pages; Campaign crumb on campaign pages. Crumbs are links where a destination exists (in the reference account the partner and advertiser crumbs were not switchers; simulator: click opens the Partner Advertisers list, see open question Q9).
5. Spacer.
6. Right icon group (each 40 px hit area, 24 px icon, tooltip): Search `search` (tooltip "Search (/)"), Notifications `notifications` (with 8 px red dot badge when unread), User management and email preferences `manage_accounts`, Bulk status `checklist`, Reports `bar_chart`, Keyboard shortcuts `keyboard`, Switch products `apps`, Avatar (32 px circle with initials, opens Adsmetor user menu: profile, role chip, sign out).

Search overlay: centred 640 px panel, z `searchOverlay`, scrim; input "Search the advertiser with phrases like 'paused line items'" (placeholder text is Adsmetor-written); below "Try searching this advertiser for:" and suggestion chips (the seven chips in 01); footnote "AI may make mistakes" becomes "Results come from the simulator's saved filters" (see Q12). Esc closes.

Notifications menu: 360 px card; item = type label + dot, age ("9 d"), title (`subtitle1`), body (`body2`), **Learn more** (link) and **Dismiss** (text button); close X.

States: default; icon hover (`rgba(60,64,67,.08)` circle); pressed; focus ring; badge present; breadcrumb hover underlines name; truncated tooltip; page with the paused banner below (see 2.12). Reports and Users pages replace items 1 to 4 with `arrow_back` + title (full-screen app header).

Props:
```ts
interface DvAppBarProps {
  crumbs: { level: 'Partner' | 'Advertiser' | 'Campaign'; name: string; href?: string }[];
  unreadNotifications: number;
  onToggleNav(): void;
  user: { name: string; initials: string; role: 'student' | 'instructor' | 'admin' };
  mode?: 'standard' | 'backHeader'; backHeaderTitle?: string; onBack?(): void;
}
```

### 2.2 Left navigation (`DvNav`)

Explore: `01` (Left navigation, both levels), `03` (campaign scope), `14` (two-line label "Data manager / (Linked accounts)").

Anatomy: vertical list under the app bar. Item = icon (20 px) + label (`subtitle1` weight 400, 14 px) + optional trailing caret. Group item has `expand_more` caret that rotates 180° when open; children indented 56 px, no icons, 36 px high. Dividers: 1 px `divider` with 8 px vertical margin (positions: Partner level after Advertisers and after Reports; Advertiser level after Reports). "New" blue dot: 8 px `nav.newDot` circle after the label (Floodlight group). Two-line labels allowed (Data manager).

Modes:
- **Expanded** (256 px): icon + label + caret.
- **Collapsed rail** (72 px): icon only, centred; tooltip on hover with the label; group items open a flyout menu to the right listing the children; the active child's group icon shows the active pill.
- Expand state of each group persists while navigating and across reloads (per user).

States: default; hover (`nav.hoverBg`); active (filled pill `nav.activeBg`, text and icon `nav.activeText`, weight 500); focus ring (inset 2 px); group open; group contains active child (icon tinted active colour but no pill when open; pill shows on the child); disabled (grey, tooltip explains, for example no access).

Contents by scope (keep order exactly as 01 and 03):
- Partner: Overview · Advertisers · divider · Reports ▸ (Instant & offline, Cross-media reach) · divider · Resources ▸ (Brand controls, Channels, Custom bidding, Floodlight groups ●) · Partner settings ▸ (Basic details, Targeting, Advertiser configurations).
- Advertiser: Campaigns · Audiences ▸ (All audiences, Analysis) · Creative ▸ (Creatives, Format gallery, Appeals history) · Inventory ▸ (Plans, My inventory, Marketplace, Negotiations) · Reports ▸ (Instant & offline, Cross-media reach) · divider · Experiments · Targeting templates · Resources ▸ (Brand controls, Channels & keywords, Floodlight group ●, YouTube assets, YouTube creator partnerships, Location lists, Custom bidding) · Advertiser settings ▸ (Basic details, Targeting rules, Data manager (Linked accounts), Alert preferences, Policy center) · History.
- Campaign: Campaign · Inventory ▸ (My inventory, Marketplace, Negotiations) · Campaign settings · Alerts (NEW badge) · History.
- IO and line item pages have no left nav (full-width content).

Props:
```ts
interface NavItem { id: string; label: string; secondLine?: string; icon?: string; href?: string; children?: NavItem[]; dividerAfter?: boolean; newDot?: boolean; badge?: 'NEW' }
interface DvNavProps { items: NavItem[]; mode: 'expanded' | 'rail'; activeId: string; openGroupIds: string[]; onToggleGroup(id: string): void }
```

### 2.3 Right rail and panels (`DvRightRail`, `DvPanel`)

Explore: `01` (Right rail), `15` (Intelligence panel), `03` and `04` (campaign/IO variants), `16`.

Anatomy: 48 px vertical strip on the right edge (white, 1 px left `divider`), icons stacked from the top with 8 px gap: Ask Advisor `auto_awesome`, Quick help `help`, Intelligence `hub` (advertiser pages only), and at the bottom a panel toggle `right_panel_close` / `right_panel_open`. Selected icon has a `primary.light` 36 px circle and primary colour. A panel (360 px, Ask Advisor 400) sits left of the strip, shadow level 3 when overlaying, level 0 with border when pushing content (1280 px and wider).

Panel frame: header 56 px with title (`cardTitle`), optional BETA badge, header icons (history `history`, new chat `add_comment`, overflow `more_vert`), close `close`. Body scrolls. Opening one replaces the current; clicking the active icon closes it. Intelligence is open by default on the Campaigns page.

Panels:
- **Ask Advisor** (Adsmetor tutor): disclaimer text, "Resume most recent chat" link, greeting "Hi {user}", "What can I help you with today?", thumbs up/down, three suggestion chips, message box (multiline, `send` button, disabled when empty). Messages: user bubble right (`primary.light`), tutor bubble left (white, 1 px border). Typing indicator = three dots.
- **Quick help** (BETA): sections "Most relevant" (video card with 16:9 thumbnail and `play_circle` overlay), "Related to current page" (article links, `article` icon), "Search Help" input, "Need help? Ask Advisor" card, feedback thumbs. Content is Adsmetor-written (R1, PROJECT §5.12).
- **Intelligence** (title "Intelligence" + scope name, header band `primary.main` with white text): sections `panelOverline` "ADVERTISER HEALTH" or "CAMPAIGN HEALTH" and "OPTIMIZATION SUGGESTIONS". Alert row = severity icon (`error` red, `warning` amber) + text (`body1`, max 3 lines) + **Investigate** outlined small button + history `history` icon button. Suggestion row = `lightbulb` icon + text + Investigate. "+N more" link expands. Empty text: "No alerts" / "There are no recommendations at this time". Campaign scope adds the "Check the Alerts tab for these alerts" list and **Go to Alerts**.

States: collapsed; open; loading (skeleton rows); empty; error ("Couldn't load. Retry").

```ts
interface DvRightRailProps { available: ('advisor' | 'help' | 'intelligence' | 'exercise')[]; open?: 'advisor' | 'help' | 'intelligence' | 'exercise' | null; onChange(p: DvRightRailProps['open']): void }
interface HealthRow { id: string; severity: 'error' | 'warning' | 'suggestion'; text: string; onInvestigate(): void; onHistory?(): void }
```

> Resolved RC-051: `'exercise'` is the fourth rail panel (RT 4.6, module 18). It is available only while a scenario attempt is active.

### 2.4 Data grid (`DvGrid`)

Explore: `02` (Advertisers list), `03` (Campaigns, IO grids), `04`, `05`, `06`, `09` (orders → deals tree, sections), `10`, `11`, `13` (plans, Modify columns), `15`, `16`, `17`.

**Build decision (recommendation).** Build `DvGrid` on **TanStack Table v8 + TanStack Virtual** with our own cells. MUI X Data Grid community has column grouping but column pinning and row grouping/trees are Pro features (paid). The grid needs sticky columns, collapsible column groups, tree rows (orders → deals), section rows ("Action required"), inline-editable budget rows and a totals row. If the team prefers MUI X Data Grid anyway, the theme block in 1.8 already styles it; sticky columns then need a Pro licence (Q5).

Anatomy, top to bottom:
1. **Toolbar slot** (above grid, see page patterns 4.2): primary button, column-view dropdown, date button, Segment by, download, fullscreen, ⋮, filter toggle. When rows are selected the toolbar is replaced by the **Bulk Action bar** (2.5).
2. **Filter bar** (2.6).
3. **Header row 1: group headers** (32 px, `tableHeader`, bottom 1 px `divider.strong`). A group spans its columns; label left aligned; collapsible groups show `chevron_left chevron_right` (shown as ‹›) at the right end. Click collapses the group to a 40 px stub showing the group label vertically and the metric count; click again expands. Group state persists per saved column view.
4. **Header row 2: column headers** (40 px, `surface.sunken`). Title `tableHeader`; numeric columns right-aligned; sort arrow (`arrow_upward` 16 px) appears on hover and stays on the sorted column; help dotted underline when a tooltip exists. Click toggles asc → desc → none.
5. **Body rows** (min 40 px, auto height when the Name wraps to 2 lines; cell padding 8 px 12 px; bottom 1 px `divider`).
6. **Total row** (sticky bottom of scroll area, weight 500, label "Total: Display" in the Name column).
7. **Pager** (48 px, right aligned): "Show rows:" select (10, 20, 50, 100; default 20, Users page 100, Appeal history "Items per page: 50", Creative History 25), "1 - 20 of N", `first_page` `chevron_left` `chevron_right` `last_page`.

Fixed leading columns (in order, when present):
| Col | Width | Content |
|---|---|---|
| Select | 48 | Checkbox. Header checkbox = select all rows on page (aria-label "Select all rows"), indeterminate when partial |
| Alert | 40 | `notifications` bell outlined grey in header (tooltip "Alerts"); cell shows red `error` (critical) or amber `warning` icon, empty otherwise; click opens the entity alerts |
| Status | 48 | Status dot (see 2.9). On row hover a `arrow_drop_down` appears right of the dot, opening inline menu **Activate / Pause** (disabled item for the current state) |
| Trend | 40 | Optional sparkline icon `show_chart` (IO lists) |
| Name | 240 to 360 | Sticky. Entity-type icon (IO, LI) + link (`link` colour) wrapping to 2 lines + ID in `caption` grey on the second line (campaign grid) or separate ID column |

Sticky columns: Select, Alert, Status and Name stay pinned left while scrolling horizontally (z `gridStickyColumn`), with a level 1 right-edge shadow once scrolled. Header rows are sticky top (z `gridStickyHeader`). The Select column and header corner are pinned both ways.

Cell formats: currency with advertiser symbol and 2 decimals ("₹12,000.00"); compact currency in cards ("₹450K"); percentages with `%`; counts with thousands separators; goal strings as in source ("0.15% CTR", "₹50.00 CPM"); empty metric "-" (hyphen, grey); "Unknown" text for unknown budget. Numbers right-aligned with tabular figures. Currency per row can differ (SGD in an INR partner).

Row states:
- default
- hover: `surface.sunken` background; inline icons appear in the right-most visible cell area: `info` (details), `edit`; Budget cell shows `edit` for inline budget edit; Status dot shows ▾
- selected: `surface.selected`
- focus (keyboard): 2 px inset ring on the focused cell
- loading: 8 skeleton rows
- empty: `DvEmptyState` under the headers ("No results." or section specific)
- error: banner above grid
- archived (read-only, grey text)
- expanded tree row: order row with `chevron_right`/`expand_more` at left, child rows indented 24 px and with a left guide line
- section rows: "Action required" and "Everything else" are 32 px sub-header rows (`subtitle1`, `surface.sunken`)

Inline edit (budget segments table in new campaign, IO budget segments, plan columns): cell turns into a 32 px outlined input; Enter commits, Esc cancels; invalid shows red border and tooltip text of the error.

Column views: dropdown "Performance ▾" opening `DvColumnViewMenu` with Predefined views (Performance ✓ with pin icon `push_pin` for default, Summary, Pacing, Optimization), "Your custom views", "Create custom view from current view", "Create new custom view". The **Modify columns** dialog (13) is the shared column picker: left list of groups with Select all / Clear all, right "Your columns" with drag handles (`drag_indicator`), locked Name (`lock`), remove `cancel`; footer Apply / Cancel.

Props:
```ts
interface DvColumn<T> {
  id: string; header: string; group?: string; type?: 'text' | 'currency' | 'number' | 'percent' | 'status' | 'link' | 'custom';
  width?: number; sticky?: boolean; align?: 'left' | 'right'; sortable?: boolean; tooltip?: string;
  cell?(row: T): React.ReactNode; total?(rows: T[]): React.ReactNode;
}
interface DvGridProps<T> {
  rows: T[]; columns: DvColumn<T>[]; groups?: { id: string; label: string; collapsible?: boolean }[];
  getRowId(row: T): string; selection?: Set<string>; onSelectionChange?(s: Set<string>): void;
  sort?: { id: string; dir: 'asc' | 'desc' }; onSortChange?(s: DvGridProps<T>['sort']): void;
  pageSize: number; page: number; total: number; onPageChange(p: number, size: number): void;
  sections?: { id: string; label: string; rowIds: string[] }[]; getChildren?(row: T): T[];
  totalRow?: boolean; loading?: boolean; emptyState?: React.ReactNode; rowActions?(row: T): React.ReactNode;
  density?: 'compact';
}
```

### 2.5 Bulk Action bar (`DvBulkBar`)

Explore: `03` (selection → Action menu), `04`, `05`, `15`.

Anatomy: replaces the toolbar slot when at least one row is selected. Height 56, background `primary.main`, white text. Left: "{n} row(s) selected" ("1 row selected", "3 rows selected"), then **Action ▾** (outlined white button), optional **Segment by**, right-aligned close `close` (clears selection). Focus ring on this bar is white.

Action menu groups (headers `panelOverline`-style grey, 11 px): Status (Activate, Pause) · Bulk apply (Targeting template) · Bulk edit (Settings, Creative assignment; at LI level also Inventory ▸, Content targeting ▸, Audience targeting ▸, Technology targeting ▸) · Bulk action (Archive, Duplicate with shortcut text "⌘+D") · SDF (Download "⌘+Shift+K", Download QA). Items that do not apply are disabled (grey) with a tooltip reason. Submenus open to the right.

States: hidden; visible; menu open; item disabled; action running (menu closes, toast "Started bulk action. View status", job appears on Bulk status).

```ts
interface DvBulkBarProps { count: number; groups: { label: string; items: { id: string; label: string; shortcut?: string; disabled?: boolean; disabledReason?: string; children?: any[] }[] }[]; onAction(id: string): void; onClear(): void }
```

### 2.6 Filter bar (`DvFilterBar`)

Explore: `02`, `03`, `08`, `09`, `13`, `15`, `17`.

Anatomy (40 px row, below the toolbar, hidden until the toolbar filter toggle `filter_list` is on, except pages where it is always shown):
1. **Funnel button** `filter_alt` with count badge (16 px blue circle with white number). Click opens a popover listing active filters ("Status: Active").
2. **Chips** (28 px outlined, radius 16): "{Field}: {value} ×". Clicking the chip text opens its editor popover. Clicking × removes.
3. **Free-text input** with placeholder "Enter a search term or select filters". On typing, a popover opens with the first row "Search for Name/ID containing: {text}" and a "Filter on:" field list; Enter on the first row creates a text chip.
4. **Clear all** `close` at the right end.

Chip editor popover (level 2 shadow, 280 px): title (e.g. "Status"), close ×, "Matches:" label, then radio or checkbox list (Active, Paused, Scheduled for deletion, or Planned, Trafficked), **Apply** primary small button. Multi-value chip text reads "Status: 2 selected".

States: no filters (funnel without badge); active; chip hover (`surface.sunken`); chip focus; popover open; invalid text; disabled (read-only role).

```ts
interface FilterField { id: string; label: string; type: 'multi' | 'single' | 'text' | 'dateRange'; options?: { value: string; label: string }[] }
interface DvFilterBarProps { fields: FilterField[]; value: { fieldId: string; values: string[] }[]; text: string; onChange(v: DvFilterBarProps['value'], text: string): void; placeholder?: string }
```

### 2.7 Date-range picker (`DvDateRange`)

Explore: `02` (shared component), `16` (extended presets), `12` (reporting), `15`.

Trigger: outlined small button showing the label (for example "Yesterday", "Oct 21 - 27, 2026", "90 days to today") with `calendar_today` icon and `arrow_drop_down`.

Popover (level 2, about 720×420): left column of presets (list, selected one has `shape.pill` highlight): Custom, Today, Yesterday, This week (Sun - Today), Last 7 days, Last week (Sun - Sat), Last 14 days, This month, Last 30 days, Last month, Month to date, Quarter to date, Year to date, Last 2 years, Lifetime, "[30] days up to today", "[30] days up to yesterday" (the number is an editable field inside the row). The preset list shown depends on the host page (campaign grids use the shorter list in 02; History uses the longer list in 16); pass `presets`. Right side: Start date and End date inputs (`yyyy-mm-dd` with the locale format as placeholder), month selector ("SEP 2026 ▾") with `chevron_left` `chevron_right`, **two stacked month calendars** (S M T W T F S header; selected day = blue circle; range days = `primary.light` band; future days greyed and non-clickable when `maxDate=today`). Footer: Cancel / Apply (Apply is blue text button).

Rules: single-day mode used by grids (start = end). Keyboard: arrows move day, PageUp/PageDown change month, Enter selects, Esc closes.

```ts
interface DvDateRangeProps { value: { start: Date; end: Date; preset?: string }; onChange(v: DvDateRangeProps['value']): void; presets: string[]; maxDate?: Date; singleDay?: boolean; timeZone?: 'advertiser' | 'local' }
```

### 2.8 Forms

Explore: `03` (New campaign), `04` (IO), `05` (Line item), `06`, `10`, `11`, `14` (Advertiser settings), `15`, `17`, `18`.

**Form page shell** (`DvFormPage`): full-screen page, no left nav (new entity forms) or inside the left nav (settings pages). Header 56 px: `close` button + title ("New campaign", "New Insertion Order", "Select line item type"). Content scrolls on `background.default`; sections are white cards stacked with 16 px gap. Sticky footer (2.8.6).

**2.8.1 Outlined text field** (`DvTextField`): 40 px, 4 px radius, label above the field (not floating) in `body1` weight 500 for section fields, or inline placeholder for simple name fields ("Enter name", "Name", "Enter code"). Optional leading "Required" text in the label row (grey `caption`, right of label) for fields that show it (Partner Name, YouTube LI name). Counter under the right edge in `caption`: "0 / 240" (limits seen: 240 names, 255 ad groups, 512 creative names, 128 lift study, 100 A/B test, 25 business name, 30 headline, 90 long headline). Help icon `help` (18 px) after label opens a tooltip-card with 1 to 3 lines and **Learn more**. Prefix/suffix adornment for currency (₹ prefix) and % suffix.
States: default; hover (border `divider.strong`); focus (2 px primary); filled; error (2 px `status.error` border + red `caption` text below: "Enter a value", "Enter a number greater than 0", "Please select at least one creative type.", "Enter a larger number"); disabled; read-only locked (lock icon `lock` at right, `surface.sunken` fill, for Timezone/Currency).

**2.8.2 Dropdown / select** (`DvSelect`): same shell as text field with `arrow_drop_down`. Menu items 40 px; grouped lists use subheaders ("Recommended KPIs", "Not recommended", "Other..."). Placeholder text "Choose goal", "Choose KPI", "Select an option" in `text.secondary`. Disabled until its dependency is set. Searchable variant (Floodlight activities, countries) shows a search input at the top of the menu. Option rows may show a second line (ID or path) in `caption`.

**2.8.3 Radio and checkbox groups** (`DvRadioGroup`, `DvCheckboxGroup`): 18 px controls with 8 px padding, label `body1`, description `body2` beneath. Selected radio/checkbox `primary.main`. A radio option may reveal inline inputs ("Limit frequency to [n] exposures per [Month ▾]"); inputs are 32 px small variants inline with text and disabled until their radio is selected. Radio cards (IO type, LI type): bordered tile with icon, title, description; selected tile has 2 px `primary.main` border and `primary.light` fill; disabled tile is greyed with `info` icon and tooltip ("{Type} line items aren't compatible with your insertion order's objective setting.").

**2.8.4 Section card with left label column** (`DvSectionCard`): used on settings-style pages (Advertiser basic details). Card padding 24; two columns: label column 240 px (`subtitle1` title + `body2` description + help icon) and control column filling the rest up to 640 px. On creation forms the title sits above the controls (single column). Optional "gear note" line at the top of a card: `settings` icon 16 px + `caption` text ("These settings don't impact serving.", "Budget and pacing depend on both insertion order and line item settings."). Collapsible sections ("Additional settings", "Additional details", "Additional options") use a header row with `expand_more`; some are open by default (Additional budget details).

**2.8.5 Validation behaviour**: validation runs on Create/Save press and on blur after first touch. Errors show inline, the first invalid field scrolls into view and gets focus; the page never navigates on error. Warnings (not blocking) render as an amber inline banner under the field ("This KPI is not recommended for the selected campaign goal."). Buttons stay enabled; Save is disabled only when the form is clean (edit pages). Cross-field messages come from the validation catalogue (P2-04); this file only owns presentation.

**2.8.6 Sticky footer** (`DvFormFooter`): 64 px, white, 1 px top `divider`, shadow level 1 upwards, z `stickyFooter`, content left aligned with the form column.
- Create mode: **Create** (primary), **Cancel** (outlined), then "Optional: Enter a note about this change" input (320 px, 40 px high, no label).
- Edit mode: **Save** (primary, disabled until dirty), **Reset** (outlined, disabled until dirty), change-note input. Advertiser Basic details adds a destructive text button **Schedule for deletion** at the right.
- Panel mode (slide-over): **Apply** / **Cancel** (or **Create ad group** / **Cancel** + `delete` icon).
- Offline report: **SAVE AND RUN** (uppercase, primary), **Save**, **Cancel**.
Cancel or the header ✕ with unsaved changes opens the Unsaved Changes modal (2.11). Leaving via nav does the same.

**Other form widgets** (specified here so P3-04 builds them once):
- Currency input (₹ prefix, right-aligned digits), percent input.
- Date field with `calendar_today`; "Select a date" placeholder for optional end dates.
- Range slider with labelled stops (age 18 to 65+, household income, lookalike reach 2.5% to 10%).
- Chip input (keywords, URLs; Enter or comma commits; each chip has ⓧ).
- Large textarea with counter and limit ("1,234 / 10000").
- File drop zone (SDF upload): dashed 2 px `divider.strong` border, `upload` icon, "Drag your SDF files here to upload", "or if you prefer", **Browse**; hover and drag-over fill `primary.light`; file chip with `cancel`.
- Segmented Include | Exclude toggle (keywords).
- Two-column "Apply a targeting template" carousel of cards (name, "Last modified: {date}", Apply template, View).
- Targeting row (`DvTargetingRow`): dimension title, summary text, `edit`, "Save as template" link; locked rows show `lock`.
- Inline "Add" buttons for audience groups (outlined small).
- AI helper chip: `auto_awesome` + "Help me select audience lists and demographics" (outlined, 28 px). In the simulator this is a canned-response shortcut (Q12).

```ts
interface DvTextFieldProps { label?: string; placeholder?: string; value: string; onChange(v: string): void; maxLength?: number; required?: boolean; showRequiredHint?: boolean; error?: string; warning?: string; help?: string; locked?: boolean; disabled?: boolean; prefix?: string; suffix?: string; multiline?: boolean }
interface DvFormFooterProps { mode: 'create' | 'edit' | 'panel'; dirty: boolean; onPrimary(): void; onSecondary(): void; onReset?(): void; note?: string; onNoteChange?(v: string): void; primaryLabel?: string; extraRight?: React.ReactNode }
```

### 2.9 Status chips, dots and dropdowns (`DvStatusDot`, `DvStatusChip`, `DvStatusSelect`)

Explore: `03`, `04` (Draft), `08` (review statuses), `09`, `11`, `13`, `18`, `02` ("Limited Access").

**Dot** (grid status column, 20 px icon):
| Status | Icon | Colour |
|---|---|---|
| Active | `circle` filled, 12 px | `status.active` |
| Paused | `pause_circle` filled | `status.paused` |
| Draft | `radio_button_unchecked` (hollow circle) | `status.draft` |
| Archived | `archive` | `status.paused` |
| Scheduled for deletion | `delete` | `status.error` |
| Completed | `check_circle` | `status.active` |
| Not servable / Disapproved | `cancel` | `status.error` |
| Pending / Planned | `schedule` | `status.warning` |
| Trafficked | `check_circle` outlined | `status.info` |
Each dot has `aria-label` and a tooltip with the status word.

**Chip** (24 px, radius 16, 1 px border or tinted fill): review chip "✓ Servable" (green tint `#e6f4ea`, text `statusText.active`), "⋯ Pending" (amber tint `#fef7e0`), "✕ Disapproved" (red tint `#fce8e6`), Bulk status "Completed" / "Failed". Tag chips: "Limited Access" (grey `#f1f3f4`, `badge` is not used; plain `caption`), "Recommended" (green tint), BETA / NEW / ALPHA (`badge`, blue outline, 18 px high).

**Status dropdown** (28 px chip-button next to a name field): dot + word + `arrow_drop_down`, outlined. Menu: Active, Paused (or Draft, Active for new IO/LI/creatives; Active, Paused for advertiser/campaign). Changing it on an existing entity marks the form dirty.

```ts
type EntityStatus = 'active' | 'paused' | 'draft' | 'archived' | 'scheduledForDeletion';
interface DvStatusSelectProps { value: EntityStatus; options: EntityStatus[]; onChange(v: EntityStatus): void; disabled?: boolean }
```

### 2.10 Slide-over editors (`DvSlideOver`)

Explore: `02` (Exchanges, Select partners), `07` (all targeting editors), `05` (Select creatives, Add Floodlight activities), `06` (Create ad group, Create ad), `14` (Ad server and attribution, Third-party services), `15` (Select insertion orders), `17` (channel editor), `16` (notes panel), `10`, `09` (Discover detail).

Anatomy: right-anchored panel, full viewport height over the scrim (z `slideOver`), width 480 / 640 / 960 (clamped to `100vw - 72px`). Header 64 px: `close` + title (`h6`) + optional `auto_awesome` icon; tabs row optional (Details / Active Line Items, Scale / Google audiences). Body scrolls, padding 24. Footer 64 px sticky: **Apply** (primary) · **Cancel**, optional `delete` icon button at the far right for "remove this dimension" or "delete ad group".

Patterns inside:
- **List picker** (07): search box "Search for {x} to include or exclude"; rows with ✓ `check` include and ⊘ `block` exclude toggle buttons (28 px; active include = green tint, active exclude = red tint); selected items move into a summary block "Included … / Excluded …" with ⓧ and **Clear**.
- **Two-pane picker** (audiences, creatives, insertion orders, Floodlight): left = table with filter chip row and search, right = "None selected" / "{n} selected" with **Clear all** and removable rows.
- **Table inside panel** (Select creatives): tabs All / Eligible / Assigned (n), grid per 2.4 without pager sticky.
- **Map pane** (Geography): right half shows an Adsmetor-drawn map (not Google Maps tiles; see Section 7), selected regions shaded green, **Fit targeted locations** link.

Behaviour: opening is animated 200 ms slide (disabled under reduced motion). Scrim click does nothing when dirty and otherwise closes. Esc closes with unsaved check. Focus is trapped and returns to the trigger. A slide-over can open another (Create ad group → Create ad); the lower one dims further.

```ts
interface DvSlideOverProps { open: boolean; title: string; width?: 'default' | 'wide' | 'xwide'; tabs?: { id: string; label: string }[]; dirty?: boolean; onApply?(): void; onCancel(): void; applyLabel?: string; onDelete?(): void; children: React.ReactNode }
```

### 2.11 Modals (`DvModal`)

Explore: `03` (Unsaved Changes, Copy settings from an existing campaign, Select campaign), `15` (Download/Upload SDF), `13` (Modify columns, Select insertion orders/TV campaigns), `01` (Keyboard shortcuts), `17` (channel unsaved warning).

Anatomy: centred card, width 400 / 560 / 720, radius 8, shadow level 4, scrim. Title `h6` (20/28, weight 400), body `body1`, actions row right-aligned: secondary text button then primary filled button; spacing 8.

**Unsaved Changes** (exact): title "Unsaved Changes"; body "You have made changes that have not been saved and will be lost."; buttons **Continue editing** (text button, initial focus) and **Discard changes** (primary filled). Channel editor variant uses the longer text from 17 ("You have made changes to this channel that have not yet been saved and will be lost.").

Other dialogs: Keyboard shortcuts (two-column table of Action | Keys, keys as `kbd` pills: 1 px border, radius 4, `mono`), SDF Download (checkbox list + Next/Cancel), SDF Upload (drop zone + Upload/Cancel), Copy settings (two lists + Copy Settings disabled until selection), confirm delete (red primary "Delete").

States: open, loading action (button shows 16 px spinner and is disabled), error text inside the body. Esc and scrim close except for blocking dialogs.

```ts
interface DvModalProps { open: boolean; title: string; size?: 'sm' | 'md' | 'lg'; primary: { label: string; onClick(): void; loading?: boolean; tone?: 'default' | 'danger' }; secondary?: { label: string; onClick(): void }; children: React.ReactNode; initialFocus?: 'primary' | 'secondary' }
```

### 2.12 Banners (`DvBanner`)

Explore: `01` (advertiser paused), `03` (inventory/targeting notice, KPI warning), `02` (exchanges fees), `10` (4-hour banner), `08` (EU consent), `14`, `15`, `06`.

Anatomy: leading icon 20 px, message `body1` (max 2 lines on page level), optional links ("Learn more", "Edit settings") in `link` colour, optional **Dismiss** text button right, optional action button (outlined small, for example "Review fees"). Padding 8 16, radius 8 inside cards; page-level banners are full width with radius 0 and 1 px bottom border.

| Kind | Tokens | Use |
|---|---|---|
| Info | `banner.info`, `info` icon | "This advertiser is currently paused. None of its campaigns or deals are serving." (page level, persistent, not dismissible), campaign form notice, 4-hour audience note |
| Warning | `banner.warning`, `warning` icon | KPI not recommended, ad group has no ads, third-party tag compliance, deprecation notes (SDF v9) |
| Error | `banner.error`, `error` icon | Failed job, load failure, blocked create, restrictions on creatives |
| Success | `banner.success`, `check_circle` | Rare; inline confirmations |

States: default; with action; dismissible; collapsed (long text with "Show more details"). Page-level banners sit directly under the app bar and push content.

```ts
interface DvBannerProps { kind: 'info' | 'warning' | 'error' | 'success'; children: React.ReactNode; links?: { label: string; href?: string; onClick?(): void }[]; onDismiss?(): void; action?: { label: string; onClick(): void }; level?: 'page' | 'inline' }
```

### 2.13 Toasts (`DvToast`)

Explore: `02` ("Error when retrieving Floodlight."), `05` (yellow toast for Demand Gen with Dismiss), `15` (bulk job started).

Two kinds:
- **Neutral toast** (default): bottom-left, 344 px min, `toast.bg` `#323232`, white `body1`, radius 4, shadow 4. Optional action text button in `toast.action`. Auto-dismiss 6 s; hover pauses. Stack up to 3, 8 px gap. `role="status"` (errors use `role="alert"`).
- **Warning toast**: top-centre, full-width max 640, `banner.warning` fill, bullet list allowed, **Dismiss** button, stays until dismissed (Demand Gen example: "To create Demand Gen line items:" then a bullet "Enable Floodlight optimization in this advertiser").

```ts
toast.show({ kind: 'neutral' | 'warning' | 'error', message: string, action?: { label: string; onClick(): void }, durationMs?: number })
```

### 2.14 Empty states (`DvEmptyState`)

Explore: `01` (no pinned items, no rejected creatives), `02` (Channels, Custom bidding, Cross-media reach), `09`, `13`, `15` (targeting templates, experiments), `16`, `17`, `10`.

Variants:
- **Icon empty state** (default): 72 px circle in `surface.sunken` with a 32 px grey icon (list icon `list_alt`, or context icon), message `body1` grey centred, optional link or primary button (for example "New channel", "New algorithm", "Create new"). Vertical padding 48. Messages are verbatim: "There is no history for this date range.", "No performance chart data available", "No creatives assigned", "There are no pinned items.", "There are currently no notes.", "No appeals found", "No results."
- **Positive empty state**: green `check_circle` 32 px, text "There are no rejected creatives (not including YouTube & partners)".
- **Illustrated welcome** (Cross-media reach, targeting templates): Adsmetor-drawn flat illustration 160 px (never Google artwork), title `h4`, one-line text, two buttons (Learn more ↗ outlined, New report primary).
- **Inline empty** inside cards and chart cards: 2 lines `body2` grey, centred ("To see impressions lost, check the box next to an insertion order or line item…").

```ts
interface DvEmptyStateProps { variant?: 'icon' | 'positive' | 'illustrated' | 'inline'; icon?: string; title?: string; message: string; action?: { label: string; onClick(): void; primary?: boolean }; secondary?: { label: string; href: string } }
```

### 2.15 Loading (`DvSpinner`, `DvSkeleton`, route progress)

- **Route progress**: 4 px `LinearProgress` pinned under the app bar, indeterminate, appears after 150 ms.
- **Grid**: skeleton rows (8) with grey bars (`#e8eaed`, shimmer 1.2 s) in each column width; headers render immediately.
- **Panels and cards**: 24 px circular spinner (`CircularProgress`, thickness 4, `primary.main`) centred; chart cards show skeleton bars (the deal page shows "loading charts").
- **Buttons**: 16 px spinner replaces the leading icon, button disabled, label stays.
- **Blocking overlays** (SDF job start, duplicate): modal with spinner and text only if the action takes over 1 s.
- Minimum display time 300 ms to avoid flicker. `aria-busy="true"` on the region.
- Reduced motion: no shimmer, static grey bars.

### 2.16 Chart cards (`DvChartCard`, `DvChartStrip`)

Explore: `03` and `04` (chart strip), `15` (Customize charts), `02` (Advertisers summary donuts), `01` (Overview KPI tiles), `07` (Impressions summary), `11` (coverage bars), `13` (forecast KPI strip), `09` (scale donuts).

**Card frame**: 296×216 min, white, 1 px `divider`, radius 8, padding 16. Header row: title (`subtitle1`, with period in `caption`, for example "Total cost (flight start - Today)"), `help` icon, ⋮ menu. Footer line `caption` ("Today: ₹x (y% of ₹z)"). `lock` icon `caption` size at bottom-right when the card is a built-in. Hover raises to shadow level 1. Selected (customize mode) 2 px `primary.main` border.

**Strip** (`DvChartStrip`): horizontal scroller with `chevron_left` / `chevron_right` 40 px circular buttons at the edges (appear on overflow), scroll snap per card. Above it the chart toolbar: **Customize charts** (outlined), suggestion chips with `auto_awesome` ("Bubble chart of CPA vs conversions"), right side **Tour custom charts** and **Share**. In customize mode: **Save charts** (primary), AI prompt input "Ask a performance question or describe metrics" + **Create**, **Add ▾** (Starter charts, Built-in charts), **Note**, and right icons reset `restart_alt`, `undo`, `redo`, exit `close`.

Content kinds (Recharts):
| Kind | Spec |
|---|---|
| Sparkline bars (Total cost) | `BarChart` 100% × 56 px, bars 8 px wide, gap 3, fill `chart[0]`, today's bar `primary.dark`; x labels = day letters (M T W T F S S) or dates in `caption`; no axes, no grid; tooltip on hover with date and value |
| Value + progress vs goal (Avg. KPI) | Big `kpiValue`, caption "vs ₹50.00", 8 px high track `#e8eaed`, fill `chart[0]`, goal marker 2 px vertical line `text.primary` with label; fill turns `status.warning` when more than 20% off goal in the bad direction |
| Donut | `PieChart`, outer 56, inner 40 (Advertisers summary) or 90 / 64 (Impressions summary), legend right with colour squares and % ; centre label optional |
| Horizontal coverage bar (Brand controls) | 8 px high track grey, fill blue, % right ("92% (46/50 Line items)") |
| Bar/line/pie/bubble (custom charts) | Recharts default components with palette `chart`; 1 px `divider` gridlines; axis text `caption`; direct labels where possible; legend below |
| KPI strip (forecast) | label `caption`, value `kpiValueSmall`, switchable metric shows `arrow_drop_down` and a menu; overflow chevron |
| Empty chart | `DvEmptyState` inline variant |

Charts follow the `dataviz` colour rules: no more than 7 series, never colour as the only cue, tooltips keyboard reachable via focus on bars (`tabIndex=0` on the chart region and arrow keys move the active datum).

```ts
interface DvChartCardProps { title: string; period?: string; help?: string; menu?: { label: string; onClick(): void }[]; locked?: boolean; footer?: React.ReactNode; selected?: boolean; children: React.ReactNode; empty?: React.ReactNode }
```

### 2.17 Tabs (`DvTabs`)

Explore: `03` (Campaigns | Insertion orders; Combined | Insertion orders | Line items), `04`, `05`, `06`, `08`, `09`, `10`, `11`, `12`, `13`, `14`, `18`.

Page tabs: underline style on a 1 px `divider` baseline, 48 px high, `button` typography, label `text.secondary`; selected label `primary.main` with 3 px indicator (top corners rounded 3 px); hover `surface.sunken` background; focus ring inset. Optional adornments: pin icon `push_pin` 16 px marking the default tab, count in parentheses ("Assigned (3)"), NEW badge. Tabs scroll horizontally with edge chevrons when they overflow.

Variants: **page tabs** (under title), **card tabs** (inside slide-over or card, 40 px), **segmented** (`ToggleButtonGroup`, 32 px, outlined, used for Include | Exclude and Region | Radius) and **chip tabs** (All ✓ / Budget / Creatives in Alerts, filled `primary.light` when selected).

Keyboard: Left/Right move focus, Home/End, activation follows focus. `role="tablist"`.

### 2.18 Stepper (`DvStepper`)

Explore: `11` (custom bidding wizard "1 Set up → 2 Test → 3 Save"), `04` (IO two-step create), `05` (LI two-step), `06`.

Wizard stepper: horizontal, centred under the header. Each step = 24 px circle with number (`caption` weight 500) + label (`body1`); connector line 1 px `divider.strong`, 48 to 96 px long. States: upcoming (grey outline, grey label), current (filled `primary.main`, white number, label `text.primary` weight 500), completed (filled `primary.main` with `check`), error (red outline with `error` icon). Footer **Back** / **Next** (primary) / **Cancel**; Next disabled until the step is valid. The IO and LI two-step creates do not show a stepper; they show only the header title and Next / Cancel (as in the reference).

### 2.19 Tooltips and help popovers (`DvTooltip`, `DvHelp`)

- **Tooltip**: `tooltip.bg`, white `caption` text, radius 4, padding 6 8, max width 240, shows after 500 ms hover or on keyboard focus, hides on Esc, no arrow. Used for icon buttons ("Search (/)", "Alerts"), truncated names, disabled reasons, and **dotted-underline text** (`DvHoverDetail`: 1 px dotted `text.secondary` bottom border) for column values with extra detail (Exchange status "Servable (1 of 2)", "Central partner deal").
- **Help popover** (`help` 18 px icon): click opens a small card (max 320, shadow 2) with 1 to 3 lines and **Learn more ↗**. Focus returns to the icon on close. Text is Adsmetor-written (Section 7).
- **Feedback**: "Is this useful?" with `thumb_up_off_alt` / `thumb_down_off_alt` icon buttons.

### 2.20 Other shared patterns (build once in P3-04, spec'd here for reference)

| Pattern | What | Explore |
|---|---|---|
| `DvPageHeader` | Title (`pageTitle`) + optional "Limited Access" chip + right-aligned action buttons; below it tabs | 02, 13, 14 |
| `DvEntityHeader` | Breadcrumb row ("Overview ›", "All audiences ›", "A/B tests ›") + title + status chip + tabs | 04, 05, 10, 18 |
| `DvSummaryCard` | Advertisers list cards: big value, caption, donut + legend | 02 |
| `DvKpiTile` | Overview pacing tiles (label, count, red/amber/blue accent bar) | 01 |
| `DvCardCarousel` | Template cards, suggested templates (coloured 4 px top border by family: BASIC blue, REACH green, VIDEO purple), featured packages | 07, 12, 09 |
| `DvSeller card` | Instant deal seller tile: logo (placeholder initial), name, badge Exchange / Publisher, description, View details | 09 |
| `DvPickerDialog` | Two-pane picker (campaign → settings, advertiser → campaigns → IOs) | 03, 13 |
| `DvTreeSelect` | Partner → advertisers tree with chevrons and checkboxes, "None selected" pane | 02 |
| `DvDayTimeGrid` | M to S × 12 AM to 12 AM, 3-hour ticks, shaded targeted blocks, "ADD SEGMENT" rows | 07 |
| `DvSankey` | Troubleshooter funnel (5 stages) with a reason table per stage. Custom SVG, not Recharts | 05 |
| `DvAudienceBuilder` | Include/Exclude groups joined by OR with Impressions summary pane | 07, 10 |
| `DvRuleRow` | "[Clicked] is [True ▾] Score [1] ⓧ" rows in custom bidding | 11 |
| `DvDayCard` | History day card (date, weekday, "{n} changes to {entity}", Add a note, change table with expandable descriptions) | 16 |
| `DvKbd` | Keycap pill for shortcuts | 01 |
| `DvLogo404` | 404 page structure | 17 |
| `DvReportBuilder` panels | Drag-drop zones DIMENSIONS (ROW) / METRICS (COLUMN), field picker with search and category counts | 12 |

---

## 3. Icon set

**Library**: Material Symbols, **Outlined** style, weight 400, grade 0, optical size 24 (use 20 in grids and nav). Licence Apache 2.0, compliant with R2. Install `@material-symbols/svg-400` and import individual SVGs through SVGR into `components/icons/` (tree shaken; no variable-font download). Filled variant (`fill=1`) is used only for: active status dots, selected rail icon, solid severity icons (`error`, `warning`), and `circle`. Colours come from the token tables, never from the SVG.

Mapping (every icon named or implied in the explore files). Where the reference shows a custom glyph, the closest Material Symbols name is given; flagged items need a look-alike check in SOP-3.

| Meaning | Seen in | Material Symbols name |
|---|---|---|
| Hamburger | 01 | `menu` |
| Home / Overview | 01 | `home` |
| Search | 01 | `search` |
| Notifications bell | 01 | `notifications` |
| User management & email preferences (person list) | 01 | `manage_accounts` |
| Bulk status (checklist) | 01 | `checklist` |
| Reports (bar chart) | 01 | `bar_chart` |
| Keyboard shortcuts | 01 | `keyboard` |
| Switch products (grid) | 01 | `apps` |
| Account avatar fallback | 01 | `account_circle` |
| Back arrow | 02, 11, 12 | `arrow_back` |
| Close | all forms | `close` |
| Ask Advisor (sparkle-search) | 01 | `auto_awesome` (alt `manage_search`) |
| Quick help | 01 | `help` |
| Intelligence (orbit) | 01 | `hub` (**verify**; alt `public`) |
| Panel toggle | 01 | `right_panel_close` / `right_panel_open` |
| New chat / chat history | 01 | `add_comment` / `history` |
| Send message | 01 | `send` |
| Thumbs up / down | 01, 05, 08 | `thumb_up` / `thumb_down` (outlined: `thumb_up_off_alt`, `thumb_down_off_alt`) |
| Lightbulb (suggestion) | 01 | `lightbulb` |
| Error severity (red) | 01, 03 | `error` |
| Warning severity (amber) | 01, 03 | `warning` |
| Info | 01, 05, 09 | `info` |
| Success / check circle | 01, 08 | `check_circle` |
| Nav: Overview | 01 | `dashboard` |
| Nav: Advertisers | 01 | `business_center` |
| Nav: Campaigns | 01 | `campaign` |
| Nav: Audiences | 01 | `groups` |
| Nav: Creative | 01 | `palette` |
| Nav: Inventory | 01 | `inventory_2` |
| Nav: Reports | 01 | `bar_chart` |
| Nav: Experiments | 01 | `science` |
| Nav: Targeting templates | 01 | `ads_click` (alt `adjust`) |
| Nav: Resources | 01 | `folder_open` |
| Nav: Settings (advertiser, partner) | 01 | `settings` |
| Nav: History | 01 | `history` |
| Nav group caret | 01 | `expand_more` (closed shows `chevron_right`) |
| New (blue dot) | 01 | CSS circle, no icon |
| Campaign page: Inventory / Alerts / Campaign settings | 03 | `inventory_2` / `notification_important` / `tune` |
| Filter funnel (filter bar) | 03 | `filter_alt` |
| Filter toggle (toolbar) | 02, 03 | `filter_list` |
| Overflow | many | `more_vert` |
| Download | 04, 08, 16 | `download` |
| Upload | 15 | `upload` (`upload_file` in drop zone) |
| Fullscreen | 03 | `fullscreen` |
| Refresh | 08, 12 | `refresh` |
| View toggle list / grid | 08 | `view_list` / `view_module` |
| Column picker (Columns) | 13 | `view_column` |
| Expand / collapse all | 09, 16 | `unfold_more` / `unfold_less` |
| Edit (pencil) | many | `edit` |
| Delete (trash) | 06, 07, 13 | `delete` |
| Remove chip ⊗ / clear | 07, 13 | `cancel` |
| Add | 03, 10 | `add` |
| Include ✓ / Exclude ⊘ | 07 | `check` / `block` |
| Lock (locked fields) | 02, 05, 13 | `lock` |
| Pin default tab / view | 03 | `push_pin` |
| Duplicate | 03, 04 | `content_copy` |
| Archive | 03 | `archive` |
| Column group collapse ‹› | 02, 03 | `chevron_left` / `chevron_right` (alt `keyboard_double_arrow_left/right`) |
| Row inline menu caret ▾ | 03 | `arrow_drop_down` |
| Sort | 13 | `arrow_upward` / `arrow_downward` |
| Pager | 02 | `first_page`, `chevron_left`, `chevron_right`, `last_page` |
| Alerts column (bell in header) | 03 | `notifications` |
| Alert cell critical / needs attention | 03 | `error` / `warning` |
| Status active dot | 03 | `circle` (filled) |
| Status paused | 03 | `pause_circle` |
| Status draft | 04 | `radio_button_unchecked` |
| Trend column | 04 | `show_chart` |
| Help "?" | forms | `help` |
| Gear note | 03, 04 | `settings` |
| Calendar | 02 | `calendar_today` (range: `date_range`) |
| Drag handle | 13 | `drag_indicator` |
| Open in new / external link ↗ | 08, 09, 14 | `open_in_new` |
| Instant deal ⚡ | 09 | `bolt` |
| Deal / order / package | 09 | `handshake` / `receipt_long` / `package_2` |
| Negotiation | 09 | `forum` |
| Plan | 09, 13 | `event_note` |
| Tune (Additional Settings) | 13 | `tune` |
| Copy (plan) | 13 | `content_copy` |
| Format gallery cards | 08 | `view_carousel` |
| Appeal | 08 | `gavel` |
| Creative restrictions | 08 | `block` |
| LI type: Display | 05 | `ad_units` (alt `web`) |
| LI type: Video | 05 | `videocam` |
| LI type: Connected TV / OTT | 05 | `connected_tv` |
| LI type: Audio | 05 | `headphones` |
| LI type: Mobile app install | 05 | `install_mobile` |
| LI type: Ads in mobile apps | 05 | `smartphone` |
| LI type: YouTube & partners | 06 | `smart_display` |
| LI type: Demand Gen | 05 | `view_quilt` |
| IO type: Standard / CTV / DOOH | 04 | `dns` / `connected_tv` / `signpost` |
| Device: computer / phone / tablet / TV | 06, 07 | `computer` / `smartphone` / `tablet` / `tv` |
| Environment: web / app | 07 | `language` / `apps` |
| Map: fit locations | 07 | `fit_screen` |
| Time zone / schedule | 12 | `schedule` |
| AI helper chip | 05, 12, 15 | `auto_awesome` |
| Floodlight activity | 11 | `flare` |
| Audience list | 10 | `groups` |
| Tag (Google tag) | 14 | `sell` |
| Link account | 14 | `link` |
| Policy certificate | 14 | `verified_user` |
| Play (video card) | 01 | `play_circle` |
| Article link | 01 | `article` |
| Reset / undo / redo | 15 | `restart_alt` / `undo` / `redo` |
| Share | 03 | `share` |
| Save as template | 07 | `bookmark_add` |
| List empty-state icon | 15, 16 | `list_alt` |
| Success empty (green check) | 01 | `check_circle` |
| Tour / guided tour | 01, 15 | `tour` |
| Dismiss toast | 02 | text button, no icon |
| Load failure (panel or card) | all | `cloud_off` |
| Compare / segment | 03 | `splitscreen` |

Rules: size 20 in dense UI, 24 in app bar; icon-only buttons need `aria-label` and tooltip; do not draw custom icons unless this table has no match (log it in Q-list).

---

## 4. Layout rules

### 4.1 Application shell

CSS grid, desktop first:

```
+---------------------------------------------------------------+
| App bar (56 px, spans all columns, z 1200)                    |
+--------+--------------------------------------+---------+-----+
| Left   | Banner slot (paused advertiser etc.) | Right   | Rail|
| nav    +--------------------------------------+ panel   | 48  |
| 256/72 | Main scroll area (page content)      | 0 or 360|     |
+--------+--------------------------------------+---------+-----+
```

- `grid-template-columns: [nav] var(--nav-w) [main] minmax(0, 1fr) [panel] var(--panel-w) [rail] 48px`.
- Only the main area scrolls vertically; app bar, nav and rail are fixed. Grid regions inside main scroll horizontally on their own.
- The right panel pushes content at 1280 px and wider; below that it overlays.
- IO page, LI page, creative page, form pages, Users page and Reports app hide the left nav (full width). Rail stays except in form pages and the Reports app.
- Banner slot is sticky under the app bar; it is the only place for page-level banners.

### 4.2 Page types and grid

12-column grid for dashboard-style pages, 24 px margins, 16 px gutters. List pages are fluid (grid takes the full width).

| Page type | Structure | Examples |
|---|---|---|
| **A. List page** | Title row (`pageTitle` + chips + action buttons) → tabs → toolbar (primary button left; column view, date, Segment by, download, fullscreen, ⋮ right) → optional chart strip → filter bar → grid → pager | Campaigns, Advertisers, Creatives, Plans, Experiments |
| **B. Entity page** | Crumb row ("Overview ›") → title + status → tabs → content per tab (chart strip + grid, or form, or history) | Campaign, IO, LI, ad groups, deal, audience |
| **C. Full-screen form page** | Header (✕ + title) → stacked cards (max width 960, left aligned to the nav-less canvas, centred when width over 1440) → sticky footer | New campaign, New IO, New LI (step 2), New lift study, Create a report |
| **D. Settings page** | In left nav; card per section with label column; sticky footer | Basic details, Targeting rules, Alert preferences, Partner Exchanges |
| **E. Dashboard** | 12-col: 8 main + 4 side (Overview: pacing card, rejected creatives, underperforming IOs; right column tutorials, pinned items, recently opened) | Partner Overview |
| **F. Embedded app** | Header with `arrow_back` + title, own toolbar, full-bleed canvas, right field panel | Reports builder, Reports hub |
| **G. Picker page** | Centred grid of cards 3×3 (type picker), card 280×160, 16 gap | Select line item type, New audience, Instant deal sellers |
| **H. Error page** | Centred logo, message, link "Return to home page" | 404 |

Spacing recipes: page padding 24; title row bottom margin 16; toolbar to filter bar 8; chart strip bottom margin 16; card padding 24 (forms), 16 (chart cards, panels); form row gap 24; label-to-control 8; helper text 4; section gap 16.

Content widths: form cards 960 max, settings control column 640 max, banners and tabs full width of main, dialogs per 1.3.

### 4.3 Full-screen form behaviour

- Reached by route (`/cs/new`, `/ios/new`, `/lis/new`, `/audience/new`…), not a modal.
- Header ✕ returns to the previous list; with edits it triggers the Unsaved Changes modal.
- Advertiser paused banner stays visible beneath the header.
- Two-step creates (IO, LI) keep the same header and replace the content; Back is not offered in the reference (Cancel only); the simulator adds none.
- On submit with errors the page scrolls to the first error; on success it navigates to the created entity (campaign page, IO page, LI page) and shows a neutral toast "Created".
- Focus on load goes to the first field (name).

### 4.4 Responsive behaviour

| Width | Behaviour |
|---|---|
| ≥ 1680 | Same as 1280 layout; grids and charts expand; form cards stay 960 |
| 1280 to 1679 | Design target. Nav expanded by default (user can collapse), right panel pushes content |
| 1024 to 1279 | Nav starts as rail (72). Right panel overlays the content with shadow 3. Chart strip scrolls. Grid keeps sticky columns and scrolls horizontally. Slide-overs cap at 560 (xwide = 100vw − 72) |
| 768 to 1023 | Nav becomes a temporary drawer opened by the hamburger. Right rail icons collapse into a single `more_vert` menu in the app bar. App bar crumbs show only the last crumb. Forms single column; label column stacks above controls. Modals 90vw |
| < 768 | Interstitial: "DV360 Simulator works best on a screen 1280 px wide or more. Continue anyway." Layout then follows the 768 rules with horizontal page scroll allowed. Not a test target |

Print: not supported in v1.

### 4.5 Motion

Durations: 100 ms hover colour, 200 ms slide-over and panel, 150 ms menu open (fade + 4 px translate), 250 ms nav width. Easing `cubic-bezier(0.2, 0, 0, 1)`. No decorative animation. Respect `prefers-reduced-motion` (see theme CssBaseline block).

---

## 5. Accessibility baseline

Target: WCAG 2.2 AA for all student-facing screens.

### 5.1 Contrast

- Text 4.5:1 minimum (3:1 for 18 px regular and 14 px bold). Use the "text-safe" hex column in 1.1 for coloured text. `#1a73e8` on white is 4.51:1, so it is allowed for 14 px medium buttons and links only on white; on `#f8f9fa` (4.27:1) use `link` `#1967d2`.
- Non-text (icons that carry meaning, input borders, focus ring) 3:1: `#80868b` on white is 3.68:1 (OK); `#dadce0` borders are decorative and paired with an interactive state change, so exempt.
- Disabled elements are exempt but must not carry unique information.
- Never rely on colour alone: status dots differ by shape (filled circle, pause, hollow circle), alert icons differ (`error` vs `warning`), chart series use direct labels or patterns in dense charts.

### 5.2 Focus

- Visible focus on every interactive element: 2 px solid `#1a73e8`, 2 px offset (`outline-offset: -2px` for cells, tabs and nav items so it is not clipped). On blue surfaces (Bulk Action bar, Intelligence header) the ring is white.
- Focus order follows the visual order; the left nav is before main, the right rail after main.
- Modals and slide-overs trap focus, set initial focus (first field or safe action), and restore focus to the trigger on close.
- A "Skip to main content" link is the first tab stop.

### 5.3 Semantics and keyboard

- Landmarks: `header` (app bar), `nav` (left nav, aria-label "Main"), `main`, `aside` (right panel, aria-label by title).
- Nav groups use `aria-expanded`; the active item `aria-current="page"`.
- Grid: `role="grid"` with `aria-rowcount`, `aria-colcount`, `aria-sort`; roving tabindex with arrow-key cell navigation, Space selects a row when the checkbox cell is focused, Enter opens the link in the cell, Shift+F10 or the context key opens the row menu. Collapsible column group buttons have `aria-expanded`.
- Forms: each control has a visible label or `aria-label`; errors use `aria-describedby` and `aria-invalid`; the error summary is announced via a polite live region when Create fails.
- Toasts: `role="status"` (polite) and errors `role="alert"`. Banners are not live regions except when added after load.
- Dialogs: `role="dialog"`, `aria-modal`, labelled by the title.
- Icons inside buttons are `aria-hidden`; icon-only buttons have `aria-label`.
- Minimum target size 24×24 CSS px (rail and app bar icons are 40).
- Page title updates on route change; focus moves to the page `h1` on navigation, announced politely.
- Zoom to 200% and text spacing overrides must not lose content (1280 px layout at 200% is effectively the 640 px state; the interstitial text must explain that desktop use is expected, which is consistent with the project scope).

### 5.4 Keyboard shortcuts

From `01-global-shell.md`. Implement with one global handler (`useHotkeys`). Windows and Linux use Ctrl where Mac uses ⌘. Shortcuts do not fire while focus is in an input, textarea, select or contenteditable, or when a modal is open (except `?`, which is allowed from anywhere that is not a text input).

| Action | Keys | Behaviour |
|---|---|---|
| Keyboard shortcuts | `?` | Opens the shortcuts modal (2.11) |
| Search | `/` | Opens the search overlay, focus in the input |
| New (entity for current page) | `Shift + N` | Campaigns list → New campaign; IO list in campaign → New Insertion Order; LI list → New line item; Creatives → New menu; no-op elsewhere |
| New insertion order | `Shift + I` | Opens New Insertion Order from a campaign context |
| New line item | `Shift + L` | Opens Select line item type from an IO context |
| Download SDF | `⌘ + Shift + K` | Opens SDF Download dialog for the current grid |
| Download CSV of view | `⌘ + Shift + L` | Downloads the current grid view as CSV (Bulk status entry "Download") |
| Duplicate | `⌘ + D` | Duplicates selected rows. If nothing is selected the event is not prevented, so the browser's bookmark shortcut still works |

Additional (ours, documented in the shortcuts modal under "Simulator"): `Esc` closes the topmost popover, menu, slide-over or modal. No other shortcuts are added, because DV360 has none.

### 5.5 Other

- Language attribute `en`; numbers and currencies use `Intl` with the advertiser currency (Q10).
- Reduced motion, forced-colours (high contrast): borders must remain visible; use `1px solid CanvasText` fallbacks for cards and focus ring in forced-colours mode.
- Automated checks: `axe-core` in Playwright on each page type, zero serious or critical violations as a gate for P6-02.

---

## 6. Fidelity checklist (SOP-3)

Use per module in Phase 6 (P6-01) and after each Phase 3 and 4 module. Procedure:

1. Open the same entity in the DV360 demo and the simulator Vercel preview with equivalent data, same browser, 1440×900 first, then 1280×720.
2. Capture both, overlay at 50% opacity (or flip A/B), and tick each item below. Text must match exactly; spacing within ±2 px; colour within 3 ΔE (or the same hex after sampling); icon the same glyph or the mapped one in Section 3.
3. Score = ticked items ÷ applicable items. Pass is 95% or more (SOP-3). Log every miss as a task with a screenshot pair.
4. Data-dependent items are checked with seed data close to the reference.

**Global (every page)**
- [ ] App bar height, icon order, tooltip texts (Search (/), etc.), badge dot on bell
- [ ] Two-line breadcrumb (label above name), separators, truncation tooltip
- [ ] Left nav items, order, dividers, carets, "new" dot, active pill colour and shape, collapsed rail tooltips
- [ ] Right rail icons, order, selected state, panel width and push/overlay behaviour
- [ ] Page background vs card colour; card border and radius
- [ ] Fonts: title face, body face, sizes from 1.2 table
- [ ] Banner under app bar (paused advertiser) wording, colour, icon, link
- [ ] Focus ring visible and not clipped
- [ ] No Google logo, text or asset anywhere (Section 7)

**Data grid**
- [ ] Two header rows: group labels, ‹› toggles, collapsed stub look
- [ ] Column order and default widths per view (Performance, Summary, Pacing, Optimization)
- [ ] Sticky columns and shadow edge on scroll; sticky header
- [ ] Select-all checkbox state (empty, indeterminate, checked)
- [ ] Alert bell column, status dot column, hover ▾ with Activate / Pause
- [ ] Name wrap to 2 lines with grey ID below; link colour
- [ ] Number alignment, tabular figures, "-" for empty, currency format, compact format in cards
- [ ] Row hover, selected, focus visuals; inline icons on hover (info, edit, budget edit)
- [ ] Total row text ("Total: Display") and weight
- [ ] Pager: "Show rows", range text, icons, page size options
- [ ] Empty and loading states

**Bulk Action bar**
- [ ] Bar turns blue, text "{n} row(s) selected", Action ▾, close ×
- [ ] Menu groups, item names, shortcut hints, disabled items
- [ ] Toast / Bulk status entry after the action

**Filter bar**
- [ ] Funnel with count badge; popover listing filters
- [ ] Chip text format ("Status: Active", "Status: 5 selected"), × behaviour, editor popover (title, "Matches:", options, Apply)
- [ ] Placeholder "Enter a search term or select filters"; typing popover ("Search for Name/ID containing:", "Filter on:")
- [ ] Clear-all

**Date-range picker**
- [ ] Preset list and order for the page, selected preset highlight
- [ ] Start/End inputs, month selector, two calendars, selected day circle, greyed future days
- [ ] Trigger label formats ("Yesterday", "Oct 21 - 27, 2026", "90 days to today")

**Forms**
- [ ] Field order, labels, helper text, placeholder and counter ("0 / 240")
- [ ] Status chip default (Draft for IO/LI, Active for campaign)
- [ ] Required marks and error texts: "Enter a value", "Enter a number greater than 0", "Please select at least one creative type."
- [ ] Error styling (red border, red text), first-error scroll, no navigation on error
- [ ] Warning banner for not-recommended KPI, amber
- [ ] Dropdown groups and disabled-until-dependency behaviour
- [ ] Radio/checkbox layout, inline inputs inside radios
- [ ] Section cards, gear notes, expanders default open/closed
- [ ] Left label column on settings pages; locked fields with lock icon
- [ ] Sticky footer buttons by mode (Create/Cancel, Save/Reset), change-note input
- [ ] Unsaved Changes modal text and buttons

**Status chips and dropdowns**
- [ ] Dot shapes and colours for Active, Paused, Draft
- [ ] Review status chips (Servable, Pending, Disapproved) and exchange status
- [ ] "Limited Access" style chip placement if used
- [ ] BETA / NEW / ALPHA tag look

**Slide-overs**
- [ ] Width, header (✕, title), scrim
- [ ] Apply / Cancel / delete footer placement
- [ ] Include ✓ / Exclude ⊘ rows; summary and Clear
- [ ] Two-pane picker with "None selected" / "Clear all"
- [ ] Nested slide-over stacking

**Modals**
- [ ] Width, title, body, button order and style (Discard changes primary, Continue editing secondary)
- [ ] Keyboard shortcuts table content

**Banners and toasts**
- [ ] Info, amber, red colours; icon; link and Dismiss placement
- [ ] Toast position, colour, duration; yellow top toast for Demand Gen

**Empty states**
- [ ] Grey circle + icon + message wording
- [ ] Positive (green check) variant
- [ ] Chart empty text

**Chart cards**
- [ ] Card size, title and period text, help icon, ⋮, lock icon
- [ ] Sparkline bars (count, day labels, today bar)
- [ ] Progress bar vs goal with marker and "vs" text
- [ ] Donut sizes, legend order and colours (green/orange/blue, blue/red)
- [ ] Strip scroll chevrons, Customize charts toolbar, chips

**Tabs, stepper, tooltips**
- [ ] Tab height, indicator, selected colour, pin icon on default tab
- [ ] Stepper numbers, states, connector (custom bidding)
- [ ] Tooltip delay, colour, text; dotted-underline hover details

**Panels**
- [ ] Intelligence: blue header, section overlines, severity icons, Investigate buttons, "+N more"
- [ ] Ask Advisor: greeting, chips, message box, header icons
- [ ] Quick help: sections and cards

**Behaviour pass (functional items belonging to design system)**
- [ ] Keyboard shortcuts: `?`, `/`, Shift+N, Shift+I, Shift+L, ⌘+Shift+K, ⌘+Shift+L, ⌘+D
- [ ] Hamburger collapses nav to rail; group expand state persists
- [ ] Opening a rail panel replaces the other; same icon closes
- [ ] Esc closes the topmost layer

---

## 7. Branding

### 7.1 Name and placement

- Product name everywhere: **DV360 Simulator by Adsmetor** (R1). Short form in tight spaces (tab title suffix, narrow widths below 1100 px): "DV360 Simulator".
- Browser tab title: `{Page or entity} - DV360 Simulator by Adsmetor`. Favicon: the Adsmetor mark.
- **App bar**: after the hamburger, the Adsmetor logo (28 px high, SVG, supplied by Adsmetor) followed by the wordmark text "DV360 Simulator by Adsmetor" in `h5` `text.primary`. The reference places "product logo + product name" in this slot (01), so the slot keeps its position and size. The logo links to Partner Overview.
- **Login page** (Adsmetor login, replaces Google sign-in): centred card 400 px, logo 48 px, title "DV360 Simulator by Adsmetor", fields Email and Password, **Sign in** primary button, small line "Classroom use only. Ask your instructor if you cannot sign in." No Google, Apple or social buttons.
- **404 page**: same structure as the reference (17) with the Adsmetor logo.
- **Product switcher** (`apps` menu): header "Adsmetor", entries Platform Home, DV360 Simulator, other Adsmetor tools, "Explore more products" expander (can be empty).
- **User menu**: name, email, role chip (Student / Instructor / Admin), **Sign out**. No Google Account language.
- **Classroom session banner** (simulator only): info banner under the app bar "Classroom session ends in {n} min" when an access window is closing. Uses the standard info banner.
- Optional small "Sandbox" chip beside the partner crumb for student sandboxes (Q13).
- Colour of the brand: the UI keeps the DV360 blue for fidelity. The Adsmetor yellow/black brand colours are used only inside the logo and on the login page accent, not on the working UI (Q11).

### 7.2 What NOT to reproduce (R1, R2, R5)

- Google logo, the multicolour "G", Google Marketing Platform wordmark, DV360 product icon, Google Ads, YouTube, Google Analytics logos or any Google trademark artwork.
- The Google Account avatar menu and Google sign-in screens.
- **Google Sans** and **Product Sans** font files. Use Roboto and Figtree.
- Google illustrations (empty states, Format gallery phone mock-ups, "Welcome to Cross-media reach!" artwork), the Format gallery images, Google Maps tiles and map UI, tutorial video thumbnails. Replace with Adsmetor-drawn flat illustrations, placeholder previews and a simple internal map.
- Verbatim help articles and long help text (SOP-1 step 6: paraphrase). Short UI labels, button names and validation messages stay verbatim because fidelity depends on them.
- Real client names, IDs, budgets, emails and metrics seen in the demo account (R5). All sample data is generated.
- Google's code, CSS, SVG sources or screenshots as assets. Screenshots in `docs/screenshots/` are references for reviewers only and are never imported into the app.
- Third-party partner logos (exchange logos, IAS, DoubleVerify, Netflix and so on). Use a neutral letter avatar (circle with the first letter) and the vendor name in text.
- "AI by Google" claims. The Ask Advisor, search suggestions and "Help me select audience lists" features are labelled as Adsmetor tutor features.

---

## 8. Open questions

| # | Question | Why it matters | Proposed default |
|---|---|---|---|
| Q1 | Can we get 6 to 10 reference screenshots (app bar, nav both modes, Campaigns grid, New campaign form, slide-over, date picker, Intelligence panel) into `docs/screenshots/` so colours, radii and sizes can be sampled? | All hex and px values here are not measured (see top caveat) | Keep Material-based values; correct after the first SOP-3 pass |
| Q2 | Is the active nav pill light blue (`#e8f0fe`) or a stronger filled blue? The explore note says "filled blue pill". | Visible on every page | Light blue fill, dark blue text |
| Q3 | Are buttons 4 px rounded or fully rounded in the current DV360 skin? | Affects every button | 4 px (`shape.button` token makes it a one-line change) |
| Q4 | Final heading font: Figtree (brand aligned) or Roboto only (closest to what students see)? | Fidelity versus brand | Figtree for titles, Roboto elsewhere |
| Q5 | Grid engine: TanStack Table (recommended) or MUI X Data Grid Pro licence? | Sticky columns, trees and grouping need Pro in MUI X | TanStack Table + own cells |
| Q6 | Nav widths (256 / 72) and right panel width (360 / 400) are estimates. Confirm from screenshots. | Layout shift on every page | As listed in 1.3 |
| Q7 | Dark mode: not seen in the reference. Out of scope? | Doubles the token work | Out of scope for v1 |
| Q8 | Adsmetor logo files (SVG, light background, 28 px lockup and 48 px login) are not in the repo. Who supplies them? | App bar and login | Text-only wordmark placeholder until provided |
| Q9 | How does a user switch advertiser? Reference crumbs were not switchers (01 open question). | Breadcrumb component behaviour | Crumb click opens the Partner Advertisers list; no dropdown switcher |
| Q10 | Number and date locale: reference shows ₹ with Indian and US styles mixed ("₹450K", "₹12,000.00", "Mar 1, 2026"). Use `en-IN` or `en-US` formatting? | All grids and charts | `en-US` separators with the advertiser currency symbol, dates "Mar 1, 2026" |
| Q11 | Should Adsmetor brand colours (black/yellow) appear anywhere in the working UI? | Brand versus fidelity | No; logo and login only |
| Q12 | The AI-looking features (search overlay, Ask Advisor, "Help me select…", report generation, custom chart prompt) need an engine: canned answers, a real model call, or hidden? | Component scope and cost | Canned answers with a visible "Tutor" label, real model later |
| Q13 | Show a "Sandbox" or "Instructor view" indicator? | Student clarity | Small grey chip in the app bar for instructors only |
| Q14 | Is the "Limited Access" chip reproduced? It appears on the demo login only because of limited permissions. | Fidelity versus meaning | Reproduce as the Read only role indicator |
| Q15 | Exact preset lists for the date picker per page (02 vs 16 differ). | Component props | Two preset sets: `grid` and `history` |
| Q16 | Row height: 40 px assumed; the reference grid may be 48 px. | Density of every grid | 40 px, compact |
| Q17 | Icon look-alikes: Intelligence orbit, Ask Advisor sparkle-search and LI type icons are not exact Material Symbols matches. Accept the closest ones in Section 3? | Visual fidelity | Accept; log as "approved deviation" in SOP-3 |
| Q18 | Illustration set for empty states and the 3×3 LI type picker: who draws it? | Several screens | Simple two-colour Adsmetor line art, produced in P3-04 |
| Q19 | Map for Geography targeting: static SVG regions or a free tile source (OpenStreetMap, allowed by its licence with attribution)? | Geo editor | Static SVG map of countries and a search list; no tiles in v1 |
| Q20 | Responsive scope: is the 1024 to 1279 fallback needed for the classroom hardware, or is 1280 a hard minimum? | Testing effort | Keep fallback, but only 1280+ is a fidelity target |
