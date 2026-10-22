// Research: reusable sources and claims per site, with the guide's verdict (docs/RESEARCH.md).
// #/onderzoek lists every site; #/onderzoek/<landmarkId> shows its claims and sources.
import { useMemo, useState } from 'preact/hooks';
import { buildDeck, CATALOG, catalogLandmarkId, landmarkFromCatalog } from '../domain/catalog';
import {
  CLAIM_STATUS, createClaim, createSource, draftResearch, DRAFTS_METHOD, isWebUrl, LANGUAGES, mergedResearch, researchCounts,
  SOURCE_TYPES, withClaim, withoutClaim, withoutSource, withSource,
} from '../domain/research';
import { tagLabel } from '../domain/tags';
import type { Claim, ClaimKind, Landmark, SourceRef } from '../domain/types';
import { ensureLandmark, getState, saveLandmark, useAppState } from '../state/store';
import { SiteInfo } from './SiteInfo';

const KINDS: ClaimKind[] = ['feit', 'interpretatie', 'anekdote', 'onzeker'];
type Filter = 'alles' | 'open' | 'leeg';
type Counts = ReturnType<typeof researchCounts>;
const isEmpty = (n: Counts) => n.sources + n.concept + n.geverifieerd + n.afgewezen === 0;

export function ResearchList() {
  const { landmarks } = useAppState();
  const [filter, setFilter] = useState<Filter>('alles');
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () => buildDeck(landmarks)
      .map((card) => ({ card, n: researchCounts(mergedResearch(card.landmark, card.site?.id)) }))
      .sort((a, b) => a.card.name.localeCompare(b.card.name, 'nl')),
    [landmarks],
  );
  const q = query.trim().toLowerCase();
  const visible = rows.filter(({ card, n }) =>
    (filter === 'alles' || (filter === 'open' ? n.concept > 0 : isEmpty(n)))
    && (!q || card.name.toLowerCase().includes(q) || card.nameKa.includes(query.trim())));
  const filters: [Filter, string, number][] = [
    ['alles', 'Alles', rows.length],
    ['open', 'Te verifiëren', rows.filter((r) => r.n.concept > 0).length],
    ['leeg', 'Zonder onderzoek', rows.filter((r) => isEmpty(r.n)).length],
  ];

  return (
    <main class="page research">
      <div class="page__head"><h1>Onderzoek</h1></div>
      <p class="hint research__intro">
        Beweringen per plek, met bronnen. Concepten van Claude zijn gecontroleerd in de oorspronkelijke bron, niet in Wikipedia.
        Controleer ze zelf en kies Bevestigen of Afwijzen voordat je ze vertelt.
      </p>
      <details class="research__method">
        <summary>Hoe zijn de concepten gemaakt?</summary>
        <p class="hint">{DRAFTS_METHOD}</p>
      </details>
      <div class="research__filters">
        <input type="search" placeholder="Zoek een plek" aria-label="Zoek een plek" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        <div class="chip-group__chips" role="group" aria-label="Filter">
          {filters.map(([f, label, count]) => (
            <button key={f} class={`chip chip--filter ${filter === f ? 'is-on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label} ({count})
            </button>
          ))}
        </div>
      </div>
      <ul class="tour-list">
        {visible.map(({ card, n }) => (
          <li key={card.key} class="tour-row research-row">
            <div class="tour-row__main">
              <a class="tour-row__title" href={`#/onderzoek/${card.landmarkId}`}>{card.name}</a>
              <span class="meta">
                {card.district ? `${tagLabel(card.district)} · ` : ''}
                {isEmpty(n) ? 'Nog geen onderzoek' : `${n.concept} te verifiëren · ${n.geverifieerd} geverifieerd · ${n.sources} ${n.sources === 1 ? 'bron' : 'bronnen'}`}
              </span>
            </div>
          </li>
        ))}
        {!visible.length && <li class="tour-row meta">Geen plekken gevonden.</li>}
      </ul>
    </main>
  );
}

