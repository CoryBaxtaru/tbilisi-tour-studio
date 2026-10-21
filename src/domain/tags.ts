// Tag vocabulary for the card deck. Era boundaries are conventional periodisations, meant as
// tour-planning aids, not precise historical claims; tag assignments per site are unverified suggestions.

export interface TagDef {
  id: string;
  label: string;
  hint?: string;
}

export const ERAS: TagDef[] = [
  { id: 'oudheid', label: 'Oudheid', hint: 'Colchis en Iberië (Kartli), tot ca. 5e eeuw' },
  { id: 'stichting', label: 'Stichting van Tbilisi', hint: 'Vroege middeleeuwen, ca. 5e–10e eeuw' },
  { id: 'gouden-eeuw', label: 'Gouden Eeuw', hint: 'Verenigd koninkrijk, ca. 11e–13e eeuw' },
  { id: 'overheersing', label: 'Vreemde overheersing', hint: 'Mongools, Perzisch, Ottomaans, ca. 13e–18e eeuw' },
  { id: 'erekle', label: 'Erekle II', hint: 'Kartli-Kacheti, 18e eeuw' },
  { id: 'russisch-rijk', label: 'Russisch Rijk', hint: '1801–1918' },
  { id: 'republiek', label: 'Eerste Republiek', hint: '1918–1921' },
  { id: 'sovjet', label: 'Sovjettijd', hint: '1921–1991' },
  { id: 'onafhankelijk', label: 'Onafhankelijk Georgië', hint: '1991–heden' },
];

export const THEMES: TagDef[] = [
  { id: 'historisch', label: 'Historisch' },
  { id: 'cultureel', label: 'Cultureel' },
  { id: 'religieus', label: 'Religieus' },
  { id: 'multicultureel', label: 'Multicultureel' },
  { id: 'architectuur', label: 'Architectuur' },
  { id: 'politiek', label: 'Politiek en protest' },
  { id: 'kunst', label: 'Kunst en theater' },
  { id: 'literatuur', label: 'Literatuur' },
  { id: 'eten', label: 'Eten en markten' },
  { id: 'natuur', label: 'Natuur' },
  { id: 'uitzicht', label: 'Uitzicht en foto' },
  { id: 'modern', label: 'Modern' },
];

export const DISTRICTS: TagDef[] = [
  { id: 'oude-stad', label: 'Oude stad' },
  { id: 'sololaki', label: 'Sololaki' },
  { id: 'rustaveli', label: 'Rustaveli' },
  { id: 'avlabari', label: 'Avlabari' },
  { id: 'mtatsminda', label: 'Mtatsminda' },
  { id: 'chughureti', label: 'Chughureti' },
  { id: 'vake', label: 'Vake' },
  { id: 'buiten', label: 'Buiten het centrum' },
];

const ALL = new Map([...ERAS, ...THEMES, ...DISTRICTS].map((t) => [t.id, t]));

export function tagLabel(id: string): string {
  return ALL.get(id)?.label ?? id;
}

export function isEra(id: string): boolean {
  return ERAS.some((e) => e.id === id);
}

export interface DeckFilter {
  query: string;
  eras: string[];
  themes: string[];
  districts: string[];
}

export const EMPTY_FILTER: DeckFilter = { query: '', eras: [], themes: [], districts: [] };

export interface Taggable {
  name: string;
  nameKa: string;
  tags: string[];
  district: string;
  summary: string;
}

/** OR within a group, AND across groups; free text matches names and description. */
export function matchesFilter(item: Taggable, f: DeckFilter): boolean {
  const anyOf = (wanted: string[]) => !wanted.length || wanted.some((t) => item.tags.includes(t));
  if (!anyOf(f.eras) || !anyOf(f.themes)) return false;
  if (f.districts.length && !f.districts.includes(item.district)) return false;
  const q = normalize(f.query.trim());
  if (!q) return true;
  return [item.name, item.nameKa, item.summary].some((s) => normalize(s).includes(q));
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
