// Session users for the service tests: the world's student as STANDARD or READ_ONLY (synthetic data only).
import type { SessionUser } from '@/lib/auth/types';
import type { CampaignWire } from '@/lib/campaigns/wire';
import { newCampaignValue } from '@/lib/campaigns/wire';
import type { World } from '../../db/helpers';

export function userOf(w: World, dvRole: SessionUser['dvRole'] = 'STANDARD'): SessionUser {
  return {
    id: w.userId,
    email: `${w.tag}-user@example.test`,
    name: 'Test Student',
    appRole: 'user',
    classroomId: w.classroomId,
    sandboxId: w.sandboxId,
    partnerId: w.partnerId,
    dvRole,
  };
}

/** The world's sim clock starts 2026-01-01 (tick 0), so "today" is 2026-01-01. */
export const SIM_TODAY = '2026-01-01';

export function validCampaignWire(over: Partial<CampaignWire> = {}): CampaignWire {
  return {
    ...newCampaignValue(SIM_TODAY),
    name: 'Diwali awareness',
    goal: 'AWARENESS',
    kpi: { type: 'CPM', value: 50, otherText: '' },
    creativeTypes: ['DISPLAY'],
    ...over,
  };
}
