'use client';

// Stacked side panel "New Custom Affinity Audience" / "New Custom Intent (Display, Video) Audience" opened from the
// Create link of the Custom lists section in the line item targeting (LIT-002, CIL-002). It saves in place and
// closes back to the Audience lists panel; nothing navigates, so the line item draft stays.
import { useEffect, useState, useTransition } from 'react';
import { DvSlideOver } from '@/components/dv/DvSlideOver';
import { createAudienceAction, getLookupsAction } from '@/lib/audiences/actions';
import type { AudienceLookups } from '@/lib/audiences/wire';
import { useWireErrors } from './useWireErrors';
import {
  CUSTOM_PANEL_TITLE,
  CustomListFields,
  useCustomListState,
  visibleErrors,
  type CustomSurface,
} from './CustomListFields';

const NO_LOOKUPS: Pick<AudienceLookups, 'apps'> = { apps: [] };

export function CustomListPanel({
  surface,
  advertiserId,
  level = 1,
  onClose,
}: {
  surface: CustomSurface;
  /** Public id of the advertiser, as the create action expects it. */
  advertiserId: string;
  level?: number;
  /** `created` is true when a list was saved; the caller reloads its catalogue then. */
  onClose: (created: boolean) => void;
}) {
  const form = useCustomListState(surface);
  const [lookups, setLookups] = useState<Pick<AudienceLookups, 'apps'>>(NO_LOOKUPS);
  const [blank, setBlank] = useState(false);
  const [pending, start] = useTransition();
  const wire = useWireErrors();

  useEffect(() => {
    let live = true;
    void getLookupsAction(advertiserId).then((l) => {
      if (live && l) setLookups({ apps: l.apps });
    });
    return () => {
      live = false;
    };
  }, [advertiserId]);

  const save = () => {
    if (form.state.name.trim() === '') return setBlank(true);
    setBlank(false);
    start(async () => {
      const res = await createAudienceAction(advertiserId, form.input);
      if (!res.ok) return wire.set(res.issues);
      onClose(true);
    });
  };
  const errors = visibleErrors(wire.err, blank && form.state.name.trim() === '');

  return (
    <DvSlideOver
      open
      level={level}
      width="wide"
      title={CUSTOM_PANEL_TITLE[surface]}
      dirty={form.dirty}
      applyLabel="Save"
      applyDisabled={pending}
      onApply={save}
      onCancel={() => onClose(false)}
    >
      <CustomListFields form={form} lookups={lookups} errors={errors} />
    </DvSlideOver>
  );
}
