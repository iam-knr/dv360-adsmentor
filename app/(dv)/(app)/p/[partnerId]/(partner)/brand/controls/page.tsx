import { notFound } from 'next/navigation';
import { BrandControlsView } from '@/components/settings/BrandControlsView';
import { requireView } from '@/lib/scope/guard';
import { getBrandControls } from '@/lib/settings/brand-controls';

export const metadata = { title: 'Brand controls' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const [display, youtube] = await Promise.all([
    getBrandControls(user, partnerId, 'DISPLAY_VIDEO'),
    getBrandControls(user, partnerId, 'YOUTUBE'),
  ]);
  if (!display.ok || !youtube.ok) notFound();
  return (
    <BrandControlsView
      partnerId={partnerId}
      limited={user.dvRole === 'READ_ONLY' || user.dvRole === 'PARTNER_CLIENT'}
      tabs={{ DISPLAY_VIDEO: display.data, YOUTUBE: youtube.data }}
    />
  );
}
