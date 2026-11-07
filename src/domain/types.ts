// Core domain model (see docs/PRODUCT_SPEC.md §4).
// Shared landmark knowledge is kept separate from tour-specific presentation (TourStop).

/** 2 = tour products, departures and bookings (2026-10-23). 3 = general costs (2026-11-06). 4 = blocked days (2026-11-07). Older files are still read. */
export const SCHEMA_VERSION = 4;

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
  /** Opening hours, dress code and the like, each with a source and a date. */
  practical?: PracticalNote[];
  /** Spoken story saved from a pasted Claude answer (src/domain/storyExchange.ts). */
  story?: SavedStory;
}

export type PracticalKind = 'openingstijden' | 'gesloten' | 'kleding' | 'toilet' | 'schaduw' | 'water' | 'anders';

/** A practical detail about a site. Never without a source and the date it was checked. */
export interface PracticalNote {
  id: Id;
  kind: PracticalKind;
  text: string;
  /** A link, or for example "zelf gezien". */
  source: string;
  /** YYYY-MM-DD. */
  checkedOn: string;
}

export interface SavedSentence { text: string; claimIds: Id[] }
export interface SavedQuestion { question: string; answer: string; claimIds: Id[] }

/** Story text for one site. Facts stay in claims, so a rejected claim also removes the sentences resting on it. */
export interface SavedStory {
  sentences: SavedSentence[];
  /** How to say the name in a sentence, e.g. "de Metekhi-kerk". */
  short?: string;
  /** One anchor in time, for the timeline order. */
  year?: number;
  era?: string;
  /** Spoken link to the next site, by that site's catalogue id. */
  bridges: Record<string, string>;
  questions: SavedQuestion[];
  /** Opening and closing of a whole storyline, stored on its first site; the key is the sorted site ids. */
  storylines: Record<string, { title: string; opening: string; closing: string }>;
  savedAt: IsoDate;
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
  /** Text for the product sheet. */
  description?: string;
  /** One highlight per line. */
  highlights?: string;
  cancellationTerms?: string;
  /** Link to the meeting point on a map, for messages to guests. */
  meetingMapUrl?: string;
  /** What guests should bring, for the reminder. */
  bring?: string;
  /** Where guests can leave a review, for the review request. */
  reviewUrl?: string;
  /** What to do when the weather is bad: shelter, a shorter route, where to wait. */
  badWeatherPlan?: string;
  /** A tour to guide instead when the weather is bad. */
  badWeatherTourId?: Id | null;
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
  /** What guests said and what to improve; no names. */
  feedback?: Feedback[];
  /** The guide closed this departure on GetYourGuide, so nobody can book it there any more. */
  closedOnGyg?: boolean;
  /** A private group: nobody else can join, so the departure counts as full. */
  private?: boolean;
}

export interface Feedback {
  id: Id;
  at: IsoDate;
  kind: 'gast' | 'verbeterpunt';
  /** 1 to 5, only for what a guest said. */
  stars?: number;
  text: string;
}

/** A day without tours: a holiday or a personal day. */
export interface BlockedDay extends SyncedEntity {
  /** YYYY-MM-DD. */
  date: string;
  reason: string;
}

export type MessageKind = 'bevestiging' | 'herinnering' | 'review';

/** An amount paid in Georgian lari, with the rate the guide used. Totals stay in EUR. */
export interface GelAmount { amount: number; gelPerEur: number }

export type BookingChannel = 'getyourguide' | 'direct' | 'instagram' | 'whatsapp' | 'walk-in' | 'anders';
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
  /** Phone number, e-mail address or Instagram name (@name). */
  contact: string;
  adults: number;
  children: number;
  infants: number;
  /** Agreed total in EUR, as paid by the guest. */
  priceTotal: number;
  /** Channel commission in EUR. */
  commission: number;
  /** Given back to the guest on a booking that still counts, in EUR. */
  refund?: number;
  /** What the guide keeps from a cancelled booking, in EUR. Without it a cancelled booking counts as nothing. */
  cancelFee?: number;
  /** Guests who showed up at the meeting point. Undefined means not checked in yet. */
  arrived?: number;
  /** When each message to this guest was copied or opened. */
  messagesSent?: Partial<Record<MessageKind, IsoDate>>;
  /** Set when the guest paid in lari; priceTotal is then this amount converted to EUR. */
  gel?: GelAmount;
  paid: boolean;
  status: BookingStatus;
  notes: string;
  /** Set when the personal data was erased. */
  anonymizedAt?: IsoDate;
}

export type ExpenseCategory = 'vervoer' | 'telefoon' | 'reclame' | 'verzekering' | 'belasting' | 'materiaal' | 'anders';

/** A cost that does not belong to one departure, such as insurance or a phone bill. */
export interface Expense extends SyncedEntity {
  /** YYYY-MM-DD. */
  date: string;
  category: ExpenseCategory;
  description: string;
  /** In EUR. */
  amount: number;
  gel?: GelAmount;
}

export interface Collections {
  tours: Tour[];
  landmarks: Landmark[];
  products: TourProduct[];
  departures: Departure[];
  bookings: Booking[];
  expenses: Expense[];
  blocked: BlockedDay[];
}

export type Kind = keyof Collections;
export const KINDS: Kind[] = ['tours', 'landmarks', 'products', 'departures', 'bookings', 'expenses', 'blocked'];

export interface Dataset extends Collections {
  schemaVersion: number;
  exportedAt?: IsoDate;
}
