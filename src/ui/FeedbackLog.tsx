// What guests said and what to improve, per departure. Deliberately without names: this is kept for good, while
// guests' personal data is erased after six months.
import { useState } from 'preact/hooks';
import { newId, nowIso } from '../domain/factory';
import type { Departure, Feedback } from '../domain/types';
import { currentRecord, saveRecord } from '../state/store';

const KIND_LABEL: Record<Feedback['kind'], string> = { gast: 'Wat gasten zeiden', verbeterpunt: 'Wat beter kan' };

export function FeedbackLog({ departure }: { departure: Departure }) {
  const [kind, setKind] = useState<Feedback['kind']>('gast');
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const list = departure.feedback ?? [];

  function store(next: Feedback[]) {
    const cur = currentRecord('departures', departure.id);
    if (cur) void saveRecord('departures', { ...cur, feedback: next });
  }
  function add(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;
    const cur = currentRecord('departures', departure.id);
    store([...(cur?.feedback ?? []), { id: newId(), at: nowIso(), kind, text: text.trim(), ...(kind === 'gast' && stars ? { stars } : {}) }]);
    setText('');
    setStars(0);
  }
  return (
    <details class="departure__edit" open={list.length > 0 || departure.status === 'afgerond'}>
      <summary>Terugblik{list.length ? ` (${list.length})` : ''}</summary>
      {list.length > 0 && (
        <ul class="todo-list">
          {list.map((f) => (
            <li key={f.id}>
              <span>{f.stars ? `${f.stars} van 5 · ` : ''}{f.text} <span class="meta">({KIND_LABEL[f.kind].toLowerCase()})</span></span>
              <button type="button" class="btn btn--small btn--ghost" onClick={() => store(list.filter((x) => x.id !== f.id))}>Verwijderen</button>
            </li>
          ))}
        </ul>
      )}
      <form class="feedback-form" onSubmit={add}>
        <label class="narrow">Soort
          <select value={kind} onChange={(e) => setKind(e.currentTarget.value as Feedback['kind'])}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {kind === 'gast' && (
          <label class="narrow">Beoordeling
            <select value={stars} onChange={(e) => setStars(Number(e.currentTarget.value))}>
              <option value={0}>Geen</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} van 5</option>)}
            </select>
          </label>
        )}
        <label class="grow">Tekst<input value={text} placeholder="Zonder namen, bijv. te weinig tijd bij Sioni" onInput={(e) => setText(e.currentTarget.value)} /></label>
        <button type="submit" class="btn" disabled={!text.trim()}>Toevoegen</button>
      </form>
    </details>
  );
}
