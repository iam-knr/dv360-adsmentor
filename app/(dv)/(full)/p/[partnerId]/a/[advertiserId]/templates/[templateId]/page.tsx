import { notFound } from 'next/navigation';
import { TemplateForm } from '@/components/templates/TemplateForm';
import { FormFrame } from '@/components/shell/Frames';
import { requireView } from '@/lib/scope/guard';
import { getTemplate } from '@/lib/templates/service';

export const metadata = { title: 'Edit template' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; templateId: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId, templateId } = await params;
  const res = await getTemplate(user, advertiserId, templateId);
  if (!res.ok) notFound();
  const t = res.data;
  return (
    <FormFrame title={t.name}>
      <TemplateForm
        partnerId={partnerId}
        advertiserId={advertiserId}
        type={t.type}
        mode="edit"
        templateId={t.publicId}
        archived={t.status === 'ARCHIVED'}
        canWrite={t.canWrite}
        initial={{
          name: t.name,
          description: t.description ?? '',
          inventoryQuality: t.inventoryQuality,
          optimizedTargeting: t.optimizedTargeting,
          state: t.state,
        }}
      />
    </FormFrame>
  );
}
