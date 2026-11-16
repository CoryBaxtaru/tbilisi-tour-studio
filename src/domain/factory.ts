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

/**
 * Returns a copy with a fresh updatedAt; use for every user edit so sync can order changes. The new time is always
 * later than the old one: sync tells "changed" from "unchanged" by updatedAt alone, so a second edit in the same
 * millisecond (or with the clock set back) would otherwise look like no edit and be overwritten.
 */
export function touch<T extends { updatedAt: string }>(entity: T): T {
  const now = nowIso();
  const later = now > entity.updatedAt ? now : new Date(Date.parse(entity.updatedAt) + 1).toISOString();
  return { ...entity, updatedAt: later };
}
