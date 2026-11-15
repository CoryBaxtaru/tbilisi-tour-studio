// New tours from the Tours page: the recommended two-hour tour in one tap, and a tour on request through Claude
// (copy a prompt, paste the answer back). Both get their talking points from the app's own story passages.
import { useState } from 'preact/hooks';
import { siteName } from '../domain/story';
import { buildTourPrompt, CLASSIC_TOUR, parseTourReply, tourFromReply, TourReplyError, type TourReply, type TourRequest } from '../domain/tourRequest';
import { ensureLandmark, getState, saveTour } from '../state/store';
import { copyText } from './clipboard';
import { navigate } from './router';

async function create(reply: TourReply, req: TourRequest) {
  const { tour, newLandmarks } = tourFromReply(reply, req, getState().landmarks);
  for (const lm of newLandmarks) await ensureLandmark(lm);
  await saveTour(tour);
  navigate(`/tour/${tour.id}`);
}

export function TourStarters({ hasTours }: { hasTours: boolean }) {
  const [wish, setWish] = useState('');
  const [minutes, setMinutes] = useState(120);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState<'' | 'ok' | 'mislukt'>('');
  const [answer, setAnswer] = useState('');
  const [reply, setReply] = useState<TourReply | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const req = { wish, minutes };

  async function copy() {
    const p = buildTourPrompt(req);
    setPrompt(p);
    setCopied(await copyText(p) ? 'ok' : 'mislukt');
  }
  function check() {
    setError('');
    try {
      setReply(parseTourReply(answer));
    } catch (e) {
      setReply(null);
      setError(e instanceof TourReplyError ? e.message : 'Dit antwoord kan ik niet lezen.');
    }
  }
  async function make(r: TourReply) {
    setBusy(true);
    try { await create(r, req); } finally { setBusy(false); }
  }

  return (
    <section class="starters" aria-label="Nieuwe tour maken">
      <div class="starter starter--classic">
        <div>
          <p class="label">Aanbevolen</p>
          <h2 class="lit">{CLASSIC_TOUR.title}</h2>
          <p class="meta">{CLASSIC_TOUR.stops.map((s) => siteName(s.siteId)).join(' · ')}</p>
        </div>
        <button type="button" class={`btn ${hasTours ? '' : 'btn--primary'}`} disabled={busy} onClick={() => void make(CLASSIC_TOUR)}>Maak deze tour</button>
      </div>

      <details class="starter form-section">
        <summary>Tour op maat met Claude <span class="meta">· voor de wens van een klant</span></summary>
        <div class="form-section__body request">
          <p class="hint">1. Schrijf wat de klant wil. 2. Kopieer de opdracht en plak die in een chat met Claude. 3. Plak het antwoord hieronder. Claude kiest alleen plekken en volgorde; de verhalen komen uit je eigen onderzoek.</p>
          <label>Wat wil de klant?<textarea rows={3} value={wish} placeholder="Bijv. zes mensen, willen de hele oude stad zien en houden van geschiedenis" onInput={(e) => setWish(e.currentTarget.value)} /></label>
          <label class="narrow">Duur (min)<input type="number" min={30} step={15} value={minutes} onInput={(e) => setMinutes(Math.max(30, Number(e.currentTarget.value) || 120))} /></label>
          <div class="claim__actions">
            <button type="button" class="btn" onClick={() => void copy()}>Kopieer opdracht voor Claude</button>
            {copied === 'ok' && <span class="status status--ok">Gekopieerd.</span>}
          </div>
          {copied === 'mislukt' && (
            <label>Kopiëren lukte niet. Selecteer deze tekst en kopieer hem zelf:
              <textarea rows={5} readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} />
            </label>
          )}
          <label>Antwoord van Claude<textarea rows={5} value={answer} placeholder="Plak hier het hele antwoord" onInput={(e) => { setAnswer(e.currentTarget.value); setReply(null); }} /></label>
          <button type="button" class="btn" disabled={!answer.trim()} onClick={check}>Controleren</button>
          {error && <p class="hint hint--warn" role="alert">{error}</p>}
          {reply && (
            <div class="request__preview">
              <p><strong>{reply.title || 'Tour op maat'}</strong>{reply.explanation ? `: ${reply.explanation}` : ''}</p>
              <ol>
                {reply.stops.map((s) => (
                  <li key={s.siteId}>
                    {siteName(s.siteId)}{s.minutes ? <span class="meta"> · {s.minutes} min</span> : null}
                    {s.standpoint && <span class="meta"> · standpunt: {s.standpoint}</span>}
                  </li>
                ))}
              </ol>
              {reply.unknown.length > 0 && <p class="hint hint--warn">Niet overgenomen, deze plekken ken ik niet: {reply.unknown.join('; ')}</p>}
              <button type="button" class="btn btn--primary" disabled={busy} onClick={() => void make(reply)}>Maak deze tour</button>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
