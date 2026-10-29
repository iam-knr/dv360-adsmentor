import 'server-only';

/**
 * Stub until M18-05 (the sandbox provisioning job) lands. It records "NOT CREATED": no Sandbox row is written, so the
 * account detail page shows Sandbox "NOT CREATED" (module 19 4.10, section 5).
 */
export function enqueueProvisionSandbox(
  _cohortId: string,
  _userId: string,
): Promise<{ state: 'NOT_CREATED' }> {
  return Promise.resolve({ state: 'NOT_CREATED' });
}
