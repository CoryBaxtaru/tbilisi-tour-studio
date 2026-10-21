// The card deck: every catalogue site and own landmark as a draggable card, with tag filters,
// proximity sorting and sourced background ("Toon meer").
import { useState } from 'preact/hooks';
import type { DeckCard } from '../domain/catalog';
import { formatDistance } from '../domain/geo';
import { byDistance } from '../domain/suggest';
import { DISTRICTS, ERAS, THEMES, isEra, matchesFilter, tagLabel, type DeckFilter, type TagDef } from '../domain/tags';
import type { LatLng } from '../domain/types';
import { SiteInfo } from './SiteInfo';
import { useDeckSortable } from './sortable';

export type DeckSort = 'laatste' | 'eerste' | 'az' | 'catalogus';

export interface Anchor {
  position: LatLng;
  label: string;
}

interface Props {
  cards: DeckCard[];
  filter: DeckFilter;
  onFilter: (f: DeckFilter) => void;
  sort: DeckSort;
  onSort: (s: DeckSort) => void;
  /** First and last stop of the route (with a position), for proximity sorting. */
  anchors: { first: Anchor | null; last: Anchor | null };
  /** Position in the tour (1-based) for cards already used, by landmark id. */
  usedAt: Map<string, number>;
  onAdd: (card: DeckCard) => void;
  onFocus: (card: DeckCard) => void;
  focusedKey: string | null;
}

export function CardDeck({ cards, filter, onFilter, sort, onSort, anchors, usedAt, onAdd, onFocus, focusedKey }: Props) {
  const ref = useDeckSortable();
  const [showFilters, setShowFilters] = useState(false);
  const [openInfo, setOpenInfo] = useState<Set<string>>(new Set());
  const active = filter.eras.length + filter.themes.length + filter.districts.length;

  const filtered = cards.filter((c) => matchesFilter(c, filter));
  const anchor = sort === 'laatste' ? anchors.last : sort === 'eerste' ? anchors.first : null;
  const sorted: { card: DeckCard; distanceM: number | null }[] = anchor
    ? byDistance(filtered, anchor.position)
    : (sort === 'az' ? filtered.slice().sort((a, b) => a.name.localeCompare(b.name, 'nl')) : filtered).map((card) => ({ card, distanceM: null }));
  // Cards already in the route go last, so the nearest *next* options stay on top.
  const rows = [...sorted.filter((r) => !usedAt.has(r.card.landmarkId)), ...sorted.filter((r) => usedAt.has(r.card.landmarkId))];

  const toggle = (group: 'eras' | 'themes' | 'districts', id: string) => {
    const cur = filter[group];
    onFilter({ ...filter, [group]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const toggleInfo = (key: string) => setOpenInfo((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  return (
    <section class="deck" aria-label="Kaartendeck">
      <div class="deck__head">
        <h2>Kaartendeck</h2>
        <span class="meta">{filtered.length} van {cards.length}</span>
      </div>
      <input
        type="search"
        class="deck__search"
        placeholder="Zoek op naam, ook Georgisch"
        aria-label="Zoek in het kaartendeck"
        value={filter.query}
        onInput={(e) => onFilter({ ...filter, query: e.currentTarget.value })}
      />
      <div class="deck__filterbar">
        <button class="btn btn--ghost btn--small" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          Filters{active ? ` (${active})` : ''}
        </button>
        {active > 0 && <button class="btn btn--ghost btn--small" onClick={() => onFilter({ ...filter, eras: [], themes: [], districts: [] })}>Wissen</button>}
        <select class="deck__sort" aria-label="Sorteren" value={sort} onChange={(e) => onSort(e.currentTarget.value as DeckSort)}>
          <option value="laatste">Dichtbij laatste stop</option>
          <option value="eerste">Dichtbij eerste stop</option>
          <option value="az">A–Z</option>
          <option value="catalogus">Catalogusvolgorde</option>
        </select>
      </div>
      {showFilters && (
        <div class="deck__filters">
          <ChipGroup label="Tijdperk" defs={ERAS} selected={filter.eras} onToggle={(id) => toggle('eras', id)} />
          <ChipGroup label="Soort tour" defs={THEMES} selected={filter.themes} onToggle={(id) => toggle('themes', id)} />
          <ChipGroup label="Wijk" defs={DISTRICTS} selected={filter.districts} onToggle={(id) => toggle('districts', id)} />
        </div>
      )}
      <p class="hint deck__hint">
        {anchor
          ? <>Gesorteerd op afstand (hemelsbreed) tot <strong>{anchor.label}</strong>. Sleep een kaart naar de route of tik op +.</>
          : (sort === 'laatste' || sort === 'eerste')
            ? 'Voeg een stop toe; daarna staan de dichtstbijzijnde plekken bovenaan.'
            : 'Sleep een kaart naar de route of tik op +. Tik op een kaart om hem op de kaart te tonen.'}
      </p>
      <ul class="deck__list" ref={ref}>
        {rows.map(({ card: c, distanceM }) => {
          const used = usedAt.get(c.landmarkId);
          const infoOpen = openInfo.has(c.key);
          return (
            <li
              key={c.key}
              class={`deck-card ${used ? 'deck-card--used' : ''} ${focusedKey === c.key ? 'deck-card--focus' : ''}`}
              data-landmark-id={c.landmarkId}
              data-key={c.key}
              onClick={(e) => { if (!(e.target as HTMLElement).closest('button, a, .site-info')) onFocus(c); }}
            >
              <div class="deck-card__top">
                <button class="deck-card__name lit" onClick={() => onFocus(c)} title="Toon op de kaart">{c.name}</button>
                {used
                  ? <span class="deck-card__used">stop {used}</span>
                  : <button class="icon-btn deck-card__add" aria-label={`${c.name} aan de route toevoegen`} onClick={() => onAdd(c)} disabled={c.lat === null}>+</button>}
              </div>
              {c.nameKa && <div class="deck-card__ka" lang="ka">{c.nameKa}</div>}
              {distanceM !== null && !used && <div class="deck-card__dist">{formatDistance(distanceM)} van {anchor!.label}</div>}
              {c.summary && <p class="deck-card__note">{c.summary}</p>}
              <div class="deck-card__tags">
                {c.tags.filter(isEra).map((t) => <span key={t} class="chip chip--era">{tagLabel(t)}</span>)}
                {c.tags.filter((t) => !isEra(t)).map((t) => <span key={t} class="chip chip--theme">{tagLabel(t)}</span>)}
              </div>
              <div class="deck-card__foot">
                <button class="link deck-card__more" aria-expanded={infoOpen} onClick={() => toggleInfo(c.key)}>{infoOpen ? 'Toon minder' : 'Toon meer'}</button>
                <span>{c.district ? tagLabel(c.district) : ''}{c.site ? ' · catalogus' : ' · eigen'}</span>
              </div>
              {infoOpen && <SiteInfo info={c.info} osm={c.site?.osm} fallback={c.site ? undefined : c.landmark?.researchNotes || undefined} />}
            </li>
          );
        })}
      </ul>
      {!filtered.length && <p class="hint">Geen kaarten met deze filters.</p>}
    </section>
  );
}

export function ChipGroup({ label, defs, selected, onToggle }: { label: string; defs: TagDef[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div class="chip-group" role="group" aria-label={label}>
      <span class="label">{label}</span>
      <div class="chip-group__chips">
        {defs.map((d) => (
          <button
            key={d.id}
            class={`chip chip--filter ${selected.includes(d.id) ? 'is-on' : ''}`}
            aria-pressed={selected.includes(d.id)}
            title={d.hint}
            onClick={() => onToggle(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
