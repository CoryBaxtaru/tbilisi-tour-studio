import { createTour } from '../domain/factory';
import { saveTour, useAppState } from '../state/store';
import { navigate } from './router';
import { Ribbon } from './Ribbon';
import { TourSuggestions } from './TourSuggestions';

const STATUS: Record<string, string> = { concept: 'Concept', beoordeeld: 'Beoordeeld', klaar: 'Klaar om te gidsen' };

export function TourList() {
  const { tours } = useAppState();
  const visible = tours.filter((t) => !t.deleted).sort((a, b) => a.title.localeCompare(b.title, 'nl'));

  async function add() {
    const t = createTour();
    await saveTour(t);
    navigate(`/tour/${t.id}`);
  }

  return (
    <main class="page">
      <div class="page__head">
        <h1>Tours</h1>
        <button class="btn btn--primary" onClick={add}>Nieuwe tour</button>
      </div>
      {visible.length === 0 ? (
        <div class="empty">
          <h2>Ontwerp je eerste tour</h2>
          <p>Maak een tour, plaats stops op de kaart en bereken de looproute. Alles wordt op dit apparaat bewaard en, als synchronisatie aan staat, ook op je andere apparaten.</p>
        </div>
      ) : (
        <ul class="tour-list">
          {visible.map((t) => (
            <li key={t.id} class="tour-row">
              <div class="tour-row__main">
                <a class="tour-row__title" href={`#/tour/${t.id}`}>{t.title || 'Naamloze tour'}</a>
                <span class="meta">{STATUS[t.status]} · {t.stops.length} stop(s)</span>
                <Ribbon tour={t} compact />
              </div>
              <div class="tour-row__actions">
                <a class="btn" href={`#/tour/${t.id}`}>Bewerken</a>
                <a class="btn btn--primary" href={`#/gids/${t.id}`}>Gidsen</a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <TourSuggestions />
    </main>
  );
}
