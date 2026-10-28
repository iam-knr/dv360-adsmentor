'use client';

// Dirty tracking, route guard and beforeunload (validation.md 5.1, UC-1 and UC-2).
import { useCallback, useEffect, useRef, useState } from 'react';
import { DIALOGS, isDirty as isDirtyFn, type DirtyOptions } from '../dialogs';

export interface UseUnsavedChangesOptions {
  current: unknown;
  initial: unknown;
  dirtyOptions?: DirtyOptions;
  /** Called after the user discards, for a link click or back navigation. Defaults to a full page load. */
  navigate?: (href: string) => void;
}

export interface UseUnsavedChanges {
  isDirty: boolean;
  /** DLG-01 is open. */
  dialogOpen: boolean;
  dialog: (typeof DIALOGS)['DLG-01'];
  /** For Cancel and the close button: runs `leave` at once when clean, else opens DLG-01. */
  requestLeave: (leave: () => void) => void;
  /** Discard changes: runs the pending leave. */
  discard: () => void;
  /** Continue editing: closes the dialog, form unchanged. Esc and the scrim act as this. */
  continueEditing: () => void;
}

function isInternalLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page hash links do not leave the form.
  return !(
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash !== ''
  );
}

export function useUnsavedChanges(options: UseUnsavedChangesOptions): UseUnsavedChanges {
  const { current, initial, dirtyOptions, navigate } = options;
  const dirty = isDirtyFn(current, initial, dirtyOptions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const go = useCallback(
    (href: string) => {
      if (navigate) navigate(href);
      else window.location.assign(href);
    },
    [navigate],
  );

  // UC-2: tab close, reload or external link. The browser shows its own text.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // UC-1: left-nav, breadcrumb and other link clicks open the Unsaved Changes dialog.
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (!dirtyRef.current || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || !isInternalLink(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      const href = anchor.href;
      pending.current = () => go(href);
      setDialogOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [go]);

  // UC-1: router back. Push a guard entry while dirty so the first Back opens the dialog.
  useEffect(() => {
    if (!dirty) return;
    window.history.pushState({ unsavedGuard: true }, '', window.location.href);
    const onPopState = (): void => {
      if (!dirtyRef.current) return;
      window.history.pushState({ unsavedGuard: true }, '', window.location.href);
      pending.current = () => window.history.go(-2);
      setDialogOpen(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [dirty]);

  const requestLeave = useCallback((leave: () => void) => {
    if (!dirtyRef.current) {
      leave();
      return;
    }
    pending.current = leave;
    setDialogOpen(true);
  }, []);

  const discard = useCallback(() => {
    const leave = pending.current;
    pending.current = null;
    setDialogOpen(false);
    // The page is leaving, so the form is clean from here on.
    dirtyRef.current = false;
    leave?.();
  }, []);

  const continueEditing = useCallback(() => {
    pending.current = null;
    setDialogOpen(false);
  }, []);

  return {
    isDirty: dirty,
    dialogOpen,
    dialog: DIALOGS['DLG-01'],
    requestLeave,
    discard,
    continueEditing,
  };
}
