'use client';

// Leave guard for in-app links (routes.md 5.4 "Unsaved Changes modal", trigger B). A dirty form calls
// `useUnsavedGuard(isDirty)`; `AppLink` asks `confirmLeave` before it navigates. The shell registers the dialog
// (DLG-01) with `setLeaveConfirmer`. Browser Back and tab close stay with `useUnsavedChanges` (lib/validation).
import { useEffect } from 'react';

type Confirmer = (proceed: () => void) => void;

let dirtyCount = 0;
let confirmer: Confirmer | null = null;

export function hasUnsavedChanges(): boolean {
  return dirtyCount > 0;
}

/** Run `proceed` at once when nothing is dirty, else ask through the registered dialog. */
export function confirmLeave(proceed: () => void): void {
  if (dirtyCount === 0 || !confirmer) {
    proceed();
    return;
  }
  confirmer(proceed);
}

/** The shell's DialogHost registers DLG-01 here. Returns the unregister function. */
export function setLeaveConfirmer(fn: Confirmer): () => void {
  confirmer = fn;
  return () => {
    if (confirmer === fn) confirmer = null;
  };
}

/** Mark the calling form as dirty while `dirty` is true. */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    dirtyCount += 1;
    return () => {
      dirtyCount -= 1;
    };
  }, [dirty]);
}
