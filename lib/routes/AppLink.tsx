'use client';

// In-app link (routes.md 5.4 trigger B): wraps next/link, keeps the sticky `sim_*` params (view-as, class override)
// and asks the unsaved-changes guard before it navigates.
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmLeave, hasUnsavedChanges } from '@/lib/hooks/useUnsavedGuard';
import { withSimParams } from './sim-params';

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  replace?: boolean;
  prefetch?: boolean;
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, replace, prefetch, onClick, ...rest },
  ref,
) {
  const search = useSearchParams();
  const router = useRouter();
  const target = withSimParams(href, search?.toString() ?? null);

  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!hasUnsavedChanges()) return;
    e.preventDefault();
    confirmLeave(() => (replace ? router.replace(target) : router.push(target)));
  };

  return (
    <NextLink
      ref={ref}
      href={target}
      replace={replace}
      prefetch={prefetch ?? false}
      onClick={handle}
      {...rest}
    />
  );
});
