'use client';

// One global keyboard handler (design-system 5.4, routes.md 4.7, module 01 4.10). Shortcuts do not fire while focus
// is in a text field or while a modal is open, except `?`, which works anywhere that is not a text field.
import { useEffect, useRef } from 'react';

export interface Hotkey {
  /** `KeyboardEvent.key`, compared without case for letters: '?', '/', 'N', 'K'. */
  key: string;
  shift?: boolean;
  /** Ctrl on Windows and Linux, ⌘ on Mac. */
  mod?: boolean;
  /** Fire while a modal is open (only `?`). */
  inModal?: boolean;
  /** Return false to let the event through untouched (for example ⌘+D with no selection). */
  handler: (e: KeyboardEvent) => boolean | void;
}

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export function isMacPlatform(nav: { platform?: string; userAgent?: string } | undefined): boolean {
  const s = `${nav?.platform ?? ''} ${nav?.userAgent ?? ''}`;
  return /Mac|iPhone|iPad/.test(s);
}

/** Inputs, textareas, selects and contenteditable regions. */
export function isTypingTarget(el: EventTarget | Element | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
      el.type,
    );
  }
  return (el as HTMLElement).isContentEditable || el.closest('[contenteditable="true"]') !== null;
}

export function isModalOpen(doc: Document): boolean {
  return doc.querySelector('[aria-modal="true"]') !== null;
}

export function matchesHotkey(e: KeyLike, hk: Hotkey, mac: boolean): boolean {
  if (e.altKey) return false;
  const mod = mac ? e.metaKey : e.ctrlKey;
  const otherMod = mac ? e.ctrlKey : e.metaKey;
  if (otherMod) return false;
  if (Boolean(hk.mod) !== mod) return false;
  const single = hk.key.length === 1 && !/[a-z]/i.test(hk.key);
  // '?' and '/' are produced with or without Shift depending on the layout: compare the character only.
  if (single) return e.key === hk.key;
  if (Boolean(hk.shift) !== e.shiftKey) return false;
  return e.key.toLowerCase() === hk.key.toLowerCase();
}

/** Bind `hotkeys` on the document while mounted. The latest list is always used. */
export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;
  useEffect(() => {
    if (!enabled) return;
    const mac = isMacPlatform(typeof navigator === 'undefined' ? undefined : navigator);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      const modal = isModalOpen(document);
      for (const hk of ref.current) {
        if (!matchesHotkey(e, hk, mac)) continue;
        if (modal && !hk.inModal) return;
        if (hk.handler(e) !== false) e.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
