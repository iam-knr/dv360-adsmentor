// Ambient change-log context for bulk jobs and SDF uploads (module 11 3.2, 4.7, C-11-18). A bulk worker calls the
// same single-entity services as the forms; those services build their own `ChangeCtx`, so the job id and the
// source travel in an AsyncLocalStorage that `withChangeLog` reads when the context sets neither.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ChangeSource } from '@prisma/client';

export interface AmbientChange {
  source: ChangeSource;
  bulkJobId: string;
}

const store = new AsyncLocalStorage<AmbientChange>();

export function runWithAmbient<T>(ambient: AmbientChange, fn: () => Promise<T>): Promise<T> {
  return store.run(ambient, fn);
}

export function ambientChange(): AmbientChange | undefined {
  return store.getStore();
}
