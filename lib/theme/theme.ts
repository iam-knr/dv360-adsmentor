import type { CSSProperties } from 'react';
import { createTheme, alpha, type Shadows } from '@mui/material/styles';
import {
  breakpoints,
  colors,
  fonts,
  radii,
  shadows as shadowLevels,
  sizes,
  zLayers,
} from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    status: Record<'active' | 'warning' | 'atRisk' | 'error' | 'paused' | 'draft' | 'info', string>;
    statusText: Record<'active' | 'warning' | 'error' | 'paused' | 'info', string>;
    nav: { activeBg: string; activeText: string; hoverBg: string; newDot: string };
    banner: Record<
      'info' | 'warning' | 'error' | 'success',
      { bg: string; fg: string; icon: string }
    >;
    surface: { sunken: string; selected: string; scrim: string; skeleton: string };
    link: string;
    chart: string[];
    toast: { bg: string; action: string };
  }
  interface PaletteOptions {
    status?: Partial<Palette['status']>;
    statusText?: Partial<Palette['statusText']>;
    nav?: Partial<Palette['nav']>;
    banner?: Partial<Palette['banner']>;
    surface?: Partial<Palette['surface']>;
    link?: string;
    chart?: string[];
    toast?: Partial<Palette['toast']>;
  }
  interface TypographyVariants {
    pageTitle: CSSProperties;
    cardTitle: CSSProperties;
    panelOverline: CSSProperties;
    kpiValue: CSSProperties;
    kpiValueSmall: CSSProperties;
    tableCell: CSSProperties;
    tableHeader: CSSProperties;
    badge: CSSProperties;
    mono: CSSProperties;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation needs an interface
  interface TypographyVariantsOptions extends Partial<TypographyVariants> {}
  interface ZIndex {
    gridStickyColumn: number;
    gridStickyHeader: number;
    gridCorner: number;
    stickyFooter: number;
    bulkBar: number;
    nav: number;
    rightPanel: number;
    slideOver: number;
    searchOverlay: number;
    popover: number;
    toast: number;
  }
  interface Theme {
    custom: {
      appBarHeight: number;
      navWidth: number;
      navRailWidth: number;
      railWidth: number;
      panelWidth: number;
      footerHeight: number;
      rowHeight: number;
    };
  }
  interface ThemeOptions {
    custom?: Partial<Theme['custom']>;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    cardTitle: true;
    panelOverline: true;
    kpiValue: true;
    kpiValueSmall: true;
    tableCell: true;
    tableHeader: true;
    badge: true;
    mono: true;
  }
}

const { primary, text, divider, dividerStrong, surface, banner } = colors;
const line = divider;
const focusRing = `2px solid ${primary.main}`;

