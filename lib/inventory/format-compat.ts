// MX-09 extension (module 13 Δ13-12): which line item types accept which package or deal format.
import type { InventoryFormat, LineItemType } from '@prisma/client';

const COMPAT: Record<InventoryFormat, readonly LineItemType[]> = {
  DISPLAY: ['DISPLAY', 'ADS_IN_MOBILE_APPS', 'MOBILE_APP_INSTALL'],
  VIDEO: ['VIDEO', 'CTV', 'ADS_IN_MOBILE_APPS'],
  AUDIO: ['AUDIO'],
};

export const LINE_ITEM_TYPE_LABEL: Record<LineItemType, string> = {
  DISPLAY: 'Display',
  VIDEO: 'Video',
  CTV: 'Connected TV',
  AUDIO: 'Audio',
  MOBILE_APP_INSTALL: 'App install',
  ADS_IN_MOBILE_APPS: 'Ads in mobile apps',
  YT_VIDEO: 'YouTube video',
  YT_AUDIO: 'YouTube audio',
  YT_ON_CTV: 'YouTube on CTV',
  DEMAND_GEN: 'Demand Gen',
  DOOH_DISPLAY: 'DOOH display',
  DOOH_VIDEO: 'DOOH video',
};

export function formatFitsLineItem(format: InventoryFormat, type: LineItemType): boolean {
  return COMPAT[format].includes(type);
}

export const FORMAT_LABEL: Record<InventoryFormat, string> = {
  DISPLAY: 'Display',
  VIDEO: 'Video',
  AUDIO: 'Audio',
};
