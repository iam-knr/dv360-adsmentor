// TPL rules: targeting templates (validation.md 2.17). The entity is the template form input (module 10 4.0).
import type { TargetingState } from '@/lib/targeting/types';
import { LI_TYPE_LABEL, type LiType } from '../constants/li-compat';
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import { isBlank } from '../primitives';
import type { AnyRule, Rule } from '../types';

export interface TargetingTemplateInput {
  type: LiType | null;
  name: string;
  description?: string | null;
  targeting: TargetingState;
  optimizedTargeting?: boolean;
  /** Advertiser-locked dimensions the template tried to change. */
  lockedRowsChanged?: string[];
  /** Line item type the template is being applied to (apply and bulk apply). */
  applyToType?: LiType | null;
}

/** Template types of MX-10 (TPL-002). */
export const TEMPLATE_TYPES: readonly LiType[] = [
  'DISPLAY',
  'VIDEO',
  'AUDIO',
  'CTV',
  'DEMAND_GEN',
  'YT_VIDEO',
];

const def = (rule: Omit<Rule<TargetingTemplateInput>, 'kind'>): AnyRule =>
  ({ kind: 'targetingTemplate', ...rule }) as unknown as AnyRule;

export const templateRules: readonly AnyRule[] = [
  def({
    id: 'TPL-001',
    severity: 'error',
    triggers: ['save'],
    reads: ['type'],
    message: MSG.SELECTION_REQUIRED,
    check: (t) => (t.type ? null : { path: 'type' }),
  }),
  def({
    id: 'TPL-002',
    severity: 'info',
    triggers: [],
    reads: ['type'],
    message: "Targeting templates aren't available for {Type} line items.",
    check: (t) =>
      t.type && !TEMPLATE_TYPES.includes(t.type)
        ? { path: 'type', params: { Type: LI_TYPE_LABEL[t.type] } }
        : null,
  }),
  def({
    id: 'TPL-003',
    severity: 'error',
    triggers: ['blur', 'save'],
    reads: ['name'],
    message: MSG.ENTER_VALUE,
    check: (t) => (isBlank(t.name) ? { path: 'name' } : null),
  }),
  def({
    id: 'TPL-004',
    severity: 'error',
    triggers: ['save'],
    reads: ['name'],
    message: MSG.MAX_CHARS,
    check: (t) =>
      t.name.length > LIMITS.NAME_MAX_240
        ? { path: 'name', params: { max: LIMITS.NAME_MAX_240 } }
        : null,
  }),
  def({
    id: 'TPL-005',
    severity: 'error',
    triggers: ['save'],
    reads: ['description'],
    message: MSG.MAX_CHARS,
    check: (t) =>
      (t.description ?? '').length > LIMITS.TEMPLATE_DESC_MAX
        ? { path: 'description', params: { max: LIMITS.TEMPLATE_DESC_MAX } }
        : null,
  }),
  def({
    id: 'TPL-006',
    severity: 'error',
    triggers: ['save'],
    reads: ['lockedRowsChanged'],
    message: MSG.TARGETING_LOCKED_ADV,
    check: (t) => ((t.lockedRowsChanged ?? []).length > 0 ? { path: 'targeting' } : null),
  }),
  def({
    id: 'TPL-007',
    severity: 'error',
    triggers: ['save'],
    reads: ['applyToType', 'type'],
    message: 'This template is for {Type} line items.',
    check: (t) =>
      t.type && t.applyToType && t.applyToType !== t.type
        ? { path: 'applyToType', params: { Type: LI_TYPE_LABEL[t.type] } }
        : null,
  }),
];
