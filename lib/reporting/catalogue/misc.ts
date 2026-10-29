// Digital Out Of Home (8), Rich Media (14), TV (8), CM360 (6): stubs that exist in the picker with zero values, except
// Rich Media Engagements. Inventory Availability (9) is the offline-only category (the 34th).
import { counter, entityDim, sliceDim, zeroMetric } from './generators';
import type { ReportFieldDef } from './types';

const D = 'Digital Out Of Home' as const;
export function doohFields(): ReportFieldDef[] {
  return [
    'DOOH Impressions',
    'DOOH Plays',
    'DOOH Audience Impressions',
    'DOOH Venue Impressions',
    'DOOH Share of Voice',
    'DOOH Cost per Play',
    'DOOH Unique Screens',
    'DOOH Dwell Seconds',
  ].map((l) => zeroMetric(D, l));
}

const R = 'Rich Media' as const;
export function richMediaFields(): ReportFieldDef[] {
  return [
    counter(R, 'Rich Media Engagements', 'engagements'),
    ...[
      'Rich Media Interactions',
      'Rich Media Expansions',
      'Rich Media Video Plays',
      'Rich Media Video Completions',
      'Rich Media Average Interaction Time',
      'Rich Media Average Expansion Time',
      'Rich Media Full Screen Views',
      'Rich Media Custom Counters',
      'Rich Media Exits',
      'Rich Media Manual Closes',
      'Rich Media Timers',
      'Rich Media Backup Image Impressions',
      'Rich Media Dwell Time',
    ].map((l) => zeroMetric(R, l)),
  ];
}

const T = 'TV' as const;
export function tvFields(): ReportFieldDef[] {
  return [
    'TV Impressions',
    'TV GRPs',
    'TV Reach',
    'TV Average Frequency',
    'TV Spots',
    'TV Cost',
    'TV Unique Households',
    'TV Linear Dedup Share',
  ].map((l) => zeroMetric(T, l));
}

const C = 'CM360' as const;
export function cm360Fields(): ReportFieldDef[] {
  return [
    'CM360 Impressions',
    'CM360 Clicks',
    'CM360 Total Conversions',
    'CM360 Click-Through Conversions',
    'CM360 View-Through Conversions',
    'CM360 Active View Viewable Impressions',
  ].map((l) => zeroMetric(C, l));
}

const IA = 'Inventory Availability' as const;
export function inventoryAvailabilityFields(): ReportFieldDef[] {
  const off = { offline: ['INVENTORY_AVAILABILITY' as const], offlineOnly: true };
  return [
    sliceDim(IA, 'Availability Exchange', 'exchange', 'name', 'STRING', off),
    sliceDim(IA, 'Availability Inventory Source', 'deal', 'name', 'STRING', off),
    sliceDim(IA, 'Availability Device Type', 'device', undefined, 'STRING', off),
    sliceDim(IA, 'Availability Environment', 'environment', undefined, 'STRING', off),
    sliceDim(IA, 'Availability Format', 'format', undefined, 'STRING', off),
    sliceDim(IA, 'Availability Country', 'region', 'country', 'STRING', off),
    counter(IA, 'Available Impressions', 'bidRequests', off),
    counter(IA, 'Bid-able Impressions', 'eligibleRequests', off),
    zeroMetric(IA, 'Average Floor CPM', 'DECIMAL', off),
  ];
}

export { entityDim };
