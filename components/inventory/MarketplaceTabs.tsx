'use client';

import { useRouter } from 'next/navigation';
import { DvPageHeader, DvTabs } from '@/components/dv';
import { useViewer } from '@/components/shell/ViewerProvider';
import { discoverPath, featuredPath, type Scope } from '@/lib/inventory/paths';

export function MarketplaceHeader({
  scope,
  active,
  children,
}: {
  scope: Scope;
  active: 'featured' | 'discover';
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { viewer } = useViewer();
  return (
    <DvPageHeader title="Marketplace" limitedAccess={viewer.limitedAccess} actions={children}>
      <DvTabs
        ariaLabel="Marketplace"
        tabs={[
          { id: 'featured', label: 'Featured' },
          { id: 'discover', label: 'Discover' },
        ]}
        value={active}
        onChange={(id) =>
          router.push(id === 'featured' ? featuredPath(scope) : discoverPath(scope))
        }
      />
    </DvPageHeader>
  );
}
