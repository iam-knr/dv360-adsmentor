// Display vocabulary for a sandbox build (admin polish S8). One word set everywhere an admin reads a state: the account
// list, the account page, the audit log and the JSON API. Display only: the database states and the ProvisionView
// states keep their names.
export type SandboxStateLabel = 'Not created' | 'Queued' | 'Building' | 'Ready' | 'Failed';

const BY_STATE: Record<string, SandboxStateLabel> = {
  // ProvisionView.state
  NOT_CREATED: 'Not created',
  QUEUED: 'Queued',
  BUILDING: 'Building',
  READY: 'Ready',
  FAILED: 'Failed',
  // Sandbox.provisionState (database)
  PENDING: 'Queued',
  SEEDING: 'Building',
  BACKFILLING: 'Building',
};

/** Queued, Building, Ready, Failed (or Not created) for any provisioning state name. Unknown values read as Building. */
export function sandboxStateLabel(state: string | null | undefined): SandboxStateLabel {
  if (!state) return 'Not created';
  return BY_STATE[state] ?? 'Building';
}

/** Text an admin can read for a FAILED sandbox. The raw message stays available as "Details". */
export const FAILED_SANDBOX_MESSAGE =
  'The sandbox could not be built. Try Retry; if it fails again check the Engine page / logs.';

/** "1m 05s" / "42s" for the build timer. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
