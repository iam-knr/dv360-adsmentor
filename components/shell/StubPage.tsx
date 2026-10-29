// Server side stub page: checks the page's view code (routes.md 2; 404 in place below it), then renders ComingSoon in
// the right frame. Module owners replace the page file and keep the `requireView` call (lib/scope/guard.ts).
import { requireView } from '@/lib/scope/guard';
import type { ViewCode } from '@/lib/routes/route-table';
import { ComingSoon } from './ComingSoon';
import { FormFrame } from './Frames';

export interface StubPageProps {
  module: string;
  title: string;
  view: ViewCode;
  /** `form` wraps the stub in the F frame header; `tab` sits under an IO or LI frame (no own title). */
  frame?: 'page' | 'form' | 'tab';
}

export async function StubPage({ module, title, view, frame = 'page' }: StubPageProps) {
  await requireView(view);
  if (frame === 'form') {
    return (
      <FormFrame title={title}>
        <ComingSoon module={module} header={false} />
      </FormFrame>
    );
  }
  return <ComingSoon module={module} title={title} header={frame !== 'tab'} />;
}
