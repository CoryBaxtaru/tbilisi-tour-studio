// Studie (#/studie/<site,site,...>): click sites, see the storyline on the map and read the story to tell.
// The selection lives in the address, so it survives a reload. Works offline, except for the Claude chat itself:
// the guide copies a research prompt from here and pastes the answer back, and it is saved on each site.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatDistance, formatMinutes } from '../domain/geo';
import { buildStoryline, keywords, siteName, STORY_ORDERS, studySites, studySitesFromTour, tourFromStoryline, type StoryBlock, type StoryOrder, type StorySentence } from '../domain/story';
import { applyReply, buildResearchPrompt, HARD_WORDS, parseReply, type ParsedReply } from '../domain/storyExchange';
import { DISTRICTS } from '../domain/tags';
import type { LatLng, Tour } from '../domain/types';
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

/** Start from one of the guide's own tours, in its order. */
function TourLoader({ onLoad }: { onLoad: (tour: Tour) => void }) {
  const { tours } = useAppState();
  const list = tours.filter((t) => !t.deleted && t.stops.length).sort((a, b) => a.title.localeCompare(b.title, 'nl'));
  if (!list.length) return null;
  return (
    <select class="study__tour" aria-label="Laad een van je tours" value="" onChange={(e) => {
      const tour = list.find((t) => t.id === e.currentTarget.value);
      e.currentTarget.value = '';
      if (tour) onLoad(tour);
    }}>
      <option value="">Laad een van je tours</option>
      {list.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.stops.length} {t.stops.length === 1 ? 'stop' : 'stops'})</option>)}
    </select>
  );
}

/** Choosing sites is a side job once a story exists, so the list folds away: search, then the sites per district. */
function SitePicker({ picked, onToggle, onLoadTour }: { picked: string[]; onToggle: (id: string) => void; onLoadTour: (tour: Tour) => void }) {
  const { landmarks } = useAppState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sites = useMemo(() => studySites(landmarks), [landmarks]);
  const showing = open || !picked.length;
  const q = query.trim().toLocaleLowerCase('nl');
  const matches = sites.filter((s) => !q || s.name.toLocaleLowerCase('nl').includes(q));
  const chip = (s: (typeof sites)[number]) => (
    <button key={s.id} type="button" class={`study-chip ${s.written ? '' : 'study-chip--bare'}`} aria-pressed={picked.includes(s.id)}
      title={s.written ? undefined : 'Nog geen geschreven verhaal'} onClick={() => { onToggle(s.id); setQuery(''); }}>{s.name}</button>
  );
  const chosen = picked.flatMap((id) => sites.find((s) => s.id === id) ?? []);
  return (
    <div class={`picker ${showing ? 'is-open' : ''}`}>
      {picked.length > 0 && (
        <button type="button" class="btn picker__toggle" aria-expanded={showing} onClick={() => setOpen(!open)}>
          {showing ? 'Plekken verbergen' : `Plekken wijzigen (${picked.length})`}
        </button>
      )}
      {showing && (
        <div class="picker__panel">
          {picked.length > 0 && <TourLoader onLoad={onLoadTour} />}
          <input type="search" value={query} aria-label="Zoek een plek" placeholder="Zoek een plek" onInput={(e) => setQuery(e.currentTarget.value)} />
          {!q && chosen.length > 0 && (
            <div class="picker__group">
              <h2>Gekozen</h2>
              <div class="picker__chips">{chosen.map(chip)}</div>
              <button type="button" class="btn btn--ghost btn--small" onClick={() => navigate('/studie')}>Opnieuw beginnen</button>
            </div>
          )}
          {DISTRICTS.map((d) => {
            const list = matches.filter((s) => s.district === d.id && (q || !picked.includes(s.id)));
            return list.length > 0 && (
              <div class="picker__group" key={d.id}>
                <h2>{d.label}</h2>
                <div class="picker__chips">{list.map(chip)}</div>
              </div>
            );
          })}
          {!matches.length && <p class="hint">Geen plek gevonden met "{query.trim()}".</p>}
        </div>
      )}
    </div>
  );
}

