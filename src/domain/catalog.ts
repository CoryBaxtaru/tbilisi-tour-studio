// Built-in catalogue of Tbilisi sites (src/data/tbilisi-sites.json, built by scripts/build-catalog.mjs).
// Positions and Georgian names come from OpenStreetMap (ODbL); names, tags and notes are unverified suggestions.
import data from '../data/tbilisi-sites.json';
import type { Landmark } from './types';
import type { Taggable } from './tags';

/** Sourced background for "Toon meer" (scripts/enrich-catalog.mjs). */
export interface SiteInfo {
  wikidata: string;
  /** 'osm' = taken from the OSM object's wikidata tag; 'handmatig' = set and checked by hand. */
  wikidataVia: string;
  wikidataLabel: string;
  facts: { label: string; value: string }[];
  wiki: { lang: string; title: string; url: string; extract: string; truncated: boolean } | null;
  retrievedAt: string;
}

export interface CatalogSite {
  id: string;
  name: string;
  nameKa: string;
  district: string;
  eras: string[];
  themes: string[];
  note: string;
  lat: number;
  lng: number;
  osm: string;
  osmName: string;
  info?: SiteInfo;
}

export const CATALOG: CatalogSite[] = data.sites as CatalogSite[];
export const CATALOG_SOURCE: string = data.source;
export const INFO_SOURCE: string = (data as { infoSource?: string }).infoSource ?? '';
// Fixed timestamp so two devices that create the same catalogue landmark produce identical records.
const CATALOG_TIME = data.generatedAt.includes('T') ? data.generatedAt : `${data.generatedAt}T00:00:00.000Z`;

export function catalogLandmarkId(siteId: string): string {
  return `cat:${siteId}`;
}

export function landmarkFromCatalog(site: CatalogSite): Landmark {
  return {
    id: catalogLandmarkId(site.id),
    createdAt: CATALOG_TIME,
    updatedAt: CATALOG_TIME,
    name: site.name,
    nameKa: site.nameKa,
    position: { lat: site.lat, lng: site.lng },
    positionSource: 'osm',
    summary: site.note,
    researchNotes: `Positie: OpenStreetMap ${site.osm} (© OpenStreetMap-bijdragers, ODbL). Beschrijving en tags: voorstel uit de catalogus, nog niet geverifieerd.`,
    verification: 'onbevestigd',
    tags: [...site.eras, ...site.themes],
    district: site.district,
    catalogId: site.id,
    osm: site.osm,
  };
}

/**
 * Catalogue landmarks the guide never edited still carry their catalogue timestamp
 * (createdAt === updatedAt; any edit sets a new updatedAt). When the bundled catalogue is newer, return the fresh versions so
 * corrections (e.g. a better position) reach existing data. Edited landmarks are never replaced.
 * Deterministic, so every device produces the same records and sync stays conflict-free.
 */
export function staleCatalogLandmarks(landmarks: Landmark[]): { fresh: Landmark; moved: boolean }[] {
  const out: { fresh: Landmark; moved: boolean }[] = [];
  for (const lm of landmarks) {
    if (!lm.catalogId || lm.deleted) continue;
    const untouched = lm.createdAt === lm.updatedAt;
    if (!untouched || lm.updatedAt >= CATALOG_TIME) continue;
    const site = CATALOG.find((s) => s.id === lm.catalogId);
    if (!site) continue;
    const fresh = landmarkFromCatalog(site);
    const moved = fresh.position?.lat !== lm.position?.lat || fresh.position?.lng !== lm.position?.lng;
    out.push({ fresh, moved });
  }
  return out;
}

/** A card in the deck: a catalogue site (possibly already saved as a landmark) or one of the guide's own landmarks. */
export interface DeckCard extends Taggable {
  key: string;
  landmarkId: string;
  lat: number | null;
  lng: number | null;
  site: CatalogSite | null;
  landmark: Landmark | null;
  info: SiteInfo | null;
}

export function buildDeck(landmarks: Landmark[]): DeckCard[] {
  const byId = new Map(landmarks.filter((l) => !l.deleted).map((l) => [l.id, l]));
  const cards: DeckCard[] = CATALOG.map((site) => {
    const lm = byId.get(catalogLandmarkId(site.id)) ?? null;
    // Once saved, the guide's edited landmark wins over the catalogue text.
    const src = lm ?? landmarkFromCatalog(site);
    return {
      key: catalogLandmarkId(site.id),
      landmarkId: catalogLandmarkId(site.id),
      name: src.name,
      nameKa: src.nameKa,
      summary: src.summary,
      tags: src.tags ?? [],
      district: src.district ?? '',
      lat: src.position?.lat ?? null,
      lng: src.position?.lng ?? null,
      site,
      landmark: lm,
      info: site.info ?? null,
    };
  });
  for (const lm of byId.values()) {
    if (lm.catalogId) continue;
    cards.push({
      key: lm.id,
      landmarkId: lm.id,
      name: lm.name,
      nameKa: lm.nameKa,
      summary: lm.summary,
      tags: lm.tags ?? [],
      district: lm.district ?? '',
      lat: lm.position?.lat ?? null,
      lng: lm.position?.lng ?? null,
      site: null,
      landmark: lm,
      info: null,
    });
  }
  return cards;
}
