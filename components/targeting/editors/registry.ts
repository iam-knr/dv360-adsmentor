// Card registry of the advanced editors (P3-07b): one line per dimension. The card renders these where
// `EditorBody` has no built-in editor, and asks `advancedEditorError` whether Apply may proceed.
import type { ComponentType } from 'react';
import type { MatrixDimension } from '@/lib/validation/constants/targeting-availability';
import type { TargetingCriteria } from '@/lib/targeting/types';
import type { EditorProps } from './editors';
import type { TargetingEditorContextValue } from './apps-urls/context';
import { AppsUrlsEditor } from './apps-urls/AppsUrlsEditor';
import { BrandSuitabilityEditor } from './brand/BrandSuitabilityEditor';
import { brandError } from './brand/verification-options';
import { DvAudienceBuilder, audienceError } from './audience/DvAudienceBuilder';
import { GeographyEditor, geographyError } from './geography/GeographyEditor';

export const ADVANCED_EDITORS: Partial<Record<MatrixDimension, ComponentType<EditorProps>>> = {
  GEOGRAPHY: GeographyEditor,
  APPS_URLS: AppsUrlsEditor,
  BRAND_SUITABILITY: BrandSuitabilityEditor,
  AUDIENCE_LISTS: DvAudienceBuilder,
};

/** Slide-over width per editor: the audience builder shows two panes, geography a map. */
export const ADVANCED_WIDTH: Partial<Record<MatrixDimension, 'wide' | 'xwide'>> = {
  GEOGRAPHY: 'wide',
  AUDIENCE_LISTS: 'xwide',
};

/** Error text that blocks Apply for an advanced editor, or null (TGT-012, TGT-091, TGT-092, TGT-100). */
export function advancedEditorError(
  dim: MatrixDimension,
  c: TargetingCriteria,
  ctx: TargetingEditorContextValue = {},
): string | null {
  switch (dim) {
    case 'GEOGRAPHY':
      return geographyError(c);
    case 'BRAND_SUITABILITY':
      return brandError(c.brandSuitability, ctx.enabledProviders);
    case 'AUDIENCE_LISTS':
      return audienceError(c.audienceLists);
    default:
      return null;
  }
}
