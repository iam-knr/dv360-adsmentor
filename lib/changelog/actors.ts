// System actor constants (data-model 6.3 item 7, module 05 4.4).
export const SYSTEM_ACTORS = [
  'SIM_ENGINE',
  'CREATIVE_APPROVAL_SYNC',
  'DFA_TAG_VALIDATION_SYNC',
  'PARTNER_SETTING_UPDATER',
  'SIM_SCENARIO_LOADER',
  'SIM_INSTRUCTOR',
  'SIM_SEED',
] as const;

export type SystemActor = (typeof SYSTEM_ACTORS)[number];

export type ChangeActorRef =
  { type: 'USER'; userId: string; label: string } | { type: 'SYSTEM'; systemActor: SystemActor };

/** Labels students see for system actors. SIM_SEED is never shown (its groups are hidden). */
export const SYSTEM_ACTOR_LABELS: Record<SystemActor, string | null> = {
  SIM_ENGINE: 'Simulator engine',
  CREATIVE_APPROVAL_SYNC: 'CREATIVE_APPROVAL_SYNC',
  DFA_TAG_VALIDATION_SYNC: 'DFA_TAG_VALIDATION_SYNC',
  PARTNER_SETTING_UPDATER: 'PARTNER_SETTING_UPDATER',
  SIM_SCENARIO_LOADER: 'Scenario',
  SIM_INSTRUCTOR: 'Instructor',
  SIM_SEED: null,
};

/** Seed writes are stored but hidden from every History view (module 05 4.5). */
export function isHiddenActor(actor: ChangeActorRef): boolean {
  return actor.type === 'SYSTEM' && actor.systemActor === 'SIM_SEED';
}

export function actorLabel(actor: ChangeActorRef): string | null {
  return actor.type === 'USER' ? actor.label : SYSTEM_ACTOR_LABELS[actor.systemActor];
}
