import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { useAppState } from '../state/store';
import { GuideMode } from './GuideMode';
import { ResearchList, ResearchPage } from './Research';
import { usePath } from './router';
import { Settings } from './Settings';
import { TourEditor } from './TourEditor';
import { TourList } from './TourList';

const SYNC_LABEL: Record<string, string> = {
  uit: 'Alleen op dit apparaat',
  bezig: 'Synchroniseren…',
  ok: 'Gesynchroniseerd',
  fout: 'Synchronisatie mislukt',
  offline: 'Offline',
};

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function App() {
  const s = useAppState();
  const path = usePath();
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    // Prompt instead of auto-reload so an update never interrupts a tour in progress.
    updateSW = registerSW({ onNeedRefresh: () => setNeedRefresh(true) });
  }, []);

  if (!s.loaded) return <div class="loading">Laden…</div>;

  const [, section, id] = path.split('/');
  const guiding = section === 'gids';
  const syncKey = !s.online ? 'offline' : s.syncStatus;
  const syncText = s.pendingChanges && s.syncStatus === 'ok' ? 'Wijzigingen nog niet gesynchroniseerd' : SYNC_LABEL[syncKey];

  return (
    <div class={`app ${guiding ? 'app--guide' : ''}`}>
      <header class="topbar">
        <a href="#/" class="brand lit">Tourstudio</a>
        <nav>
          <a href="#/" class={!section ? 'active' : ''}>Tours</a>
          <a href="#/onderzoek" class={section === 'onderzoek' ? 'active' : ''}>Onderzoek</a>
          <a href="#/instellingen" class={section === 'instellingen' ? 'active' : ''}>Instellingen</a>
        </nav>
        <a href="#/instellingen" class={`sync-pill sync-pill--${syncKey}`} title={s.syncMessage}>{syncText}</a>
      </header>
      {needRefresh && (
        <div class="update-banner">
          Nieuwe versie beschikbaar.
          <button class="btn btn--primary" onClick={() => updateSW?.(true)}>Vernieuwen</button>
          <button class="btn btn--ghost" onClick={() => setNeedRefresh(false)}>Later</button>
        </div>
      )}
      {section === 'tour' && id ? <TourEditor id={id} />
        : guiding && id ? <GuideMode id={id} />
        : section === 'onderzoek' ? (id ? <ResearchPage id={id} /> : <ResearchList />)
        : section === 'instellingen' ? <Settings />
        : <TourList />}
    </div>
  );
}
