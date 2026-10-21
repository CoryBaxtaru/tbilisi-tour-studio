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
}

export type Verification = 'onbevestigd' | 'deels' | 'geverifieerd';

/** Where a coordinate came from. Coordinates are never invented by the app. */
export type PositionSource = 'kaart' | 'gps' | 'import';

export interface Landmark extends SyncedEntity {
  name: string;
  nameKa: string;
  position: LatLng | null;
  positionSource: PositionSource | null;
  summary: string;
  researchNotes: string;
  verification: Verification;
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
