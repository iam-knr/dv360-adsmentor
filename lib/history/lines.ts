// Display lines of stored entries (module 05 4.4): look up the registry field of a stored `fieldPath`, then render.
import type { EntityType } from '@prisma/client';
import { SYSTEM_ACTOR_LABELS, type SystemActor } from '@/lib/changelog/actors';
import { getRegistry } from '@/lib/changelog/registries';
import type { EntityRegistry, FieldDef } from '@/lib/changelog/registry-types';
import { renderLine, type StoredEntry } from '@/lib/changelog/render';

/** Registry of a type, or null for a type without one (such groups still render with default formatting). */
export function registryOrNull(type: EntityType): EntityRegistry | null {
  try {
    return getRegistry(type);
  } catch {
    return null;
  }
}

/** `budgetSegments[k].amount` -> the child field `amount` of list `budgetSegments`. */
export function fieldDefFor(registry: EntityRegistry | null, fieldPath: string): FieldDef | undefined {
  if (!registry) return undefined;
  const nested = /^([^[\]]+)\[[^\]]*\](?:\.(.+))?$/.exec(fieldPath);
  if (!nested) return registry.fields.find((f) => f.path === fieldPath);
  const list = registry.fields.find((f) => f.path === nested[1]);
  if (!nested[2]) return list;
  return list?.childFields?.find((c) => c.path === nested[2]);
}

export function entryLines(registry: EntityRegistry | null, entries: StoredEntry[]): string[] {
  return entries.map((e) => renderLine(e, fieldDefFor(registry, e.fieldPath)));
}

/**
 * Who made a change: the user's display name, or the system actor's label (SIM_SEED rows are hidden and never reach
 * here). Rows written with an email label read as the viewer's display name when the viewer made the change (Q15).
 */
export function actorText(
  g: {
    actorType: 'USER' | 'SYSTEM';
    actorLabel: string | null;
    systemActor: string | null;
    userId?: string | null;
  },
  viewer?: { id: string; name: string | null } | null,
): string {
  if (g.actorType === 'USER') {
    if (viewer?.name && g.userId && g.userId === viewer.id) return viewer.name;
    return g.actorLabel ?? 'Unknown';
  }
  return SYSTEM_ACTOR_LABELS[g.systemActor as SystemActor] ?? g.systemActor ?? 'System';
}

const TYPE_NOUN: Partial<Record<EntityType, string>> = {
  PARTNER: 'partner',
  ADVERTISER: 'advertiser',
  CAMPAIGN: 'campaign',
  INSERTION_ORDER: 'insertion order',
  LINE_ITEM: 'line item',
  AD_GROUP: 'ad group',
  AD: 'ad',
  CREATIVE: 'creative',
  AUDIENCE: 'audience',
  CHANNEL: 'channel',
  KEYWORD_LIST: 'keyword list',
  LOCATION_LIST: 'location list',
  DEAL: 'deal',
  FLOODLIGHT_GROUP: 'Floodlight group',
  FLOODLIGHT_ACTIVITY: 'Floodlight activity',
  CUSTOM_BIDDING_ALGORITHM: 'custom bidding algorithm',
  TARGETING_TEMPLATE: 'targeting template',
  EXPERIMENT: 'experiment',
  LIFT_STUDY: 'lift study',
  REPORT: 'report',
  PLAN: 'plan',
};

export const entityNoun = (t: EntityType): string => TYPE_NOUN[t] ?? t.toLowerCase().split('_').join(' ');
