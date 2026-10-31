import { TemplateForm, TemplateTypeStep } from '@/components/templates/TemplateForm';
import { FormFrame } from '@/components/shell/Frames';
import { requireView } from '@/lib/scope/guard';
import { newTemplateState } from '@/lib/templates/service';
import { LI_TYPE_LABEL } from '@/lib/validation/constants/li-compat';
import { TEMPLATE_TYPES } from '@/lib/validation/rules/template';

export const metadata = { title: 'New template' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const { type: raw } = await searchParams;
  const type = TEMPLATE_TYPES.find((t) => t === raw?.toUpperCase());
  if (!type) {
    return (
      <FormFrame title="New targeting template">
        <TemplateTypeStep partnerId={partnerId} advertiserId={advertiserId} />
      </FormFrame>
    );
  }
  return (
    <FormFrame title={`New ${LI_TYPE_LABEL[type]} template`}>
      <TemplateForm
        partnerId={partnerId}
        advertiserId={advertiserId}
        type={type}
        mode="create"
        canWrite
        initial={{
          name: '',
          description: '',
          inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
          optimizedTargeting: false,
          state: newTemplateState(type),
        }}
      />
    </FormFrame>
  );
}
