import type { ReactNode } from 'react';

// The report with a parallel `@panel` slot: soft navigation to `/report/settings` or `/report/diff` renders the
// slide-over above the report (intercepting route), a hard navigation renders the full page (module 17 S5, S6).
export default function Layout({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}
