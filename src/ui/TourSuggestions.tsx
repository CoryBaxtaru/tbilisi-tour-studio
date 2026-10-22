// Pre-generated tours from tags, plus an all-in-one tour and a custom tag combination.
import { useMemo, useState } from 'preact/hooks';
import { buildDeck, CATALOG, catalogLandmarkId, landmarkFromCatalog } from '../domain/catalog';
import { createTour } from '../domain/factory';
import { formatDistance } from '../domain/geo';
import { candidatesFor, pathLength, suggestTour, TEMPLATES, type OrderMode, type TourTemplate } from '../domain/suggest';
import { DISTRICTS, ERAS, EMPTY_FILTER, tagLabel, THEMES, type DeckFilter } from '../domain/tags';
import { mergedResearch, starterPoints } from '../domain/research';
import { insertStop } from '../domain/tourOps';
import { ensureLandmark, saveTour, useAppState } from '../state/store';
import { ChipGroup } from './CardDeck';
import { navigate } from './router';

type MaxChoice = 'standaard' | 'alle' | '6' | '8' | '10' | '12' | '16';

export function TourSuggestions() {
  const { landmarks } = useAppState();
  const deck = useMemo(() => buildDeck(landmarks), [landmarks]);
  const [maxChoice, setMaxChoice] = useState<MaxChoice>('standaard');
  const [order, setOrder] = useState<OrderMode>('kortste');
  const [outside, setOutside] = useState(false);
  const [custom, setCustom] = useState<DeckFilter>(EMPTY_FILTER);
  const [busy, setBusy] = useState(false);

  const maxFor = (t: TourTemplate) => (maxChoice === 'standaard' ? t.defaultMax : maxChoice === 'alle' ? null : Number(maxChoice));

  async function create(title: string, filter: Partial<DeckFilter>, max: number | null) {
    setBusy(true);
    try {
      const sites = suggestTour(deck, filter, { max, includeOutside: outside, order });
      let tour = createTour(title);
      for (const c of sites) {
        const site = c.site ?? CATALOG.find((s) => catalogLandmarkId(s.id) === c.landmarkId);
        if (site) await ensureLandmark(landmarkFromCatalog(site));
        tour = insertStop(tour, c.landmarkId, undefined, starterPoints(mergedResearch(c.landmark, site?.id)));
      }
      const tags = [...(filter.eras ?? []), ...(filter.themes ?? []), ...(filter.districts ?? [])].map(tagLabel);
      tour = {
        ...tour,
        theme: title,
        description:
          `Automatisch voorgesteld${tags.length ? ` op basis van: ${tags.join(', ')}` : ' met alle plekken uit de catalogus'}` +
          `${outside ? ' (inclusief plekken buiten het centrum)' : ' (alleen het centrum)'}. ` +
          `${sites.length} plekken, volgorde: ${order === 'kortste' ? 'kortste wandeling (hemelsbreed geschat)' : 'chronologisch op tijdperk'}. ` +
          'Controleer volgorde, inhoud en de onbevestigde tags.',
      };
      await saveTour(tour);
      navigate(`/tour/${tour.id}`);
    } finally {
      setBusy(false);
    }
  }

  // Previews are pure but not free (ordering up to ~50 sites): compute only when inputs change.
  const previews = useMemo(() => new Map(TEMPLATES.map((t) => {
    const preview = suggestTour(deck, t.filter, { max: maxFor(t), includeOutside: outside, order: 'kortste' });
    return [t.id, { count: preview.length, length: pathLength(preview), total: candidatesFor(deck, t.filter, outside).length }];
  })), [deck, maxChoice, outside]);
  const customCount = candidatesFor(deck, custom, outside).length;
  const customActive = custom.eras.length + custom.themes.length + custom.districts.length > 0;
  const toggle = (group: 'eras' | 'themes' | 'districts', id: string) =>
    setCustom((f) => ({ ...f, [group]: f[group].includes(id) ? f[group].filter((x) => x !== id) : [...f[group], id] }));

  return (
    <section class="suggest">
      <div class="page__head">
        <h2>Kant-en-klare tours</h2>
      </div>
      <p class="hint">Maakt een nieuwe tour uit de kaarten met deze tags. Het is een startpunt: de volgorde is geografisch of chronologisch, niet verhalend, en de tags zijn nog onbevestigd. Daarna kun je alles slepen en aanpassen.</p>
      <div class="suggest__options">
        <label>Aantal stops
          <select value={maxChoice} onChange={(e) => setMaxChoice(e.currentTarget.value as MaxChoice)}>
            <option value="standaard">Standaard (±10)</option>
            {['6', '8', '10', '12', '16'].map((n) => <option value={n}>{n}</option>)}
            <option value="alle">Alle passende plekken</option>
          </select>
        </label>
        <label>Volgorde
          <select value={order} onChange={(e) => setOrder(e.currentTarget.value as OrderMode)}>
            <option value="kortste">Kortste wandeling</option>
            <option value="chronologisch">Chronologisch (tijdperk)</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" checked={outside} onChange={(e) => setOutside(e.currentTarget.checked)} /> Ook plekken buiten het centrum (vervoer nodig)</label>
      </div>

      <ul class="suggest__grid">
        {TEMPLATES.map((t) => {
          const max = maxFor(t);
          const p = previews.get(t.id)!;
          return (
            <li key={t.id} class={`suggest-card ${t.id === 'compleet' ? 'suggest-card--all' : ''}`}>
              <h3 class="lit">{t.title}</h3>
              <p class="meta">{t.description}</p>
              <p class="suggest-card__stats">{p.count} van {p.total} plekken · ± {formatDistance(p.length)} hemelsbreed</p>
              <button class="btn btn--primary" disabled={busy || !p.count} onClick={() => create(t.title, t.filter, max)}>Maak tour</button>
            </li>
          );
        })}
      </ul>

      <details class="suggest__custom">
        <summary>Eigen combinatie van tags</summary>
        <div class="deck__filters">
          <ChipGroup label="Tijdperk" defs={ERAS} selected={custom.eras} onToggle={(id) => toggle('eras', id)} />
          <ChipGroup label="Soort tour" defs={THEMES} selected={custom.themes} onToggle={(id) => toggle('themes', id)} />
          <ChipGroup label="Wijk" defs={DISTRICTS} selected={custom.districts} onToggle={(id) => toggle('districts', id)} />
        </div>
        <div class="row">
          <span class="hint">{customCount} passende plekken</span>
          <button
            class="btn btn--primary"
            disabled={busy || !customActive || !customCount}
            onClick={() => create(`Tour: ${[...custom.eras, ...custom.themes, ...custom.districts].map(tagLabel).join(' + ')}`, custom, maxChoice === 'alle' ? null : maxChoice === 'standaard' ? 10 : Number(maxChoice))}
          >
            Maak tour van deze tags
          </button>
        </div>
      </details>
    </section>
  );
}
