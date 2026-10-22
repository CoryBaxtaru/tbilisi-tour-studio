// "Toon meer": sourced background for a catalogue site (Wikipedia lead + Wikidata facts), with attribution.
import type { SiteInfo as Info } from '../domain/catalog';

const LANG_NAME: Record<string, string> = { nl: 'Nederlandstalige', en: 'Engelstalige' };

export function SiteInfo({ info, osm, fallback }: { info: Info | null; osm?: string; fallback?: string }) {
  if (!info) {
    return (
      <div class="site-info">
        <p class="hint">
          Nog geen achtergrondbron gekoppeld. {fallback ? fallback : 'Voeg eigen bronnen toe onder Onderzoek.'}
        </p>
        {osm && <p class="site-info__src"><a href={`https://www.openstreetmap.org/${osm}`} target="_blank" rel="noopener noreferrer">OpenStreetMap {osm}</a></p>}
      </div>
    );
  }
  return (
    <div class="site-info">
      {info.facts.length > 0 && (
        <dl class="site-info__facts">
          {info.facts.map((f) => (
            <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
          ))}
        </dl>
      )}
      {info.wiki ? (
        <>
          {info.wiki.lang !== 'nl' && <p class="site-info__lang">Uit de {LANG_NAME[info.wiki.lang] ?? info.wiki.lang} Wikipedia (geen Nederlandse versie):</p>}
          <div class="site-info__text" lang={info.wiki.lang}>
            {info.wiki.extract.split('\n').map((p, i) => <p key={i}>{p}</p>)}
            {info.wiki.truncated && <p class="meta">… (ingekort)</p>}
          </div>
        </>
      ) : (
        <p class="hint">Geen Wikipedia-artikel in het Nederlands of Engels gevonden.</p>
      )}
      <p class="site-info__src">
        {info.wiki && <>Tekst: <a href={info.wiki.url} target="_blank" rel="noopener noreferrer">Wikipedia, “{info.wiki.title}”</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.nl" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>{info.wiki.truncated ? ', ingekort' : ''}). </>}
        Feiten: <a href={`https://www.wikidata.org/wiki/${info.wikidata}`} target="_blank" rel="noopener noreferrer">Wikidata {info.wikidata}</a> (CC0). Opgehaald {info.retrievedAt}
        {info.wikidataVia === 'handmatig' ? '; koppeling handmatig gecontroleerd' : '; koppeling via OpenStreetMap'}.
        {osm && <> Positie: <a href={`https://www.openstreetmap.org/${osm}`} target="_blank" rel="noopener noreferrer">OSM</a>.</>}
      </p>
      <p class="hint">Bronnen voor achtergrond, geen geverifieerde vertelpunten: controleer belangrijke feiten voordat je ze vertelt.</p>
    </div>
  );
}
