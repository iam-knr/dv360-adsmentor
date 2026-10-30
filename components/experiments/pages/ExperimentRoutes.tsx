import { AbReport } from '../AbReport';
import { AbForm } from '../AbForm';
import { AbSettingsBody } from '../AbSettings';
import { AbSlidePanel } from '../AbSlidePanel';
import { ExperimentsHub } from '../ExperimentsHub';
import { LiftForm } from '../LiftForm';
import { LiftReport } from '../LiftReport';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { getAbReport, getAbTest, listAbTests } from '@/lib/experiments/ab-service';
import { canWriteExperiments } from '@/lib/experiments/guard';
import { getLiftReport, getLiftStudy, listLiftStudies } from '@/lib/experiments/lift-service';
import { inventoryScope } from '@/lib/inventory/page';
import { requireView } from '@/lib/scope/guard';

interface P {
  partnerId: string;
  advertiserId: string;
  testId?: string;
  studyId?: string;
}

export async function AbListRoute({ params }: { params: P }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const ab = await orNotFound(() => listAbTests(user, scope.advertiserId));
  return <ExperimentsHub partnerId={scope.partnerId} advertiserId={scope.advertiserId} tab="ab" ab={ab} />;
}

export async function LiftListRoute({ params }: { params: P }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const lift = await orNotFound(() => listLiftStudies(user, scope.advertiserId));
  return <ExperimentsHub partnerId={scope.partnerId} advertiserId={scope.advertiserId} tab="lift" lift={lift} />;
}

export async function AbNewRoute({ params }: { params: P }) {
  const user = await requireView('STD');
  const scope = await inventoryScope(params);
  const list = await orNotFound(() => listAbTests(user, scope.advertiserId));
  return (
    <FormFrame title="Create A/B test" wide>
      <AbForm partnerId={scope.partnerId} advertiserId={scope.advertiserId} mode="create" today={list.today} />
    </FormFrame>
  );
}

export async function AbReportRoute({ params }: { params: P }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const [view, report] = await orNotFound(() =>
    Promise.all([getAbTest(user, scope.advertiserId, params.testId ?? ''), getAbReport(user, scope.advertiserId, params.testId ?? '')]),
  );
  return (
    <FormFrame title="A/B test report" wide>
      <AbReport
        partnerId={scope.partnerId}
        advertiserId={scope.advertiserId}
        view={view}
        initial={report}
        canWrite={canWriteExperiments(user)}
        canDownload={user.dvRole !== 'CREATIVE'}
      />
    </FormFrame>
  );
}

/** Hard navigation to `/report/settings` or `/report/diff`: the same content as a full page. */
export async function AbSettingsPageRoute({ params, tab }: { params: P; tab: 'settings' | 'diff' }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const view = await orNotFound(() => getAbTest(user, scope.advertiserId, params.testId ?? ''));
  return (
    <FormFrame title={`${view.name}: settings`} wide>
      <AbSettingsBody partnerId={scope.partnerId} advertiserId={scope.advertiserId} view={view} initialTab={tab} />
    </FormFrame>
  );
}

/** Soft navigation: the same URL renders this slide-over above the report (parallel and intercepting routes). */
export async function AbPanelRoute({ params, tab }: { params: P; tab: 'settings' | 'diff' }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const view = await orNotFound(() => getAbTest(user, scope.advertiserId, params.testId ?? ''));
  return <AbSlidePanel partnerId={scope.partnerId} advertiserId={scope.advertiserId} view={view} tab={tab} />;
}

export async function LiftNewRoute({ params }: { params: P }) {
  await requireView('STD');
  const scope = await inventoryScope(params);
  return (
    <FormFrame title="New lift study" wide>
      <LiftForm partnerId={scope.partnerId} advertiserId={scope.advertiserId} mode="create" />
    </FormFrame>
  );
}

export async function LiftEditRoute({ params }: { params: P }) {
  const user = await requireView('STD');
  const scope = await inventoryScope(params);
  const study = await orNotFound(() => getLiftStudy(user, scope.advertiserId, params.studyId ?? ''));
  return (
    <FormFrame title={study.name} wide>
      <LiftForm partnerId={scope.partnerId} advertiserId={scope.advertiserId} mode="edit" initial={study} />
    </FormFrame>
  );
}

export async function LiftReportRoute({ params }: { params: P }) {
  const user = await requireView('RO');
  const scope = await inventoryScope(params);
  const [study, report] = await orNotFound(() =>
    Promise.all([getLiftStudy(user, scope.advertiserId, params.studyId ?? ''), getLiftReport(user, scope.advertiserId, params.studyId ?? '')]),
  );
  return (
    <FormFrame title="Brand Lift Report" wide>
      <LiftReport partnerId={scope.partnerId} advertiserId={scope.advertiserId} studyId={study.publicId} studyName={study.name} initial={report} />
    </FormFrame>
  );
}