const scrollToStop = (id: string) => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

export function Study({ selection }: { selection?: string }) {
  const { landmarks } = useAppState();
  const { dark } = useTheme();
  const [mode, setMode] = useState<StoryOrder>('verhaal');
  const [marks, setMarks] = useState(false);
  const [practice, setPractice] = useState(false);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [reading, setReading] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ title: string; key: string; skipped: string[] } | null>(null);
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
  function loadTour(tour: Tour) {
    const { ids, skipped } = studySitesFromTour(tour, landmarks);
    setMode('eigen');
    setShown(new Set());
    setLoaded({ title: tour.title, key: ids.join(','), skipped });
    navigate(ids.length ? `/studie/${ids.join(',')}` : '/studie');
  }
  const fromTour = loaded && loaded.key === picked.join(',') ? loaded : null;
  function move(id: string, by: -1 | 1) {
    const order = [...story.order];
    const i = order.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setMode('eigen');
    setShown(new Set());
    navigate(`/studie/${order.join(',')}`);
  }
  function setPracticeMode(on: boolean) {
    setPractice(on);
    setShown(new Set());
  }

  // Which stop is being read: the one crossing a line a third down the screen. It lights up on the map.
  const orderKey = story.order.join(',');
  useEffect(() => {
    setReading(story.order[0] ?? null);
    const stopsOnPage = document.querySelectorAll<HTMLElement>('.story__stop');
    if (!stopsOnPage.length) return;
    const watcher = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setReading((e.target as HTMLElement).dataset.site ?? null);
    }, { rootMargin: '-33% 0px -66% 0px' });
    stopsOnPage.forEach((el) => watcher.observe(el));
    return () => watcher.disconnect();
  }, [orderKey]);

  const stops = useMemo<MapStop[]>(() => story.order.flatMap((id, i) => {
    const position = positionById.get(id);
    return position ? [{ id, label: String(i + 1), position, state: id === reading && story.order.length > 1 ? 'actief' as const : 'normaal' as const }] : [];
  }), [orderKey, reading]);
  const gaps = useMemo(() => stops.slice(1).map((s, i): [LatLng, LatLng] => [stops[i].position, s.position]), [orderKey]);
  const dots = useMemo<MapDot[]>(() => sites.flatMap((s) => (
    s.position && !picked.includes(s.id) ? [{ key: s.id, label: s.name, position: s.position }] : []
  )), [picked, sites]);
  const factual = story.counts.concept + story.counts.geverifieerd + story.counts.aangepast;
  const first = story.order[0];
  const last = story.order[story.order.length - 1];
  const title = !picked.length
    ? 'Studie'
    : fromTour?.title ?? story.thread?.label ?? (story.order.length > 1 ? `Van ${siteName(first)} naar ${siteName(last)}` : siteName(first));
  let stopNumber = 0;

  return (
    <main class="page page--wide study">
      <div class="study__body">
      <header class="study__head">
        <h1 class="lit">{title}</h1>
        {picked.length > 0 ? (
          <>
            <p class="meta study__facts">
              {story.order.length} {story.order.length === 1 ? 'plek' : 'plekken'} · ongeveer {formatMinutes(Math.max(1, story.minutes))} vertellen
              {story.order.length > 1 ? ` · ${formatDistance(story.straightM)} in rechte lijn` : ''}
            </p>
            {fromTour && (
              <p class="hint study__from-tour">
                Uit je tour, in de volgorde van de tour.
                {fromTour.skipped.length > 0 && ` Niet in Studie, want eigen plekken hebben hier geen verhaal: ${fromTour.skipped.join(', ')}.`}
              </p>
            )}
            <div class="study__tools">
              <button type="button" class="btn btn--primary" onClick={() => void makeTour()}>Maak een tour</button>
              <button type="button" class="btn" aria-pressed={practice} onClick={() => setPracticeMode(!practice)}>{practice ? 'Stop met oefenen' : 'Oefenen'}</button>
              <select class="study__order" aria-label="Volgorde" value={mode} onChange={(e) => setMode(e.currentTarget.value as StoryOrder)}>
                {(Object.entries(STORY_ORDERS) as [StoryOrder, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </>
        ) : <p class="meta study__facts">Kies plekken op de kaart of in de lijst. Je krijgt een verhaallijn en het verhaal om te vertellen.</p>}
      </header>

        <section class="study__aside" aria-label="Plekken kiezen">
          <div class="study__map">
            <MapView stops={stops} dots={dots} onDotClick={toggle} onStopClick={scrollToStop} routes={[]} gaps={gaps} refitOnResize
              fitKey={`studie-${[...picked].sort().join(',')}`} dark={dark} key={dark ? 'donker' : 'licht'} />
          </div>
          {stops.length > 1 && <p class="meta study__note">Rechte lijnen, geen looproute. Die reken je uit in een tour.</p>}
          <SitePicker picked={story.order} onToggle={toggle} onLoadTour={loadTour} />
        </section>

        <section class={`story ${marks ? 'story--marks' : ''}`} aria-label="Verhaal">
          {!picked.length ? (
            <div class="empty">
              <h2>Kies een paar plekken</h2>
              <p>Narikala en de Metekhi-kerk delen een verhaal over buskruit.</p>
              <button type="button" class="btn" onClick={() => navigate('/studie/narikala,metekhi')}>Begin met deze twee</button>
              {fromTour && <p class="hint hint--warn">De tour "{fromTour.title}" heeft geen plekken uit de catalogus, dus er is geen verhaal voor.</p>}
              <div class="study__load"><TourLoader onLoad={loadTour} /></div>
            </div>
          ) : (
            <>
              <div class="story__status">
                <span>{story.counts.geverifieerd} van {factual} feitenzinnen geverifieerd</span>
                <label class="check story__marks"><input type="checkbox" checked={marks} onChange={(e) => setMarks(e.currentTarget.checked)} />Toon wat nog concept is</label>
              </div>
              {story.counts.aangepast > 0 && <p class="hint"><span class="say--aangepast">Golvend</span>: je hebt de bewering aangepast, controleer de zin.</p>}
              <details class="study__research">
                <summary>Meer onderzoek met Claude</summary>
                <ResearchExchange order={story.order} onSaved={(order) => { setMode('eigen'); navigate(`/studie/${order.join(',')}`); }} />
              </details>
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
                  <article key={b.siteId} id={`stop-${b.siteId}`} data-site={b.siteId} class={`story__stop ${b.siteId === reading && story.order.length > 1 ? 'is-reading' : ''}`}>
                    <h2 class="lit">
                      <span class="story__num">{stopNumber}</span>
                      <span class="story__name">{b.name}</span>
                      {b.saved && <span class="story__saved">uit jouw onderzoek</span>}
                      {story.order.length > 1 && (
                        <span class="story__move">
                          <button type="button" class="icon-btn" aria-label={`${b.name} eerder`} disabled={stopNumber === 1} onClick={() => move(b.siteId!, -1)}>↑</button>
                          <button type="button" class="icon-btn" aria-label={`${b.name} later`} disabled={stopNumber === story.order.length} onClick={() => move(b.siteId!, 1)}>↓</button>
                        </span>
                      )}
                      <a class="story__sources" href={`#/onderzoek/cat:${b.siteId}`}>Bronnen</a>
                    </h2>
                    {!b.written && <p class="hint hint--warn">Nog geen geschreven verhaal: dit zijn de losse beweringen. Gebruik "Meer onderzoek met Claude" om er een verhaal van te maken.</p>}
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
              <p class="meta">Schuin gedrukte overgangen voegen geen nieuwe feiten toe.</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
