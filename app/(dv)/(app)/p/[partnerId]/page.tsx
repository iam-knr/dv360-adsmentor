import { redirect } from 'next/navigation';
import { partnerPath } from '@/lib/routes/paths';

// [P] → [P]/home_v3 (routes.md 6.3)
export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  redirect(partnerPath(partnerId, 'home_v3'));
}
