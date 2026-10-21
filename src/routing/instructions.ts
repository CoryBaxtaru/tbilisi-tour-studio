// Dutch turn instructions derived only from provider step data (OSRM maneuver type/modifier).
import type { RouteStep } from '../domain/types';
import { formatDistance } from '../domain/geo';

const DIRECTION: Record<string, string> = {
  left: 'linksaf',
  right: 'rechtsaf',
  'slight left': 'flauw links',
  'slight right': 'flauw rechts',
  'sharp left': 'scherp links',
  'sharp right': 'scherp rechts',
  straight: 'rechtdoor',
  uturn: 'omkeren',
};

export function instructionNl(step: RouteStep): string {
  const dir = DIRECTION[step.modifier] ?? '';
  const onto = step.name ? ` naar ${step.name}` : '';
  switch (step.type) {
    case 'depart':
      return step.name ? `Vertrek via ${step.name}` : 'Vertrek';
    case 'arrive':
      return 'Aangekomen bij de stop';
    case 'roundabout':
    case 'rotary':
      return `Neem de rotonde${onto}`;
    case 'continue':
    case 'new name':
      return `Ga ${dir || 'verder'}${onto}`;
    default:
      // turn, end of road, fork, merge, etc.
      if (step.modifier === 'uturn') return 'Keer om';
      return dir ? `Ga ${dir}${onto}` : `Ga verder${onto}`;
  }
}

/** Human-readable list, skipping zero-length noise steps. */
export function instructionList(steps: RouteStep[]): { text: string; distance: string }[] {
  return steps
    .filter((s) => s.type === 'arrive' || s.type === 'depart' || s.distanceM > 0)
    .map((s) => ({ text: instructionNl(s), distance: s.type === 'arrive' ? '' : formatDistance(s.distanceM) }));
}
