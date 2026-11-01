import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/lib/theme/fonts';
import { ThemeRegistry } from '@/lib/theme/provider';

export const metadata: Metadata = {
  title: 'DV360 Simulator by Adsmetor',
  description: 'Practice Display & Video 360 in a safe classroom sandbox.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
