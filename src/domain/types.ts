// Core domain model (see docs/PRODUCT_SPEC.md §4).
// Shared landmark knowledge is kept separate from tour-specific presentation (TourStop).

/** 2 = adds tour products, departures and bookings (2026-10-23). Version 1 files are still read. */
export const SCHEMA_VERSION = 2;

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

// ---- Business hub (internal; the founder enters everything) ----

/** A sellable tour: what guests book. Usually based on one of the guide's tours (route and talking points). */
export interface TourProduct extends SyncedEntity {
  name: string;
  tourId: Id | null;
  durationMin: number;
  /** Tour language; Dutch only for now. */
  language: 'nl';
  meetingPoint: string;
  maxGuests: number;
  /** Below this number of guests a departure does not run. */
  minGuests: number;
  included: string;
  notes: string;
  active: boolean;
  /** Prices, costs and channel commission (business hub step 5). Missing on older records: see pricingOf(). */
  pricing?: PriceProfile;
}

/**
 * How a product is priced. Amounts in EUR, entered by the guide; the code never ships real prices
 * (they are private business data and live only in the guide's synced data).
 */
export interface PriceProfile {
  kind: 'per-persoon' | 'prive';
  /** Per person (kind 'per-persoon'). */
  adult: number;
  child: number;
  infant: number;
  /** Private tour (kind 'prive'): flat fee for up to `privateIncluded` guests, then `privateExtra` each. */
  privateBase: number;
  privateIncluded: number;
  privateExtra: number;
  /** Direct costs per paying guest (tickets, tastings). */
  costPerGuest: number;
  /** Costs per departure that runs (transport, a fee). */
  fixedCost: number;
  /** Commission percentage per channel, e.g. { getyourguide: 30 }. */
  commission: Partial<Record<BookingChannel, number>>;
  /** Raise the price on commission channels so the net equals the direct price: price ÷ (1 − commission). */
  grossUp: boolean;
}

export type DepartureStatus = 'gepland' | 'bevestigd' | 'afgerond' | 'geannuleerd';

/** A product on a date and start time, with a number of places. */
export interface Departure extends SyncedEntity {
  productId: Id;
  /** Local Tbilisi date, YYYY-MM-DD. */
  date: string;
  /** Local start time, HH:MM. */
  startTime: string;
  capacity: number;
  status: DepartureStatus;
  notes: string;
}

export type BookingChannel = 'getyourguide' | 'direct' | 'whatsapp' | 'walk-in' | 'anders';
export type BookingStatus = 'geboekt' | 'geannuleerd' | 'no-show';

/**
 * A booking the guide entered. Holds personal data (lead name, one contact field, notes), which is erased
 * RETENTION_MONTHS after the tour (src/domain/agenda.ts); counts and amounts stay for the books.
 */
export interface Booking extends SyncedEntity {
  departureId: Id;
  channel: BookingChannel;
  /** The channel's booking number, e.g. a GetYourGuide reference. */
  reference: string;
  leadName: string;
  /** Phone number or e-mail address. */
  contact: string;
  adults: number;
  children: number;
  infants: number;
  /** Agreed total in EUR, as paid by the guest. */
  priceTotal: number;
  /** Channel commission in EUR. */
  commission: number;
  paid: boolean;
  status: BookingStatus;
  notes: string;
  /** Set when the personal data was erased. */
  anonymizedAt?: IsoDate;
}

export interface Collections {
  tours: Tour[];
  landmarks: Landmark[];
  products: TourProduct[];
  departures: Departure[];
  bookings: Booking[];
}

export type Kind = keyof Collections;
export const KINDS: Kind[] = ['tours', 'landmarks', 'products', 'departures', 'bookings'];

export interface Dataset extends Collections {
  schemaVersion: number;
  exportedAt?: IsoDate;
}
