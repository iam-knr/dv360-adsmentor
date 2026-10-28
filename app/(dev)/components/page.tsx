import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Gallery } from './gallery';

export const metadata: Metadata = { title: 'Component gallery - DV360 Simulator by Adsmetor' };

// Read at request time so a Preview deployment can switch it on with ENABLE_GALLERY=1.
export const dynamic = 'force-dynamic';

/** 404 in Production unless ENABLE_GALLERY=1 (build-plan 4.2, item 6). */
export default function GalleryPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_GALLERY !== '1') notFound();
  return <Gallery />;
}
