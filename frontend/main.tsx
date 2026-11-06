import { lazy, StrictMode, Suspense, useEffect, useMemo, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Providers from '@/app/providers';
import AppLayout from '@/components/AppLayout';
import CaseSideNavigation from '@/components/cases/CaseSideNavigation';
import CaseTermsGate from '@/components/cases/CaseTermsGate';
import TimelineShell from '@/components/timeline/TimelineShell';
import InvestigativeTimelinePage from '@/components/timeline/InvestigativeTimelinePage';
import RealtimeTimelinePage from '@/components/timeline/RealtimeTimelinePage';
import LegalDocumentPage from '@/components/LegalDocumentPage';
import PrivacyContent from '@/components/PrivacyContent';
import content from './generated/public-content.json';
import ScrollRestoration from './ScrollRestoration';
import '@/app/globals.css';
import '@/instrumentation-client';

type RouteProps = { params: Promise<Record<string, string | string[]>> };
const modules = import.meta.glob([
  '../app/**/page.tsx', '!../app/privacy/page.tsx', '!../app/[[]legalDocument[]]/page.tsx',
  '!../app/cases/[[]case[]]/edit/page.tsx', '!../app/cases/[[]case[]]/timeline/page.tsx',
  '!../app/cases/[[]case[]]/timeline/realtime/page.tsx',
  '!../app/cases/[[]case[]]/timeline/investigative/[[]requestId[]]/page.tsx',
]);
const pages = Object.entries(modules).map(([file, load]) => ({
  path: file.slice('../app/'.length, -'/page.tsx'.length)
    .replace(/^page\.tsx$/, '')
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, '*')
    .replace(/\[([^\]]+)\]/g, ':$1'),
  Page: lazy(load as () => Promise<{ default: ComponentType<RouteProps> }>),
}));

function usePageParams() {
  const params = useParams();
  const key = JSON.stringify(params);
  return useMemo(() => {
    const values = JSON.parse(key);
    if ('*' in values) {
      values.path = values['*'] ? values['*'].split('/') : undefined;
      delete values['*'];
    }
    return Promise.resolve(values);
  }, [key]);
}

function Screen({ Page }: { Page: ComponentType<RouteProps> }) {
  const params = usePageParams();
  const { pathname } = useLocation();
  return <Suspense fallback={<div role="status" className="p-6">Loading…</div>}><Page key={pathname} params={params} /></Suspense>;
}

function RootLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    const legal = content.legal[pathname.slice(1) as keyof typeof content.legal];
    const title = pathname === '/privacy' ? 'Privacy and Security' : legal?.title;
    document.title = title ? `${title} | ProBono Law` : 'Your Secured AI Legal Assistant | ProBono Law';
  }, [pathname]);
  return <><ScrollRestoration /><Providers><AppLayout><Outlet /></AppLayout></Providers></>;
}

function CaseLayout() {
  const { case: caseId = '' } = useParams();
  return <CaseTermsGate caseId={caseId}><CaseSideNavigation caseId={caseId} /><Outlet /></CaseTermsGate>;
}

function TimelineLayout() {
  const { case: caseId = '' } = useParams();
  const params = useMemo(() => Promise.resolve({ case: caseId }), [caseId]);
  return <Suspense fallback={<div role="status">Loading…</div>}><TimelineShell params={params}><Outlet /></TimelineShell></Suspense>;
}

function TimelineIndex() {
  const { case: caseId } = useParams();
  const { search } = useLocation();
  const requestId = new URLSearchParams(search).get('requestId')?.trim();
  return <Navigate replace to={`/cases/${caseId}/timeline/${requestId ? `investigative/${encodeURIComponent(requestId)}` : 'realtime'}`} />;
}

function RealtimeRoute() {
  const { case: caseId = '' } = useParams();
  const { search } = useLocation();
  const params = useMemo(() => Promise.resolve({ case: caseId }), [caseId]);
  if (new URLSearchParams(search).has('requestId')) return <Navigate replace to={`/cases/${caseId}/timeline/realtime`} />;
  return <Suspense fallback={<div role="status">Loading…</div>}><RealtimeTimelinePage params={params} /></Suspense>;
}

function InvestigativeResult() {
  const { case: caseId = '', requestId = '' } = useParams();
  const params = useMemo(() => Promise.resolve({ case: caseId, requestId }), [caseId, requestId]);
  return <Suspense fallback={<div role="status">Loading…</div>}><InvestigativeTimelinePage params={params} requestId={requestId} /></Suspense>;
}

function EditRedirect() {
  const { case: caseId = '' } = useParams();
  return <Navigate replace to={`/cases/${encodeURIComponent(caseId)}`} />;
}

function LegalRoute() {
  const { legalDocument = '' } = useParams();
  const document = content.legal[legalDocument as keyof typeof content.legal];
  return document ? <LegalDocumentPage document={document} /> : <main className="p-6"><h1>Page not found</h1></main>;
}

const casePrefix = 'cases/:case';
const timelinePrefix = `${casePrefix}/timeline`;
function pageRoute({ path, Page }: typeof pages[number], prefix = '') {
  const relative = prefix ? path.slice(prefix.length).replace(/^\//, '') : path;
  return <Route key={path} index={!relative || undefined} path={relative || undefined} element={<Screen Page={Page} />} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><Routes><Route element={<RootLayout />}>
    {pages.filter(({ path }) => !path.startsWith(`${casePrefix}/`) && path !== casePrefix).map(page => pageRoute(page))}
    <Route path="privacy" element={<PrivacyContent document={content.privacy} />} />
    <Route path={casePrefix} element={<CaseLayout />}>
      {pages.filter(({ path }) => (path === casePrefix || path.startsWith(`${casePrefix}/`)) && !path.startsWith(`${timelinePrefix}/`) && path !== timelinePrefix).map(page => pageRoute(page, casePrefix))}
      <Route path="edit" element={<EditRedirect />} />
      <Route path="timeline" element={<TimelineLayout />}>
        <Route index element={<TimelineIndex />} />
        <Route path="realtime" element={<RealtimeRoute />} />
        <Route path="investigative/:requestId" element={<InvestigativeResult />} />
        {pages.filter(({ path }) => path.startsWith(`${timelinePrefix}/`)).map(page => pageRoute(page, timelinePrefix))}
      </Route>
    </Route>
    <Route path=":legalDocument" element={<LegalRoute />} />
    <Route path="*" element={<main className="p-6"><h1>Page not found</h1></main>} />
  </Route></Routes></BrowserRouter></StrictMode>,
);
