import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { useAppState } from '../state/store';
import { ErrorBoundary, ErrorScreen } from './ErrorScreen';
import { usePath } from './router';
import { Today } from './Today';
import { TourList } from './TourList';

// Vandaag and Tours open at once; the other pages (and with them the map and the research texts) load when
// first opened. The service worker stores every part, so this also works offline.
const TourEditor = lazy(() => import('./TourEditor').then((m) => ({ default: m.TourEditor })));
const GuideMode = lazy(() => import('./GuideMode').then((m) => ({ default: m.GuideMode })));
const Study = lazy(() => import('./Study').then((m) => ({ default: m.Study })));
const ResearchList = lazy(() => import('./Research').then((m) => ({ default: m.ResearchList })));
const ResearchPage = lazy(() => import('./Research').then((m) => ({ default: m.ResearchPage })));
const Agenda = lazy(() => import('./Agenda').then((m) => ({ default: m.Agenda })));
const DeparturePage = lazy(() => import('./DeparturePage').then((m) => ({ default: m.DeparturePage })));
const Products = lazy(() => import('./ProductPage').then((m) => ({ default: m.Products })));
const ProductPage = lazy(() => import('./ProductPage').then((m) => ({ default: m.ProductPage })));
const Finance = lazy(() => import('./Finance').then((m) => ({ default: m.Finance })));
const StatisticsPage = lazy(() => import('./Statistics').then((m) => ({ default: m.StatisticsPage })));
const Settings = lazy(() => import('./Settings').then((m) => ({ default: m.Settings })));

const SYNC_LABEL: Record<string, string> = {
  uit: 'Alleen op dit apparaat',
  bezig: 'Synchroniseren…',
  ok: 'Gesynchroniseerd',
  fout: 'Synchronisatie mislukt',
  offline: 'Offline',
};

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

// updateSW(true) activates the waiting worker and reloads once it takes control. If the worker was already
// activated (seen once on GitHub Pages), nothing reloads and the banner stays, so reload ourselves as a fallback.
function refreshApp() {
  void updateSW?.(true);
  setTimeout(() => location.reload(), 1500);
}

export function App() {
  const s = useAppState();
  const path = usePath();
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // Prompt instead of auto-reload so an update never interrupts a tour in progress.
    updateSW = registerSW({ onNeedRefresh: () => setNeedRefresh(true) });
  }, []);

  if (s.loadError) return <ErrorScreen title="De app kan je gegevens niet openen" detail={s.loadError} />;
  if (!s.loaded) return <div class="loading">Laden…</div>;

  const [, section, id, sub] = path.split('/');
  const guiding = section === 'gids';
  const syncKey = !s.online ? 'offline' : s.syncStatus;
  const syncText = s.pendingChanges && s.syncStatus === 'ok' ? 'Wijzigingen nog niet gesynchroniseerd' : SYNC_LABEL[syncKey];

  return (
    <div class={`app ${guiding ? 'app--guide' : ''}`}>
      {!guiding && <header class="topbar">
        <a href="#/" class="brand lit">Tourstudio</a>
        <nav>
          <a href="#/vandaag" class={section === 'vandaag' ? 'active' : ''}>Vandaag</a>
          <a href="#/" class={!section ? 'active' : ''}>Tours</a>
          <a href="#/agenda" class={['agenda', 'vertrek', 'aanbod', 'geld', 'cijfers'].includes(section) ? 'active' : ''}>Agenda</a>
          <a href="#/onderzoek" class={section === 'onderzoek' ? 'active' : ''}>Onderzoek</a>
          <a href="#/studie" class={section === 'studie' ? 'active' : ''}>Studie</a>
          <a href="#/instellingen" class={section === 'instellingen' ? 'active' : ''} aria-label="Instellingen">
            <span class="nav-full">Instellingen</span><span class="nav-icon" aria-hidden="true">⚙</span>
          </a>
        </nav>
        <a href="#/instellingen" class={`sync-pill sync-pill--${syncKey}`} title={s.syncMessage}>{syncText}</a>
      </header>}
      {needRefresh && (
        <div class="update-banner">
          Nieuwe versie beschikbaar.
          <button class="btn btn--primary" onClick={refreshApp}>Vernieuwen</button>
          <button class="btn btn--ghost" onClick={() => setNeedRefresh(false)}>Later</button>
        </div>
      )}
      <ErrorBoundary resetKey={path}>
      <Suspense fallback={<div class="loading">Laden…</div>}>
      {section === 'tour' && id ? <TourEditor id={id} />
        : guiding && id ? <GuideMode id={id} departureId={sub} />
        : section === 'onderzoek' ? (id ? <ResearchPage id={id} /> : <ResearchList />)
        : section === 'agenda' ? <Agenda month={id} />
        : section === 'vertrek' && id ? <DeparturePage key={id} id={id} />
        : section === 'aanbod' ? (id ? <ProductPage key={id} id={id} /> : <Products />)
        : section === 'vandaag' ? <Today />
        : section === 'geld' ? <Finance year={id} />
        : section === 'cijfers' ? <StatisticsPage year={id} />
        : section === 'studie' ? <Study selection={id} />
        : section === 'instellingen' ? <Settings />
        : <TourList />}
      </Suspense>
      </ErrorBoundary>
    </div>
  );
}
