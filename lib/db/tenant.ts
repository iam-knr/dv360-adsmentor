// Multi-tenant access (data-model 2.2). Every request that touches tenant tables runs in one interactive
// transaction that carries the sandbox id. With RLS_ENABLED (default on) the transaction also switches to the
// NOLOGIN role app_tenant, so Postgres itself refuses rows of another sandbox even if a query forgets its filter.
import type { Prisma } from '@prisma/client';
import { prisma } from './client';

export type Tx = Prisma.TransactionClient;

export interface TxOptions {
  /** Milliseconds the transaction may wait for a connection. */
  maxWait?: number;
  /** Milliseconds the transaction may run. */
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

const DEFAULT_OPTIONS: TxOptions = { maxWait: 10_000, timeout: 30_000 };

/** RLS_ENABLED=false is the documented fallback (build-plan F-4): queries must then filter by sandboxId in the service layer. */
export function rlsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.RLS_ENABLED?.trim().toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off');
}

export class TenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantContextError';
  }
}

/**
 * Run `fn` in a transaction scoped to one sandbox. Sets `app.sandbox_id` for the transaction (SET LOCAL semantics)
 * and, when RLS is on, switches to role app_tenant for it. The role and the setting end with the transaction.
 */
export async function withSandbox<T>(
  sandboxId: string,
  fn: (tx: Tx) => Promise<T>,
  options: TxOptions = {},
  client: Pick<typeof prisma, '$transaction'> = prisma,
): Promise<T> {
  if (!sandboxId || typeof sandboxId !== 'string') {
    throw new TenantContextError('withSandbox needs a sandbox id');
  }
  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.sandbox_id', ${sandboxId}, true)`;
      if (rlsEnabled()) await tx.$executeRaw`SET LOCAL ROLE app_tenant`;
      return fn(tx);
    },
    { ...DEFAULT_OPTIONS, ...options },
  );
}

/**
 * Run `fn` as the engine or an instructor job: all sandboxes visible (role app_engine, policy engine_access).
 * Only for code paths that are allowed to cross sandboxes. Never call it from a request made by a student.
 */
export async function withBypass<T>(
  fn: (tx: Tx) => Promise<T>,
  options: TxOptions = {},
  client: Pick<typeof prisma, '$transaction'> = prisma,
): Promise<T> {
  return client.$transaction(
    async (tx) => {
      if (rlsEnabled()) await tx.$executeRaw`SET LOCAL ROLE app_engine`;
      return fn(tx);
    },
    { ...DEFAULT_OPTIONS, ...options },
  );
}
