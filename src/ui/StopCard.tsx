import { useState } from 'preact/hooks';
import { createTalkingPoint } from '../domain/factory';
import type { ClaimKind, Landmark, TalkingPoint, TourStop, Verification } from '../domain/types';

const KINDS: ClaimKind[] = ['feit', 'interpretatie', 'anekdote', 'onzeker'];
const VERIFICATION: Record<Verification, string> = { onbevestigd: 'Onbevestigd', deels: 'Deels geverifieerd', geverifieerd: 'Geverifieerd' };

interface Props {
  index: number;
  count: number;
  stop: TourStop;
  landmark: Landmark | undefined;
  usedInTours: number;
  picking: boolean;
  onStop: (s: TourStop) => void;
  onLandmark: (l: Landmark) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPickPosition: () => void;
}

export function StopCard(p: Props) {
  const [open, setOpen] = useState(!p.landmark?.name || p.landmark.name.startsWith('Nieuwe stop'));
  const { stop, landmark } = p;
  const name = landmark?.name || 'Onbekende bezienswaardigheid';
  const setStop = (patch: Partial<TourStop>) => p.onStop({ ...stop, ...patch });
  const setTp = (tp: TalkingPoint) => setStop({ talkingPoints: stop.talkingPoints.map((x) => (x.id === tp.id ? tp : x)) });

  return (
    <li class={`stop-card ${open ? 'stop-card--open' : ''}`}>
      <div class="stop-card__head">
        <span class="stop-card__num">{p.index + 1}</span>
        <button class="stop-card__title" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span class="lit">{name}</span>
          <span class="meta">{stop.speakingMinutes} min vertellen{landmark?.position ? '' : ' · geen positie'}</span>
        </button>
        <div class="stop-card__order">
          <button class="icon-btn" aria-label="Omhoog" disabled={p.index === 0} onClick={() => p.onMove(-1)}>↑</button>
          <button class="icon-btn" aria-label="Omlaag" disabled={p.index === p.count - 1} onClick={() => p.onMove(1)}>↓</button>
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
              <div class="row">
                <label>Verificatie
                  <select value={landmark.verification} onChange={(e) => p.onLandmark({ ...landmark, verification: e.currentTarget.value as Verification })}>
                    {Object.entries(VERIFICATION).map(([v, l]) => <option value={v}>{l}</option>)}
                  </select>
                </label>
                <button class={`btn ${p.picking ? 'btn--active' : ''}`} onClick={p.onPickPosition}>
                  {p.picking ? 'Klik op de kaart…' : landmark.position ? 'Positie wijzigen' : 'Positie kiezen'}
                </button>
              </div>
              {landmark.position && (
                <p class="hint">Positie: {landmark.position.lat.toFixed(5)}, {landmark.position.lng.toFixed(5)} ({landmark.positionSource === 'kaart' ? 'op kaart geplaatst' : landmark.positionSource})</p>
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
                  <button class="icon-btn" aria-label="Vertelpunt verwijderen" onClick={() => setStop({ talkingPoints: stop.talkingPoints.filter((x) => x.id !== tp.id) })}>×</button>
                </div>
              ))}
              <button class="btn btn--ghost" onClick={() => setStop({ talkingPoints: [...stop.talkingPoints, createTalkingPoint()] })}>Vertelpunt toevoegen</button>
            </div>
            <label>Overgang naar volgende stop<textarea rows={2} value={stop.transition} onInput={(e) => setStop({ transition: e.currentTarget.value })} /></label>
            <label>Notities voor de gids<textarea rows={2} value={stop.guideNotes} onInput={(e) => setStop({ guideNotes: e.currentTarget.value })} /></label>
            <div class="row">
              <label class="narrow">Vertellen (min)
                <input type="number" min={0} step={1} value={stop.speakingMinutes} onInput={(e) => setStop({ speakingMinutes: Math.max(0, Number(e.currentTarget.value) || 0) })} />
              </label>
              <button class="btn btn--danger" onClick={p.onRemove}>Stop uit tour halen</button>
            </div>
          </fieldset>
        </div>
      )}
    </li>
  );
}