export function ResearchPage({ id }: { id: string }) {
  const { landmarks, tours } = useAppState();
  const [adding, setAdding] = useState<'claim' | 'source' | null>(null);
  const saved = landmarks.find((l) => l.id === id && !l.deleted);
  const site = CATALOG.find((s) => catalogLandmarkId(s.id) === id);
  const lm = saved ?? (site ? landmarkFromCatalog(site) : undefined);
  if (!lm) return <main class="page"><p>Plek niet gevonden. <a href="#/onderzoek">Terug naar onderzoek</a></p></main>;

  const research = mergedResearch(saved, site?.id);
  const n = researchCounts(research);
  const draftSources = new Set(draftResearch(site?.id).sources.map((s) => s.id));
  const usedIn = tours.filter((t) => !t.deleted && t.stops.some((s) => s.landmarkId === id));
  const open = research.claims.filter((c) => c.status !== 'afgewezen');
  const rejected = research.claims.filter((c) => c.status === 'afgewezen');

  // A catalogue site is stored first exactly as the catalogue makes it, so every device has the same base record.
  async function apply(edit: (l: Landmark) => Landmark) {
    let current = getState().landmarks.find((l) => l.id === id && !l.deleted);
    if (!current && site) {
      current = landmarkFromCatalog(site);
      await ensureLandmark(current);
    }
    if (current) await saveLandmark(edit(current));
  }
  const saveClaim = (c: Claim) => apply((l) => withClaim(l, c));
  const claimItem = (c: Claim) => (
    <ClaimItem key={c.id} claim={c} sources={research.sources} onSave={saveClaim}
      onRemove={c.origin === 'gids' ? () => apply((l) => withoutClaim(l, c.id)) : undefined} />
  );

  return (
    <main class="page research">
      <a href="#/onderzoek" class="back">← Onderzoek</a>
      <div class="research__head">
        <h1 class="lit">{lm.name}</h1>
        {lm.nameKa && <p class="meta" lang="ka">{lm.nameKa}</p>}
        <p class="meta">
          {n.concept} te verifiëren · {n.geverifieerd} geverifieerd{n.afgewezen ? ` · ${n.afgewezen} afgewezen` : ''} · {n.sources} {n.sources === 1 ? 'bron' : 'bronnen'}
        </p>
        <p class="meta">
          {usedIn.length
            ? <>Gebruikt in {usedIn.map((t, i) => <span key={t.id}>{i > 0 ? ', ' : ''}<a href={`#/tour/${t.id}`}>{t.title || 'Naamloze tour'}</a></span>)}</>
            : 'Nog in geen enkele tour.'}
        </p>
      </div>

      <h2>Beweringen</h2>
      {open.length ? <ol class="claims">{open.map(claimItem)}</ol> : <p class="hint">Nog geen beweringen voor deze plek.</p>}
      {adding === 'claim'
        ? <div class="claim"><ClaimForm initial={createClaim()} sources={research.sources} submitLabel="Bewering toevoegen" onSave={(c) => { void saveClaim(c); setAdding(null); }} onCancel={() => setAdding(null)} /></div>
        : <button class="btn btn--ghost research__add" onClick={() => setAdding('claim')}>Eigen bewering toevoegen</button>}
      {rejected.length > 0 && (
        <details class="research__rejected">
          <summary>Afgewezen ({rejected.length})</summary>
          <ol class="claims">{rejected.map(claimItem)}</ol>
        </details>
      )}

      <h2>Bronnen</h2>
      {research.sources.length ? (
        <ol class="source-list">
          {research.sources.map((s) => (
            <li key={s.id}>
              <span><SourceLink source={s} /></span>
              {!draftSources.has(s.id) && <button class="icon-btn" aria-label={`Bron ${s.title} verwijderen`} onClick={() => apply((l) => withoutSource(l, s.id))}>×</button>}
            </li>
          ))}
        </ol>
      ) : <p class="hint">Nog geen bronnen.</p>}
      {adding === 'source'
        ? <SourceForm onSave={(s) => { void apply((l) => withSource(l, s)); setAdding(null); }} onCancel={() => setAdding(null)} />
        : <button class="btn btn--ghost research__add" onClick={() => setAdding('source')}>Bron toevoegen</button>}

      {site && (
        <details class="research__background">
          <summary>Achtergrond uit Wikipedia en Wikidata</summary>
          <SiteInfo info={site.info ?? null} osm={site.osm} />
        </details>
      )}
    </main>
  );
}

function ClaimItem({ claim, sources, onSave, onRemove }: { claim: Claim; sources: SourceRef[]; onSave: (c: Claim) => void; onRemove?: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li class="claim">
        <ClaimForm initial={claim} sources={sources} submitLabel="Opslaan" onSave={(c) => { onSave(c); setEditing(false); }} onCancel={() => setEditing(false)} />
      </li>
    );
  }
  const linked = claim.sourceIds.flatMap((sid) => sources.find((s) => s.id === sid) ?? []);
  const set = (status: Claim['status']) => onSave({ ...claim, status });
  return (
    <li class={`claim claim--${claim.status}`}>
      <div class="claim__top">
        <span class={`stamp stamp--${claim.kind}`}>{claim.kind}</span>
        <span class={`stamp stamp--${claim.status}`}>{CLAIM_STATUS[claim.status]}</span>
        <span class="meta claim__origin">{claim.origin === 'claude' ? 'Concept van Claude' : 'Eigen bewering'}</span>
      </div>
      <p class="claim__text lit">{claim.text}</p>
      {linked.length
        ? <ul class="claim__sources">{linked.map((s) => <li key={s.id}><SourceLink source={s} /></li>)}</ul>
        : <p class="hint hint--warn">Geen bron gekoppeld.</p>}
      {claim.evidence && <p class="claim__evidence"><span class="label">wat de bron zegt</span> {claim.evidence}</p>}
      {claim.note && <p class="hint hint--warn">{claim.note}</p>}
      <div class="claim__actions">
        {claim.status !== 'geverifieerd' && <button class="btn btn--small" onClick={() => set('geverifieerd')}>Bevestigen</button>}
        {claim.status !== 'afgewezen' && <button class="btn btn--small btn--ghost" onClick={() => set('afgewezen')}>Afwijzen</button>}
        {claim.status !== 'concept' && <button class="btn btn--small btn--ghost" onClick={() => set('concept')}>Terug naar concept</button>}
        <button class="btn btn--small btn--ghost" onClick={() => setEditing(true)}>Bewerken</button>
        {onRemove && <button class="btn btn--small btn--ghost btn--danger" onClick={onRemove}>Verwijderen</button>}
      </div>
    </li>
  );
}

