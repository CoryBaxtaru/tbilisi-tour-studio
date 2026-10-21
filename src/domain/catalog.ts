// Built-in catalogue of Tbilisi sites (src/data/tbilisi-sites.json, built by scripts/build-catalog.mjs).
// Positions and Georgian names come from OpenStreetMap (ODbL); names, tags and notes are unverified suggestions.
import data from '../data/tbilisi-sites.json';
import type { Landmark } from './types';
import type { Taggable } from './tags';

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
}

export const CATALOG: CatalogSite[] = data.sites as CatalogSite[];
export const CATALOG_SOURCE: string = data.source;
// Fixed timestamp so two devices that create the same catalogue landmark produce identical records.
const CATALOG_TIME = `${data.generatedAt}T00:00:00.000Z`;

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

/** A card in the deck: a catalogue site (possibly already saved as a landmark) or one of the guide's own landmarks. */
export interface DeckCard extends Taggable {
  key: string;
  landmarkId: string;
  lat: number | null;
  lng: number | null;
  site: CatalogSite | null;
  landmark: Landmark | null;
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
    });
  }
  return cards;
}
