// Core domain model (see docs/PRODUCT_SPEC.md §4).
// Shared landmark knowledge is kept separate from tour-specific presentation (TourStop).

export const SCHEMA_VERSION = 1;

export type Id = string;
export type IsoDate = string;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Fields every synced record carries. `deleted` is a tombstone so deletions sync across devices. */
export interface SyncedEntity {
  id: Id;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  deleted?: boolean;
}

/** How certain a statement is. Mirrors the provenance stamps in .interface-design/system.md. */
export type ClaimKind = 'feit' | 'interpretatie' | 'anekdote' | 'onzeker';

export interface TalkingPoint {
  id: Id;
  text: string;
  kind: ClaimKind;
  /** Free-text source reference(s) the guide entered; empty means unsourced. */
  source: string;
  /** Research claim (Landmark.claims or a catalogue draft) this point was copied from; its status is shown with the point. */
  claimId?: Id;
}

export type Verification = 'onbevestigd' | 'deels' | 'geverifieerd';

/** Where a claim comes from. `type` is a key of SOURCE_TYPES (src/domain/research.ts); `language` an ISO 639-1 code. */
export interface SourceRef {
  id: Id;
  title: string;
  url: string;
  type: string;
  language: string;
}

export type ClaimStatus = 'concept' | 'geverifieerd' | 'afgewezen';

/** A reusable statement about a landmark with its sources and the guide's verdict (docs/RESEARCH.md). */
export interface Claim {
  id: Id;
  kind: ClaimKind;
  text: string;
  sourceIds: Id[];
  status: ClaimStatus;
  /** 'claude' = concept from the bundled research drafts; 'gids' = written by the guide. */
  origin: 'claude' | 'gids';
  /** Short summary of what the source says, so the guide can check quickly. */
  evidence?: string;
  note?: string;
}

/** Where a coordinate came from. Coordinates are never invented by the app. */
export type PositionSource = 'kaart' | 'gps' | 'import' | 'osm';

export interface Landmark extends SyncedEntity {
  name: string;
  nameKa: string;
  position: LatLng | null;
  positionSource: PositionSource | null;
  summary: string;
  researchNotes: string;
  verification: Verification;
  /** Era and theme tag ids (src/domain/tags.ts). Optional for records created before tags existed. */
  tags?: string[];
  district?: string;
  /** Set when the landmark was created from the built-in site catalogue. */
  catalogId?: string;
  /** OpenStreetMap object the position came from, e.g. "way/123". */
  osm?: string;
  /** The guide's own sources and saved versions of draft sources (see mergedResearch). */
  sources?: SourceRef[];
  /** The guide's own claims and draft claims the guide verified, rejected or edited. */
  claims?: Claim[];
}

export interface TourStop {
  id: Id;
  landmarkId: Id;
  arrivalNote: string;
  talkingPoints: TalkingPoint[];
  transition: string;
  guideNotes: string;
  speakingMinutes: number;
}

export interface RouteStep {
  type: string;
  modifier: string;
  name: string;
  distanceM: number;
}

/** A computed pedestrian route between two consecutive stops, stored so it works offline. */
export interface RouteLeg {
  fromStopId: Id;
  toStopId: Id;
  distanceM: number;
  durationS: number;
  /** [lat, lng] pairs. */
  geometry: [number, number][];
  steps: RouteStep[];
  provider: string;
  computedAt: IsoDate;
}

export type TourStatus = 'concept' | 'beoordeeld' | 'klaar';

export interface Tour extends SyncedEntity {
  title: string;
  description: string;
  theme: string;
  audience: string;
  status: TourStatus;
  stops: TourStop[];
  legs: RouteLeg[];
  breakMinutes: number;
}

export interface Dataset {
  schemaVersion: number;
  exportedAt?: IsoDate;
  tours: Tour[];
  landmarks: Landmark[];
}
