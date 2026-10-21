// The card deck: every catalogue site and own landmark as a draggable card, with tag filters.
import { useState } from 'preact/hooks';
import type { DeckCard } from '../domain/catalog';
import { DISTRICTS, ERAS, THEMES, isEra, matchesFilter, tagLabel, type DeckFilter, type TagDef } from '../domain/tags';
import { useDeckSortable } from './sortable';

interface Props {
  cards: DeckCard[];
  filter: DeckFilter;
  onFilter: (f: DeckFilter) => void;
  /** Position in the tour (1-based) for cards already used, by landmark id. */
  usedAt: Map<string, number>;
  onAdd: (card: DeckCard) => void;
  onFocus: (card: DeckCard) => void;
  focusedKey: string | null;
}

export function CardDeck({ cards, filter, onFilter, usedAt, onAdd, onFocus, focusedKey }: Props) {
  const ref = useDeckSortable();
  const [showFilters, setShowFilters] = useState(true);
  const visible = cards.filter((c) => matchesFilter(c, filter));
  const active = filter.eras.length + filter.themes.length + filter.districts.length;

  const toggle = (group: 'eras' | 'themes' | 'districts', id: string) => {
    const cur = filter[group];
    onFilter({ ...filter, [group]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <section class="deck" aria-label="Kaartendeck">
      <div class="deck__head">
        <h2>Kaartendeck</h2>
        <span class="meta">{visible.length} van {cards.length}</span>
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
      </div>
      {showFilters && (
        <div class="deck__filters">
          <ChipGroup label="Tijdperk" defs={ERAS} selected={filter.eras} onToggle={(id) => toggle('eras', id)} />
          <ChipGroup label="Soort tour" defs={THEMES} selected={filter.themes} onToggle={(id) => toggle('themes', id)} />
          <ChipGroup label="Wijk" defs={DISTRICTS} selected={filter.districts} onToggle={(id) => toggle('districts', id)} />
        </div>
      )}
      <p class="hint deck__hint">Sleep een kaart naar de route, of tik op +. Tags en beschrijvingen zijn voorstellen: controleer ze voor gebruik.</p>
      <ul class="deck__list" ref={ref}>
        {visible.map((c) => {
          const used = usedAt.get(c.landmarkId);
          return (
            <li
              key={c.key}
              class={`deck-card ${used ? 'deck-card--used' : ''} ${focusedKey === c.key ? 'deck-card--focus' : ''}`}
              data-landmark-id={c.landmarkId}
              data-key={c.key}
            >
              <div class="deck-card__top">
                <button class="deck-card__name lit" onClick={() => onFocus(c)} title="Toon op de kaart">{c.name}</button>
                {used
                  ? <span class="deck-card__used">stop {used}</span>
                  : <button class="icon-btn deck-card__add" aria-label={`${c.name} aan de route toevoegen`} onClick={() => onAdd(c)} disabled={c.lat === null}>+</button>}
              </div>
              {c.nameKa && <div class="deck-card__ka" lang="ka">{c.nameKa}</div>}
              {c.summary && <p class="deck-card__note">{c.summary}</p>}
              <div class="deck-card__tags">
                {c.tags.filter(isEra).map((t) => <span key={t} class="chip chip--era">{tagLabel(t)}</span>)}
                {c.tags.filter((t) => !isEra(t)).map((t) => <span key={t} class="chip chip--theme">{tagLabel(t)}</span>)}
              </div>
              <div class="deck-card__foot">
                {c.district && <span>{tagLabel(c.district)}</span>}
                {c.site ? <span>Catalogus · {c.landmark?.verification === 'geverifieerd' ? 'geverifieerd' : 'onbevestigd'}</span> : <span>Eigen</span>}
              </div>
            </li>
          );
        })}
      </ul>
      {!visible.length && <p class="hint">Geen kaarten met deze filters.</p>}
    </section>
  );
}

function ChipGroup({ label, defs, selected, onToggle }: { label: string; defs: TagDef[]; selected: string[]; onToggle: (id: string) => void }) {
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