function ClaimForm({ initial, sources, submitLabel, onSave, onCancel }: {
  initial: Claim; sources: SourceRef[]; submitLabel: string; onSave: (c: Claim) => void; onCancel: () => void;
}) {
  const [c, setC] = useState(initial);
  // Functional updates: two quick edits must not overwrite each other with a stale copy.
  const patch = (p: Partial<Claim>) => setC((x) => ({ ...x, ...p }));
  const toggle = (sid: string) => setC((x) => ({ ...x, sourceIds: x.sourceIds.includes(sid) ? x.sourceIds.filter((y) => y !== sid) : [...x.sourceIds, sid] }));
  function submit(e: Event) {
    e.preventDefault();
    const text = c.text.trim();
    if (!text) return;
    const next: Claim = { ...c, text };
    const note = c.note?.trim();
    if (note) next.note = note; else delete next.note;
    onSave(next);
  }
  return (
    <form class="claim-form" onSubmit={submit}>
      <label class="claim-form__kind">Soort
        <select value={c.kind} onChange={(e) => patch({ kind: e.currentTarget.value as ClaimKind })}>
          {KINDS.map((k) => <option value={k}>{k}</option>)}
        </select>
      </label>
      <label>Bewering<textarea class="lit" rows={3} required value={c.text} onInput={(e) => patch({ text: e.currentTarget.value })} /></label>
      {sources.length > 0 && (
        <fieldset class="claim-form__sources">
          <legend>Bronnen</legend>
          {sources.map((s) => (
            <label key={s.id} class="check">
              <input type="checkbox" checked={c.sourceIds.includes(s.id)} onChange={() => toggle(s.id)} />
              <span>{s.title}</span>
            </label>
          ))}
        </fieldset>
      )}
      <label>Notitie<textarea rows={2} value={c.note ?? ''} onInput={(e) => patch({ note: e.currentTarget.value })} /></label>
      <div class="claim__actions">
        <button class="btn btn--primary btn--small" type="submit">{submitLabel}</button>
        <button class="btn btn--ghost btn--small" type="button" onClick={onCancel}>Annuleren</button>
      </div>
    </form>
  );
}

function SourceForm({ onSave, onCancel }: { onSave: (s: SourceRef) => void; onCancel: () => void }) {
  const [s, setS] = useState<SourceRef>(createSource);
  const patch = (p: Partial<SourceRef>) => setS((x) => ({ ...x, ...p }));
  const urlOk = !s.url.trim() || isWebUrl(s.url);
  function submit(e: Event) {
    e.preventDefault();
    if (s.title.trim() && urlOk) onSave({ ...s, title: s.title.trim(), url: s.url.trim() });
  }
  return (
    <form class="claim claim-form" onSubmit={submit}>
      <label>Titel (auteur, werk, jaar)<input required value={s.title} onInput={(e) => patch({ title: e.currentTarget.value })} /></label>
      <label>Link (optioneel)<input type="url" inputMode="url" placeholder="https://…" value={s.url} onInput={(e) => patch({ url: e.currentTarget.value })} /></label>
      {!urlOk && <p class="hint hint--warn">Alleen links die met http:// of https:// beginnen.</p>}
      <div class="row">
        <label>Soort
          <select value={s.type} onChange={(e) => patch({ type: e.currentTarget.value })}>
            {Object.entries(SOURCE_TYPES).map(([k, l]) => <option value={k}>{l}</option>)}
          </select>
        </label>
        <label>Taal
          <select value={s.language} onChange={(e) => patch({ language: e.currentTarget.value })}>
            {Object.entries(LANGUAGES).map(([k, l]) => <option value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <div class="claim__actions">
        <button class="btn btn--primary btn--small" type="submit">Bron toevoegen</button>
        <button class="btn btn--ghost btn--small" type="button" onClick={onCancel}>Annuleren</button>
      </div>
    </form>
  );
}

export function SourceLink({ source }: { source: SourceRef }) {
  const label = [SOURCE_TYPES[source.type] ?? source.type, LANGUAGES[source.language] ?? source.language].filter(Boolean).join(' · ');
  return (
    <>
      {isWebUrl(source.url) ? <a href={source.url.trim()} target="_blank" rel="noopener noreferrer">{source.title}</a> : <span>{source.title}</span>}
      {label && <span class="meta"> · {label}</span>}
    </>
  );
}
