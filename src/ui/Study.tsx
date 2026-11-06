// Studie (#/studie/<site,site,...>): click sites, see the storyline on the map and read the story to tell.
// The selection lives in the address, so it survives a reload. Works offline, except for the Claude chat itself:
// the guide copies a research prompt from here and pastes the answer back, and it is saved on each site.
import { useMemo, useState } from 'preact/hooks';
import { formatDistance, formatMinutes } from '../domain/geo';
import { buildStoryline, keywords, siteName, STORY_ORDERS, studySites, tourFromStoryline, type StoryBlock, type StoryOrder, type StorySentence } from '../domain/story';
import { applyReply, buildResearchPrompt, HARD_WORDS, parseReply, type ParsedReply } from '../domain/storyExchange';
import type { LatLng } from '../domain/types';
import { ensureLandmark, getState, saveLandmark, saveTour, useAppState } from '../state/store';
import { copyText } from './clipboard';
import { MapView, type MapDot, type MapStop } from './MapView';
import { navigate } from './router';
import { useTheme } from './theme';
import { WikiText } from './WikiText';

const positionById = new Map(studySites().map((s) => [s.id, s.position]));

function Spoken({ sentences }: { sentences: StorySentence[] }) {
  return (
    <>
      {sentences.map((s, i) => (
        <span key={i} class={`say say--${s.state}`} title={s.state === 'aangepast' ? 'Je hebt de bewering aangepast nadat deze zin is geschreven. Controleer de zin.' : undefined}>
          <WikiText text={s.text} />{i < sentences.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

/** Copy the prompt and paste Claude's answer back. Nothing is saved before the guide has seen what will change. */
function ResearchExchange({ order, onSaved }: { order: string[]; onSaved: (order: string[]) => void }) {
  const { landmarks } = useAppState();
  const [copied, setCopied] = useState<'' | 'ok' | 'mislukt'>('');
  const [prompt, setPrompt] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [reply, setReply] = useState<ParsedReply | null>(null);
  const [done, setDone] = useState('');

  async function copy() {
    const p = buildResearchPrompt(order, landmarks);
    setPrompt(p);
    setCopied(await copyText(p) ? 'ok' : 'mislukt'); // Blocked: the text is shown so it can be copied by hand.
  }
  function check() {
    setError('');
    setDone('');
    try {
      setReply(parseReply(text, landmarks));
    } catch (e) {
      setReply(null);
      setError(e instanceof Error ? e.message : 'Dit antwoord kan ik niet lezen.');
    }
  }
  async function save() {
    if (!reply) return;
    const updated = applyReply(reply, getState().landmarks);
    for (const lm of updated) await saveLandmark(lm);
    setDone(`Opgeslagen op ${updated.length} ${updated.length === 1 ? 'plek' : 'plekken'}. De nieuwe feiten staan als concept onder Onderzoek.`);
    setReply(null);
    setText('');
    onSaved(reply.order);
  }

  return (
    <div class="study__paste">
      <p><strong>Meer onderzoek met Claude</strong></p>
      <p class="hint">1. Kopieer de opdracht en plak die in een chat met Claude, met zoeken op internet aan. 2. Plak het antwoord hieronder. De feiten en het verhaal worden per plek bewaard.</p>
      <button type="button" class="btn" onClick={() => void copy()}>Kopieer opdracht voor Claude</button>
      {copied === 'ok' && <span class="status status--ok"> Gekopieerd ({order.length} {order.length === 1 ? 'plek' : 'plekken'}).</span>}
      {copied === 'mislukt' && (
        <label>Kopiëren lukte niet. Selecteer deze tekst en kopieer hem zelf:
          <textarea rows={5} readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
      <label>Antwoord van Claude
        <textarea rows={5} value={text} placeholder="Plak hier het hele antwoord" onInput={(e) => { setText(e.currentTarget.value); setReply(null); }} />
      </label>
      <button type="button" class="btn" disabled={!text.trim()} onClick={check}>Controleren</button>
      {error && <p class="hint hint--warn" role="alert">{error}</p>}
      {done && <p class="status status--ok">{done}</p>}
      {reply && (
        <div>
          <p><strong>{reply.title || 'Verhaallijn'}</strong>: dit wordt opgeslagen.</p>
          <ul>
            {reply.sites.map((s) => (
              <li key={s.siteId}>{siteName(s.siteId)}: {s.facts.length} nieuwe feiten, {s.sources.length} bronnen, {s.sentences.length} zinnen, {s.questions.length} vragen{s.notFound ? `. Niet gevonden: ${s.notFound}` : ''}</li>
            ))}
          </ul>
          {reply.hardWords.length > 0 && (
            <p class="hint hint--warn">Dure woorden: {reply.hardWords.map((w) => `${w} (beter: ${HARD_WORDS[w]})`).join(', ')}. Je kunt Claude vragen dit te herschrijven.</p>
          )}
          {reply.mythWarnings.length > 0 && (
            <>
              <p class="hint hint--warn">Deze zinnen vertellen een mythe, maar beginnen niet met "Legendes zeggen dat" of "Een bekende volksmythe is":</p>
              <ul>{reply.mythWarnings.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </>
          )}
          {reply.problems.length > 0 && (
            <>
              <p class="hint hint--warn">Dit is niet overgenomen:</p>
              <ul>{reply.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </>
          )}
          <button type="button" class="btn btn--primary" onClick={() => void save()}>Opslaan op de plekken</button>
        </div>
      )}
    </div>
  );
}

/** In practice mode only prompts show; the text comes after trying to tell it. */
function PracticeBlock({ block, shown, onShow }: { block: StoryBlock; shown: boolean; onShow: () => void }) {
  if (shown) return <p class="story__text"><Spoken sentences={block.sentences} /></p>;
  const words = block.sentences.flatMap((s) => keywords(s.text)).filter((w, i, all) => all.indexOf(w) === i);
  return (
    <>
      {block.kind === 'stop' && (words.length
        ? <div class="practice__words">{words.map((w) => <span key={w} class="practice__word">{w}</span>)}</div>
        : <p class="hint">Vertel dit uit je hoofd.</p>)}
      <button type="button" class="btn btn--ghost btn--small" onClick={onShow}>Toon tekst</button>
    </>
  );
}

export function Study({ selection }: { selection?: string }) {
  const { landmarks } = useAppState();
  const { dark } = useTheme();
  const [mode, setMode] = useState<StoryOrder>('verhaal');
  const [fitN, setFitN] = useState(0);
  const [marks, setMarks] = useState(false);
  const [practice, setPractice] = useState(false);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const sites = useMemo(() => studySites(landmarks), [landmarks]);
  const picked = useMemo(() => (selection ? selection.split(',').filter((id) => positionById.has(id)) : []), [selection]);
  const story = useMemo(() => buildStoryline(picked, mode, landmarks), [picked, mode, landmarks]);
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    navigate(`/studie/${next.join(',')}`);
    setShown(new Set());
  };
  async function makeTour() {
    const { tour, newLandmarks } = tourFromStoryline(story, landmarks);
    for (const lm of newLandmarks) await ensureLandmark(lm);
    await saveTour(tour);
    navigate(`/tour/${tour.id}`);
  }
  function setPracticeMode(on: boolean) {
    setPractice(on);
    setShown(new Set());
  }

  const stops: MapStop[] = story.order.flatMap((id, i) => {
    const position = positionById.get(id);
    return position ? [{ id, label: String(i + 1), position }] : [];
  });
  const gaps = stops.slice(1).map((s, i): [LatLng, LatLng] => [stops[i].position, s.position]);
  const dots = useMemo<MapDot[]>(() => sites.flatMap((s) => (
    s.position && !picked.includes(s.id) ? [{ key: s.id, label: s.name, position: s.position }] : []
  )), [picked, sites]);
  const chip = (s: (typeof sites)[number]) => (
    <button key={s.id} type="button" class="chip" aria-pressed={picked.includes(s.id)} onClick={() => { toggle(s.id); setFitN((n) => n + 1); }}>{s.name}</button>
  );
  const written = sites.filter((s) => s.written);
  const unwritten = sites.filter((s) => !s.written);
  const factual = story.counts.concept + story.counts.geverifieerd + story.counts.aangepast;
  let stopNumber = 0;

  return (
    <main class="page page--wide study">
      <div class="page__head">
        <h1>Studie</h1>
        {picked.length > 0 && <button class="btn btn--ghost" onClick={() => navigate('/studie')}>Opnieuw beginnen</button>}
      </div>
      <p class="hint">Klik op plekken op de kaart of hieronder. Je krijgt een verhaallijn en het verhaal om te vertellen.</p>

      <div class="study__body">
        <section aria-label="Plekken kiezen">
          <div class="study__map">
            <MapView stops={stops} dots={dots} onDotClick={toggle} routes={[]} gaps={gaps} fitKey={`studie-${fitN}`} dark={dark} key={dark ? 'donker' : 'licht'} />
          </div>
          <p class="meta">De lijnen zijn rechte verbindingen, geen looproute. Een looproute reken je uit in een tour.</p>
          <div class="study__chips">{written.map(chip)}</div>
          {unwritten.length > 0 && (
            <details class="study__more" open={unwritten.some((s) => picked.includes(s.id))}>
              <summary>Nog {unwritten.length} plekken zonder geschreven verhaal</summary>
              <div class="study__chips">{unwritten.map(chip)}</div>
            </details>
          )}
        </section>

        <section class={`story ${marks ? 'story--marks' : ''}`} aria-label="Verhaal">
          {!picked.length ? (
            <div class="empty">
              <h2>Kies een paar plekken</h2>
              <p>Probeer eens Narikala en de Metekhi-kerk: die delen een verhaal over buskruit.</p>
            </div>
          ) : (
            <>
              <div class="seg seg--choice study__orders" role="radiogroup" aria-label="Volgorde">
                {(Object.entries(STORY_ORDERS) as [StoryOrder, string][]).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}>{l}</button>
                ))}
              </div>
              {story.thread && <p class="story__thread">Rode draad: <strong>{story.thread.label}</strong></p>}
              <p class="meta">
                Ongeveer {formatMinutes(Math.max(1, story.minutes))} vertellen
                {story.order.length > 1 ? ` · ${formatDistance(story.straightM)} in rechte lijn` : ''}
              </p>
              <div class="study__tools">
                <button type="button" class="btn btn--primary" onClick={() => void makeTour()}>Maak hier een tour van</button>
                <button type="button" class="btn" aria-pressed={practice} onClick={() => setPracticeMode(!practice)}>{practice ? 'Stop met oefenen' : 'Oefenen'}</button>
              </div>
              <ResearchExchange order={story.order} onSaved={(order) => { setMode('eigen'); navigate(`/studie/${order.join(',')}`); }} />
              <p class="story__legend">
                {story.counts.geverifieerd} van {factual} feitenzinnen door jou geverifieerd; de rest steunt op beweringen die nog concept zijn.
                {story.counts.aangepast > 0 && <> <span class="say--aangepast">Golvend</span>: je hebt de bewering aangepast, controleer de zin.</>}
                {' '}Schuin gedrukte overgangen voegen geen nieuwe feiten toe.
              </p>
              <label class="check story__marks"><input type="checkbox" checked={marks} onChange={(e) => setMarks(e.currentTarget.checked)} />Toon wat nog concept is</label>
              {practice && <p class="hint">Vertel elk stuk hardop met alleen de woorden als hulp, en kijk daarna of je iets vergat.</p>}
              {story.blocks.map((b, i) => {
                const reveal = () => setShown((s) => new Set(s).add(i));
                if (b.kind !== 'stop') {
                  return practice && !shown.has(i)
                    ? <p key={i} class="story__link">{b.kind === 'overgang' ? 'Overgang: hoe ga je verder?' : b.kind === 'opening' ? 'Hoe begin je?' : 'Hoe sluit je af?'} <button type="button" class="btn btn--ghost btn--small" onClick={reveal}>Toon tekst</button></p>
                    : <p key={i} class="story__link"><Spoken sentences={b.sentences} /></p>;
                }
                stopNumber++;
                return (
                  <article key={b.siteId} class="story__stop">
                    <h2 class="lit">
                      <span class="story__num">{stopNumber}</span> {b.name}
                      {b.saved && <span class="story__saved">uit jouw onderzoek</span>}
                      <a class="story__sources" href={`#/onderzoek/cat:${b.siteId}`}>Bronnen</a>
                    </h2>
                    {!b.written && <p class="hint hint--warn">Nog geen geschreven verhaal: dit zijn de losse beweringen. Gebruik "Kopieer opdracht voor Claude" om er een verhaal van te maken.</p>}
                    {!b.sentences.length
                      ? <p class="hint">Alle beweringen van deze plek zijn afgewezen.</p>
                      : practice
                        ? <PracticeBlock block={b} shown={shown.has(i)} onShow={reveal} />
                        : <p class="story__text"><Spoken sentences={b.sentences} /></p>}
                    {!!b.questions?.length && (
                      <details class="story__questions">
                        <summary>Vragen van gasten ({b.questions.length})</summary>
                        <dl>
                          {b.questions.map((q) => (
                            <div key={q.question}><dt>{q.question}</dt><dd><WikiText text={q.answer} /></dd></div>
                          ))}
                        </dl>
                      </details>
                    )}
                  </article>
                );
              })}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
