import type { Metadata } from 'next';
import { CohortForm } from '@/components/manage/CohortForm';
import { pageActor } from '@/lib/accounts/session-actor';
import { getAccountPolicy } from '@/lib/auth/policy';

export const metadata: Metadata = { title: 'New cohort | DV360 Simulator by Adsmetor' };

export default async function NewCohortPage() {
  await pageActor();
  const policy = await getAccountPolicy();
  return <CohortForm defaultCapacity={policy.defaultCohortCapacity} />;
}
