import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/sim/LoginForm';
import { SimCard } from '@/components/sim/SimCard';
import { safeNext } from '@/lib/auth/guard';
import { landingFor } from '@/lib/auth/roles';
import { getSessionUser } from '@/lib/auth/session';
import { loginAction } from './actions';

export const metadata: Metadata = { title: 'Sign in | DV360 Simulator by Adsmetor' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next) ?? undefined;
  const user = await getSessionUser();
  if (user) redirect(target ?? landingFor(user.actor?.appRole ?? user.appRole));
  return (
    <SimCard title="Sign in">
      <LoginForm action={loginAction} next={target} />
    </SimCard>
  );
}