export const theme = createTheme({
  spacing: 4,
  breakpoints: { values: { ...breakpoints } },
  shape: { borderRadius: radii.input },
  custom: {
    appBarHeight: sizes.appBarHeight,
    navWidth: sizes.navWidth,
    navRailWidth: sizes.navRailWidth,
    railWidth: sizes.railWidth,
    panelWidth: sizes.panelWidth,
    footerHeight: sizes.footerHeight,
    rowHeight: sizes.rowHeight,
  },
  palette: {
    mode: 'light',
    primary: { ...primary },
    secondary: { main: text.secondary },
    error: { main: colors.status.error, dark: colors.statusText.error, light: banner.error.bg },
    warning: {
      main: colors.status.warning,
      dark: colors.statusText.warning,
      light: banner.warning.bg,
    },
    success: {
      main: colors.status.active,
      dark: colors.statusText.active,
      light: banner.success.bg,
    },
    info: { main: primary.main, dark: banner.info.fg, light: banner.info.bg },
    text: { primary: text.primary, secondary: text.secondary, disabled: text.disabled },
    divider: line,
    background: { ...colors.background },
    action: {
      hover: surface.sunken,
      selected: surface.selected,
      disabledBackground: surface.sunken,
      disabled: text.disabled,
      focus: alpha(primary.main, 0.12),
    },
    status: { ...colors.status },
    statusText: { ...colors.statusText },
    nav: { ...colors.nav },
    banner: {
      info: { ...banner.info },
      warning: { ...banner.warning },
      error: { ...banner.error },
      success: { ...banner.success },
    },
    surface: { ...surface },
    link: colors.link,
    chart: [...colors.chart],
    toast: { ...colors.toast },
  },
  shadows: [...shadowLevels, ...Array<string>(20).fill(shadowLevels[4])] as unknown as Shadows,
  zIndex: {
    mobileStepper: 1000,
    fab: 1050,
    speedDial: 1050,
    gridStickyColumn: zLayers.gridStickyColumn,
    gridStickyHeader: zLayers.gridStickyHeader,
    gridCorner: zLayers.gridCorner,
    stickyFooter: zLayers.stickyFooter,
    bulkBar: zLayers.bulkBar,
    nav: zLayers.nav,
    appBar: zLayers.appBar,
    rightPanel: zLayers.rightPanel,
    drawer: zLayers.slideOver,
    slideOver: zLayers.slideOver,
    modal: zLayers.modal,
    searchOverlay: zLayers.searchOverlay,
    popover: zLayers.popover,
    snackbar: zLayers.toast,
    toast: zLayers.toast,
    tooltip: zLayers.tooltip,
  },
  typography: {
    fontFamily: fonts.text,
    fontSize: 14,
    h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: '36px', fontWeight: 400 },
    h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: '32px', fontWeight: 400 },
    h3: { fontFamily: fonts.display, fontSize: 22, lineHeight: '28px', fontWeight: 400 },
    h4: { fontFamily: fonts.display, fontSize: 20, lineHeight: '28px', fontWeight: 400 },
    h5: { fontFamily: fonts.display, fontSize: 18, lineHeight: '24px', fontWeight: 500 },
    h6: { fontFamily: fonts.display, fontSize: 20, lineHeight: '28px', fontWeight: 400 },
    subtitle1: { fontFamily: fonts.display, fontSize: 14, lineHeight: '20px', fontWeight: 500 },
    subtitle2: { fontSize: 13, lineHeight: '20px', fontWeight: 500 },
    body1: { fontSize: 14, lineHeight: '20px', fontWeight: 400 },
    body2: { fontSize: 13, lineHeight: '20px', fontWeight: 400, color: text.secondary },
    caption: { fontSize: 12, lineHeight: '16px', fontWeight: 400, color: text.secondary },
    button: {
      fontFamily: fonts.display,
      fontSize: 14,
      lineHeight: '20px',
      fontWeight: 500,
      letterSpacing: '0.25px',
      textTransform: 'none',
    },
    pageTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: '28px', fontWeight: 400 },
    cardTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: '24px', fontWeight: 500 },
    panelOverline: {
      fontSize: 11,
      lineHeight: '16px',
      fontWeight: 500,
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      color: text.secondary,
    },
    kpiValue: {
      fontFamily: fonts.display,
      fontSize: 28,
      lineHeight: '36px',
      fontWeight: 400,
      fontVariantNumeric: 'tabular-nums',
    },
    kpiValueSmall: {
      fontFamily: fonts.display,
      fontSize: 20,
      lineHeight: '28px',
      fontWeight: 400,
      fontVariantNumeric: 'tabular-nums',
    },
    tableCell: {
      fontSize: 12,
      lineHeight: '16px',
      fontWeight: 400,
      color: colors.tableText,
      fontVariantNumeric: 'tabular-nums',
    },
    tableHeader: { fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.tableText },
    badge: {
      fontSize: 10,
      lineHeight: '14px',
      fontWeight: 500,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: '16px' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background.default,
          color: text.primary,
          WebkitFontSmoothing: 'antialiased',
          minWidth: breakpoints.md,
        },
        a: { color: colors.link, textDecoration: 'none' },
        'a:hover': { textDecoration: 'underline' },
        ':focus-visible': { outline: focusRing, outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': {
          '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
        },
        '@media (forced-colors: active)': {
          ':focus-visible': { outline: '2px solid CanvasText' },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { height: sizes.buttonHeight, borderRadius: radii.button, padding: '0 16px' },
        // Real DV360 primary button: Google Sans 14/500, 36 high, padding 9px 24px (CAM-031).
        contained: { padding: '9px 24px', lineHeight: '18px' },
        sizeSmall: { height: sizes.buttonHeightSmall, padding: '0 12px' },
        containedSizeSmall: { padding: '0 12px' },
        outlined: {
          borderColor: colors.outlineStrong,
          color: primary.main,
          '&:hover': { borderColor: colors.outlineStrong, backgroundColor: colors.outlinedHoverBg },
        },
        text: { padding: '0 8px' },
        containedPrimary: {
          '&.Mui-disabled': { backgroundColor: surface.skeleton, color: text.disabled },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { color: text.secondary, '&:hover': { backgroundColor: colors.hoverOverlay } },
      },
    },
    MuiOutlinedInput: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          height: sizes.inputHeight,
          borderRadius: radii.input,
          backgroundColor: colors.background.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: line },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dividerStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: primary.main,
            borderWidth: 2,
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.status.error,
            borderWidth: 2,
          },
          '&.Mui-disabled': { backgroundColor: surface.sunken },
        },
        multiline: { height: 'auto' },
        input: { padding: '0 12px', fontSize: 14 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14, color: text.secondary } } },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 0,
          marginTop: 4,
          fontSize: 12,
          lineHeight: '16px',
          '&.Mui-error': { color: colors.statusText.error },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: sizes.chipHeight,
          borderRadius: radii.chip,
          fontSize: 13,
          color: text.primary,
        },
        outlined: { borderColor: line, backgroundColor: colors.background.paper },
        sizeSmall: { height: sizes.statusChipHeight },
        deleteIcon: { fontSize: 16, color: text.secondary },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 48, borderBottom: `1px solid ${line}` },
        indicator: { height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          minWidth: 0,
          padding: '0 16px',
          color: text.secondary,
          '&.Mui-selected': { color: primary.main },
          '&:hover': { backgroundColor: surface.sunken },
          '&.Mui-focusVisible': { outline: `2px solid ${primary.main}`, outlineOffset: -2 },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { enterDelay: 500, enterNextDelay: 200 },
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.tooltipBg,
          fontSize: 12,
          lineHeight: '16px',
          padding: '6px 8px',
          borderRadius: radii.tooltip,
          maxWidth: 240,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: radii.card,
          boxShadow: shadowLevels[2],
          border: `1px solid ${line}`,
        },
      },
    },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 40, fontSize: 14 } } },
    MuiPopover: {
      styleOverrides: { paper: { borderRadius: radii.card, boxShadow: shadowLevels[2] } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radii.dialog, boxShadow: shadowLevels[4] } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: fonts.display,
          fontSize: 20,
          lineHeight: '28px',
          fontWeight: 400,
          padding: '20px 24px 8px',
        },
      },
    },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px' } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: surface.scrim } } },
    MuiDrawer: {
      styleOverrides: { paperAnchorRight: { boxShadow: shadowLevels[3], borderRadius: 0 } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: `1px solid ${line}`, borderRadius: radii.card } },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: sizes.navItemHeight,
          borderRadius: radii.pill,
          margin: '0 8px',
          padding: '0 16px',
          '&:hover': { backgroundColor: colors.nav.hoverBg },
          '&.Mui-selected': {
            backgroundColor: colors.nav.activeBg,
            color: colors.nav.activeText,
            '&:hover': { backgroundColor: colors.nav.activeBg },
            '& .MuiListItemIcon-root': { color: colors.nav.activeText },
          },
          '&.Mui-focusVisible': { outline: `2px solid ${primary.main}`, outlineOffset: -2 },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 40, color: text.secondary } } },
    MuiCheckbox: { styleOverrides: { root: { padding: 8, color: text.secondary } } },
    MuiRadio: { styleOverrides: { root: { padding: 8, color: text.secondary } } },
    MuiSwitch: { styleOverrides: { root: { padding: 8 } } },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 4, backgroundColor: colors.progressTrack } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radii.card, padding: '8px 16px', fontSize: 14, alignItems: 'center' },
        standardInfo: {
          backgroundColor: banner.info.bg,
          color: banner.info.fg,
          '& .MuiAlert-icon': { color: banner.info.icon },
        },
        standardWarning: {
          backgroundColor: banner.warning.bg,
          color: banner.warning.fg,
          '& .MuiAlert-icon': { color: banner.warning.icon },
        },
        standardError: {
          backgroundColor: banner.error.bg,
          color: banner.error.fg,
          '& .MuiAlert-icon': { color: banner.error.icon },
        },
        standardSuccess: {
          backgroundColor: banner.success.bg,
          color: banner.success.fg,
          '& .MuiAlert-icon': { color: banner.success.icon },
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: colors.toast.bg,
          color: text.inverse,
          borderRadius: radii.tooltip,
          boxShadow: shadowLevels[4],
          fontSize: 14,
        },
      },
    },
    MuiTypography: {
      // subtitle1 and subtitle2 are labels, not headings: do not emit h6.
      defaultProps: { variantMapping: { subtitle1: 'p', subtitle2: 'p' } },
    },
    MuiSlider: { styleOverrides: { root: { height: 4 }, thumb: { width: 16, height: 16 } } },
  },
});
