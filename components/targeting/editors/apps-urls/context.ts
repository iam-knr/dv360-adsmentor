'use client';

import { createContext, useContext } from 'react';
import type { VerificationProvider } from '@/lib/targeting/types';

/**
 * What the advanced editors read from the form around the card. All fields are optional: without a provider the
 * editors behave as on a bare dev page (no URL suggestions, every verification service enabled, first advertiser).
 */
export interface TargetingEditorContextValue {
  advertiserId?: string;
  /** Public ids, for the "create a custom list" links of the audience picker. */
  partnerPublicId?: string;
  advertiserPublicId?: string;
  /** Campaign landing page URLs and keywords: the URL suggestions card shows only when one exists (AC-10-05). */
  landingUrls?: string[];
  campaignKeywords?: string[];
  /** Providers turned on in Advertiser settings, Third-party services (TGT-092). Absent = all on. */
  enabledProviders?: VerificationProvider[];
  /** Currency symbol for indicative CPMs. */
  currencySymbol?: string;
  /** Flight length in days for the Impressions summary. */
  flightDays?: number;
}

export const TargetingEditorContext = createContext<TargetingEditorContextValue>({});
export const useTargetingEditorContext = () => useContext(TargetingEditorContext);
