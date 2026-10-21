import type { Landmark, LatLng, PositionSource, TalkingPoint, Tour, TourStop } from './types';

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createTour(title = 'Nieuwe tour'): Tour {
  const now = nowIso();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title,
    description: '',
    theme: '',
    audience: '',
    status: 'concept',
    stops: [],
    legs: [],
    breakMinutes: 0,
  };
}

export function createLandmark(name: string, position: LatLng | null, positionSource: PositionSource | null): Landmark {
  const now = nowIso();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name,
    nameKa: '',
    position,
    positionSource: position ? positionSource : null,
    summary: '',
    researchNotes: '',
    verification: 'onbevestigd',
  };
}

export function createStop(landmarkId: string): TourStop {
  return {
    id: newId(),
    landmarkId,
    arrivalNote: '',
    talkingPoints: [],
    transition: '',
    guideNotes: '',
    speakingMinutes: 5,
  };
}

export function createTalkingPoint(): TalkingPoint {
  return { id: newId(), text: '', kind: 'onzeker', source: '' };
}

/** Returns a copy with a fresh updatedAt; use for every user edit so sync can order changes. */
export function touch<T extends { updatedAt: string }>(entity: T): T {
  return { ...entity, updatedAt: nowIso() };
}
