import { useState } from 'preact/hooks';
import { createTalkingPoint } from '../domain/factory';
import { CLAIM_STATUS, linkedClaim, mergedResearch, talkingPointFromClaim } from '../domain/research';
import { DISTRICTS, ERAS, THEMES, type TagDef } from '../domain/tags';
import type { Claim, ClaimKind, Landmark, TalkingPoint, TourStop, Verification } from '../domain/types';

const KINDS: ClaimKind[] = ['feit', 'interpretatie', 'anekdote', 'onzeker'];
const VERIFICATION: Record<Verification, string> = { onbevestigd: 'Onbevestigd', deels: 'Deels geverifieerd', geverifieerd: 'Geverifieerd' };

interface Props {
  index: number;
  count: number;
  stop: TourStop;
  landmark: Landmark | undefined;
  usedInTours: number;
  picking: boolean;
  /** Walking info from the previous stop, e.g. "6 min lopen · 400 m"; null for the first stop. */
  legInfo: { text: string; missing: boolean } | null;
  onStop: (s: TourStop) => void;
  onLandmark: (l: Landmark) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPickPosition: () => void;
}

export function StopCard(p: Props) {
  const [open, setOpen] = useState(false);
  const { stop, landmark } = p;
  const name = landmark?.name || 'Onbekende bezienswaardigheid';
  const setStop = (patch: Partial<TourStop>) => p.onStop({ ...stop, ...patch });
  const setTp = (tp: TalkingPoint) => setStop({ talkingPoints: stop.talkingPoints.map((x) => (x.id === tp.id ? tp : x)) });
  const tags = landmark?.tags ?? [];
  const toggleTag = (id: string) => landmark && p.onLandmark({ ...landmark, tags: tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id] });
  const research = mergedResearch(landmark);
  const used = new Set(stop.talkingPoints.flatMap((tp) => tp.claimId ?? []));
  const available = research.claims.filter((c) => c.status !== 'afgewezen' && !used.has(c.id));

  return (
    <li class={`stop-card ${open ? 'stop-card--open' : ''}`} data-stop-id={stop.id}>
      {p.legInfo && <div class={`stop-card__leg ${p.legInfo.missing ? 'is-missing' : ''}`}>{p.legInfo.text}</div>}
      <div class="stop-card__head">
        <span class="drag-handle" title="Sleep om de volgorde te wijzigen" aria-hidden="true">⋮⋮</span>
        <span class="stop-card__num">{p.index + 1}</span>
        <button class="stop-card__title" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span class="lit">{name}</span>
          <span class="meta">{stop.speakingMinutes} min vertellen{landmark?.position ? '' : ' · geen positie'}</span>
        </button>
        <div class="stop-card__order">
          <button class="icon-btn" aria-label={`${name} omhoog`} disabled={p.index === 0} onClick={() => p.onMove(-1)}>↑</button>
          <button class="icon-btn" aria-label={`${name} omlaag`} disabled={p.index === p.count - 1} onClick={() => p.onMove(1)}>↓</button>
          <button class="icon-btn" aria-label={`${name} uit de route halen`} onClick={p.onRemove}>×</button>
        </div>
      </div>

      {open && (
        <div class="stop-card__body">
          {landmark && (
            <fieldset class="shared">
              <legend>Gedeelde kennis{p.usedInTours > 1 ? ` — gebruikt in ${p.usedInTours} tours` : ''}</legend>
              <label>Naam<input value={landmark.name} onInput={(e) => p.onLandmark({ ...landmark, name: e.currentTarget.value })} /></label>
              <label>Georgische naam<input lang="ka" value={landmark.nameKa} onInput={(e) => p.onLandmark({ ...landmark, nameKa: e.currentTarget.value })} /></label>
              <label>Korte uitleg<textarea rows={2} value={landmark.summary} onInput={(e) => p.onLandmark({ ...landmark, summary: e.currentTarget.value })} /></label>
              <label>Onderzoeksnotities (privé)<textarea rows={2} value={landmark.researchNotes} onInput={(e) => p.onLandmark({ ...landmark, researchNotes: e.currentTarget.value })} /></label>
              <TagToggles label="Tijdperk" defs={ERAS} tags={tags} onToggle={toggleTag} />
              <TagToggles label="Soort tour" defs={THEMES} tags={tags} onToggle={toggleTag} />
              <div class="row">
                <label>Wijk
                  <select value={landmark.district ?? ''} onChange={(e) => p.onLandmark({ ...landmark, district: e.currentTarget.value })}>
                    <option value="">—</option>
                    {DISTRICTS.map((d) => <option value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <label>Verificatie
                  <select value={landmark.verification} onChange={(e) => p.onLandmark({ ...landmark, verification: e.currentTarget.value as Verification })}>
                    {Object.entries(VERIFICATION).map(([v, l]) => <option value={v}>{l}</option>)}
                  </select>
                </label>
              </div>
              <div class="row">
                <button class={`btn ${p.picking ? 'btn--active' : ''}`} onClick={p.onPickPosition}>
                  {p.picking ? 'Klik op de kaart…' : landmark.position ? 'Positie wijzigen' : 'Positie kiezen'}
                </button>
              </div>
              {landmark.position && (
                <p class="hint">
                  Positie: {landmark.position.lat.toFixed(5)}, {landmark.position.lng.toFixed(5)} ({positionLabel(landmark)})
                </p>
              )}
            </fieldset>
          )}

          <fieldset>
            <legend>Alleen deze tour</legend>
            <label>Aankomstnotitie (voor een snelle blik)<textarea rows={2} value={stop.arrivalNote} onInput={(e) => setStop({ arrivalNote: e.currentTarget.value })} /></label>
            <div class="tp-list">
              <span class="label">Vertelpunten</span>
              {stop.talkingPoints.map((tp) => (
                <div class="tp" key={tp.id}>
                  <select class={`stamp stamp--${tp.kind}`} value={tp.kind} aria-label="Soort bewering" onChange={(e) => setTp({ ...tp, kind: e.currentTarget.value as ClaimKind })}>
                    {KINDS.map((k) => <option value={k}>{k}</option>)}
                  </select>
                  <textarea class="lit" rows={2} value={tp.text} placeholder="Wat je hardop zegt" onInput={(e) => setTp({ ...tp, text: e.currentTarget.value })} />
                  <input value={tp.source} placeholder="Bron (titel, link)" onInput={(e) => setTp({ ...tp, source: e.currentTarget.value })} />
                  <ClaimFlag claim={linkedClaim(tp, research)} />
                  <button class="icon-btn" aria-label="Vertelpunt verwijderen" onClick={() => setStop({ talkingPoints: stop.talkingPoints.filter((x) => x.id !== tp.id) })}>×</button>
                </div>
              ))}
              <button class="btn btn--ghost" onClick={() => setStop({ talkingPoints: [...stop.talkingPoints, createTalkingPoint()] })}>Vertelpunt toevoegen</button>
              {landmark && (
                <details class="tp-research">
                  <summary>Uit onderzoek ({available.length} beschikbaar)</summary>
                  {available.length > 0 && (
                    <ul class="tp-research__list">
                      {available.map((c) => (
                        <li key={c.id}>
                          <div class="claim__top">
                            <span class={`stamp stamp--${c.kind}`}>{c.kind}</span>
                            <span class={`stamp stamp--${c.status}`}>{CLAIM_STATUS[c.status]}</span>
                          </div>
                          <p class="lit">{c.text}</p>
                          <button class="btn btn--small" onClick={() => setStop({ talkingPoints: [...stop.talkingPoints, talkingPointFromClaim(c, research.sources)] })}>Als vertelpunt gebruiken</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <a class="tp-research__link" href={`#/onderzoek/${landmark.id}`}>Bronnen en beweringen van deze plek</a>
                </details>
              )}
            </div>
            <label>Overgang naar volgende stop<textarea rows={2} value={stop.transition} onInput={(e) => setStop({ transition: e.currentTarget.value })} /></label>
            <label>Notities voor de gids<textarea rows={2} value={stop.guideNotes} onInput={(e) => setStop({ guideNotes: e.currentTarget.value })} /></label>
            <label class="narrow">Vertellen (min)
              <input type="number" min={0} step={1} value={stop.speakingMinutes} onInput={(e) => setStop({ speakingMinutes: Math.max(0, Number(e.currentTarget.value) || 0) })} />
            </label>
          </fieldset>
        </div>
      )}
    </li>
  );
}

/** Verification status of the research claim a talking point was copied from. */
function ClaimFlag({ claim }: { claim: Claim | undefined }) {
  if (!claim) return null;
  const text = claim.status === 'concept' ? 'Concept: nog niet geverifieerd' : claim.status === 'afgewezen' ? 'Afgewezen in onderzoek' : 'Geverifieerd';
  return <span class={`stamp stamp--${claim.status} tp__flag`}>{text}</span>;
}

function positionLabel(l: Landmark): string {
  if (l.positionSource === 'osm') return `OpenStreetMap ${l.osm ?? ''}`.trim();
  if (l.positionSource === 'kaart') return 'op kaart geplaatst';
  return l.positionSource ?? 'onbekend';
}

function TagToggles({ label, defs, tags, onToggle }: { label: string; defs: TagDef[]; tags: string[]; onToggle: (id: string) => void }) {
  return (
    <div class="chip-group" role="group" aria-label={label}>
      <span class="label">{label}</span>
      <div class="chip-group__chips">
        {defs.map((d) => (
          <button key={d.id} class={`chip chip--filter ${tags.includes(d.id) ? 'is-on' : ''}`} aria-pressed={tags.includes(d.id)} title={d.hint} onClick={() => onToggle(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
