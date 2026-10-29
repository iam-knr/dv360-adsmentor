import { CreatorPartnerships } from '@/components/resources/YoutubeAssets';
import { requireView } from '@/lib/scope/guard';

export const metadata = { title: 'YouTube creator partnerships' };

export default async function Page() {
  await requireView('RO');
  return <CreatorPartnerships />;
}
