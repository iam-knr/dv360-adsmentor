'use client';

// Save flow shared by the audience create forms: call the action, show field errors, leave the form clean and go
// back to the right list with the "available in about 4 hours" toast (module 14 S6, 4.5).
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { focusFirstInvalid, useToast } from '@/components/dv';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';
import { createAudienceAction } from '@/lib/audiences/actions';
import type { AudienceInput, AudienceTypeKey, WireIssue } from '@/lib/audiences/wire';
import { listPathFor } from './shared';

export interface SaveOk {
  id: string;
  availableAt: string | null;
  status: string;
  match?: { rows: number; matched: number; matchRatePct: number };
}

export function useAudienceSave(partnerId: string, advertiserId: string, type: AudienceTypeKey, dirty: boolean) {
  const router = useRouter();
  const toast = useToast();
  const [issues, setIssues] = useState<WireIssue[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  useUnsavedGuard(dirty && !saved);
  const listPath = listPathFor(partnerId, advertiserId, type);

  /** First error at a path (exact or a prefix of an indexed path). */
  const err = (path: string): string | undefined =>
    issues.find((i) => i.severity === 'error' && (i.path === path || i.path.startsWith(`${path}[`)))?.message;
  const warn = issues.filter((i) => i.severity !== 'error');

  const save = (input: AudienceInput, opts: { stay?: boolean; onDone?: (r: SaveOk) => void } = {}) =>
    start(async () => {
      const res = await createAudienceAction(advertiserId, input);
      if (!res.ok) {
        setIssues(res.issues);
        setTimeout(() => focusFirstInvalid(), 0);
        return;
      }
      setIssues(res.warnings ?? []);
      setSaved(true);
      if (opts.stay) return opts.onDone?.(res.data);
      toast.show({
        message:
          res.data.status === 'ACTIVE'
            ? 'Audience created. It is available now.'
            : 'Audience created. It will be available in about 4 hours.',
      });
      router.push(listPath);
      router.refresh();
    });

  return { issues, setIssues, err, warn, save, pending, listPath, cancel: () => router.push(listPath) };
}
