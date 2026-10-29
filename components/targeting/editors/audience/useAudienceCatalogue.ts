'use client';

import { useEffect, useState } from 'react';
import { GOOGLE_AUDIENCES, type AudienceMeta } from '@/lib/targeting/audience';

export interface CatalogueItem {
  id: string;
  name: string;
  path: string;
  meta: AudienceMeta;
  subtype: string;
}

export interface AudienceCatalogue {
  firstParty: CatalogueItem[];
  combined: CatalogueItem[];
  custom: CatalogueItem[];
  google: CatalogueItem[];
}

const GOOGLE: CatalogueItem[] = GOOGLE_AUDIENCES.map((g) => ({
  id: g.id,
  name: g.name,
  path: g.path.join(' » '),
  subtype: g.kind,
  meta: { id: g.id, name: g.name, kind: 'GOOGLE' },
}));

const EMPTY: AudienceCatalogue = { firstParty: [], combined: [], custom: [], google: GOOGLE };

/** Lists the picker offers. The Google catalogue is bundled, so it is there before the advertiser lists load. */
export function useAudienceCatalogue(advertiserId?: string): AudienceCatalogue {
  const [data, setData] = useState<AudienceCatalogue>(EMPTY);
  useEffect(() => {
    const ctl = new AbortController();
    const q = advertiserId ? `?advertiserId=${encodeURIComponent(advertiserId)}` : '';
    fetch(`/api/dv/audiences/estimate/catalogue${q}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AudienceCatalogue | null) => {
        if (j) setData({ ...j, google: j.google?.length ? j.google : GOOGLE });
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, [advertiserId]);
  return data;
}

export function allItems(c: AudienceCatalogue): CatalogueItem[] {
  return [...c.firstParty, ...c.combined, ...c.custom, ...c.google];
}
