import type { Metadata } from 'next';
import { BackLink } from '@/components/sim/BackLink';
import { PasswordForm } from '@/components/sim/PasswordForm';
import { SimCard } from '@/components/sim/SimCard';
import { safeNext } from '@/lib/auth/guard';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { changePasswordAction } from './actions';

export const metadata: Metadata = { title: 'Change password | DV360 Simulator by Adsmetor' };

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await requireUserOrRedirect();
  const { next } = await searchParams;
  const own = user.actor ?? user;
  return (
    <SimCard title="Change password">
      {user.mustChangePassword === true ? null : <BackLink role={own.appRole} />}
      <PasswordForm
        action={changePasswordAction}
        email={own.email}
        forced={user.mustChangePassword === true}
        next={safeNext(next) ?? undefined}
      />
    </SimCard>
  );
}
