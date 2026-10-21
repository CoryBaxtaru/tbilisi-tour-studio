# Site catalogue (card deck)

The editor's card deck holds the built-in Tbilisi sites (`src/data/tbilisi-sites.json`, currently 58) plus every landmark the guide creates. Drag a card into the route, tap **+**, or click a dot on the map and choose "Aan route toevoegen". Reorder by dragging the ⋮⋮ handle, like the stop list in Google Maps, or with the ↑/↓ buttons. When online, the walking route recalculates automatically about 1.5 s after a change (FOSSGIS walking routes).

## Building a route
- **Proximity sort:** the deck is sorted by straight-line distance to the **last stop** of the route by default (or the first stop, A–Z, catalogue order). Each card shows e.g. "130 m van Grote Synagoge"; cards already in the route move to the bottom.
- **Click a card** (anywhere except its buttons): the map flies to the site, centres it, rings it and opens its popup. On a phone the map scrolls into view.
- **Kant-en-klare tours** (Tours page): 11 themed templates plus **Tbilisi compleet** (every central site) and a custom tag combination. You choose the number of stops (default about 10, or all), the order (shortest walk, or chronological by era) and whether to include sites outside the centre. A capped selection picks the most compact, most relevant group. The ordering is straight-line, open-path nearest neighbour plus 2-opt, so it is a geographic or chronological starting point, not a narrative one. The created tour's description says how it was generated.

## "Toon meer": sourced background
- Built by `node scripts/enrich-catalog.mjs` (build time only; the app never calls these services):
  1. the Wikidata id comes from the **`wikidata` tag on each site's OSM object** (no fuzzy matching);
  2. **Wikidata facts** (CC0): built/founded, architect, style, heritage status, named after;
  3. the **Wikipedia introduction** (CC BY-SA 4.0): Dutch if an article exists, otherwise English, shown in English and labelled as such (no machine translation). Cut at a sentence boundary at 1,400 characters and marked "ingekort".
- Each card shows title, link, licence, Wikidata id and retrieval date. Background is for reading, not verified talking points.
- Status 2026-10-21: 55/58 sites linked (8 Dutch texts, 31 English, 16 facts only). No source for Waterval van Leghvtakhevi, Fabrika and Dezerter-bazaar.
- Links checked by hand: every Wikidata label matched its site, except Freedom Square. Its OSM object carried Rustavelilaan's id, so it was corrected to Q36998. Shardeni (Q3448534), Aghmashenebeli Avenue (Q5242038) and the cable car (Q25378215) were added by hand after checking the Wikidata description.

## Catalogue updates reach existing data
Catalogue landmarks carry the catalogue build time as createdAt and updatedAt. If you never edited one (createdAt = updatedAt) and the bundled catalogue is newer, the app replaces it on start and drops stored routes to a moved site, so they are recalculated. Every device does the same, so sync stays conflict-free. Your edits are never replaced.

## Status of the data: read before guiding
- **Positions and Georgian names** come from OpenStreetMap via Nominatim, with the exact OSM object recorded per site (© OpenStreetMap contributors, **ODbL**). The catalogue file is a derived database and is also under ODbL; attribution is shown in the app.
- **Dutch names, short notes, era tags, tour-type tags and districts are suggestions by Claude, not verified research.** Every catalogue landmark starts as `onbevestigd`. Verify them before presenting anything as fact. Edit them in the stop card (Gedeelde kennis); edits sync and override the catalogue text.
- Era boundaries (`src/domain/tags.ts`) are conventional periodisations meant for planning, not precise claims.
- No opening hours, prices or accessibility information is included.

## Tags
- **Tijdperk:** Oudheid · Stichting van Tbilisi · Gouden Eeuw · Vreemde overheersing · Erekle II · Russisch Rijk (1801–1918) · Eerste Republiek (1918–1921) · Sovjettijd (1921–1991) · Onafhankelijk Georgië (1991–heden)
- **Soort tour:** Historisch · Cultureel · Religieus · Multicultureel · Architectuur · Politiek en protest · Kunst en theater · Literatuur · Eten en markten · Natuur · Uitzicht en foto · Modern
- **Wijk:** Oude stad · Sololaki · Rustaveli · Avlabari · Mtatsminda · Chughureti · Vake · Buiten het centrum

Filters combine as OR within a group and AND across groups. For example, Sovjettijd + Architectuur gives the Soviet-era buildings.

## How it syncs
Catalogue landmarks get fixed ids (`cat:<id>`) and a fixed timestamp. Adding the same site on the laptop and on the phone therefore creates identical records, never a sync conflict. Only sites actually used or edited are stored; the rest come from the bundled file.

## Adding or fixing sites
1. Edit `scripts/catalog-source.mjs`: add `{ id, name, q, district, eras, themes, note }`. Use `osm: 'N123' | 'W123' | 'R123'` to pin an exact OSM object when search picks the wrong one.
2. Run `node scripts/build-catalog.mjs --only <id>` (Nominatim, 1 request/s), then **check the printed OSM match**.
3. Run `npm test`. It checks ids, tags, districts and OSM provenance, and that every point lies inside Tbilisi.
4. Regenerate the review list below: `node scripts/catalog-table.mjs`.
5. Refresh background info: `node scripts/enrich-catalog.mjs` (add `--wikidata id=Q123` for a hand-checked link), then check the printed labels.

Matches corrected by hand on 2026-10-21:
- Rustavelilaan: the first hit was the Opera.
- Parliament: pinned R1020718.
- University: the first building, Chavchavadze 1.
- Meidan: the square, not a sign on it.
- Museum of Fine Arts: pinned N637763969, the Amiranashvili museum.
- Ethnographic museum: pinned R14141290.
- Stalin's printing house: pinned W1376878173, "Avlabari printing house".
- Cable car (2026-10-22): the OSM line put the point mid-river; pinned the Rike lower station N1668768830 (found with one Overpass query), district Avlabari.

## Review list

| Kaart | Wijk | Tijdperk (voorstel) | Soort tour (voorstel) | OSM |
|---|---|---|---|---|
| Vrijheidsplein (voorheen Leninplein) | Rustaveli | Russisch Rijk, Sovjettijd, Onafhankelijk Georgië | Historisch, Politiek en protest, Architectuur | [way/220709392](https://www.openstreetmap.org/way/220709392) |
| Rustavelilaan | Rustaveli | Russisch Rijk, Eerste Republiek, Sovjettijd, Onafhankelijk Georgië | Historisch, Cultureel, Politiek en protest, Architectuur | [way/86696581](https://www.openstreetmap.org/way/86696581) |
| Parlementsgebouw (Rustavelilaan) | Rustaveli | Sovjettijd, Onafhankelijk Georgië | Politiek en protest, Historisch, Architectuur | [relation/1020718](https://www.openstreetmap.org/relation/1020718) |
| Paleis van de onderkoning (Jeugdpaleis) | Rustaveli | Russisch Rijk, Eerste Republiek | Historisch, Politiek en protest, Architectuur | [relation/14069191](https://www.openstreetmap.org/relation/14069191) |
| Kashveti-kerk | Rustaveli | Russisch Rijk | Religieus, Architectuur | [way/65299828](https://www.openstreetmap.org/way/65299828) |
| Georgisch Nationaal Museum | Rustaveli | Oudheid, Gouden Eeuw, Sovjettijd | Historisch, Cultureel | [node/412214448](https://www.openstreetmap.org/node/412214448) |
| Rustaveli-theater | Rustaveli | Russisch Rijk, Sovjettijd | Kunst en theater, Cultureel, Architectuur | [relation/19640789](https://www.openstreetmap.org/relation/19640789) |
| Opera- en balletheater | Rustaveli | Russisch Rijk | Kunst en theater, Architectuur, Cultureel | [way/59151604](https://www.openstreetmap.org/way/59151604) |
| Museum voor Schone Kunsten | Oude stad | Gouden Eeuw | Kunst en theater, Religieus, Cultureel | [node/637763969](https://www.openstreetmap.org/node/637763969) |
| Staatsuniversiteit Tbilisi (eerste gebouw) | Vake | Eerste Republiek, Sovjettijd | Historisch, Cultureel, Architectuur | [relation/900361](https://www.openstreetmap.org/relation/900361) |
| Voormalig ministerie van Wegenbouw | Buiten het centrum | Sovjettijd | Architectuur, Modern | [way/1236448832](https://www.openstreetmap.org/way/1236448832) |
| Narikala-vesting | Oude stad | Stichting van Tbilisi, Vreemde overheersing | Historisch, Uitzicht en foto | [relation/9820020](https://www.openstreetmap.org/relation/9820020) |
| Moeder van Georgië (Kartlis Deda) | Oude stad | Sovjettijd | Cultureel, Uitzicht en foto | [way/1063062536](https://www.openstreetmap.org/way/1063062536) |
| Abanotubani (zwavelbaden) | Oude stad | Stichting van Tbilisi, Vreemde overheersing, Russisch Rijk | Historisch, Cultureel, Multicultureel, Architectuur | [relation/2073134](https://www.openstreetmap.org/relation/2073134) |
| Chreli Abano (Orbeliani-bad) | Oude stad | Vreemde overheersing, Russisch Rijk | Architectuur, Cultureel | [way/503326365](https://www.openstreetmap.org/way/503326365) |
| Waterval van Leghvtakhevi | Oude stad | — | Natuur, Uitzicht en foto | [node/1800715289](https://www.openstreetmap.org/node/1800715289) |
| Jumah-moskee | Oude stad | Russisch Rijk | Religieus, Multicultureel | [way/506741615](https://www.openstreetmap.org/way/506741615) |
| Meidan (Gorgasaliplein) | Oude stad | Vreemde overheersing, Russisch Rijk | Historisch, Eten en markten, Multicultureel | [way/709355801](https://www.openstreetmap.org/way/709355801) |
| Erekle II-plein | Oude stad | Erekle II | Historisch | [way/709359129](https://www.openstreetmap.org/way/709359129) |
| Sioni-kathedraal | Oude stad | Stichting van Tbilisi, Gouden Eeuw, Vreemde overheersing | Religieus, Historisch | [way/77895547](https://www.openstreetmap.org/way/77895547) |
| Anchiskhati-basiliek | Oude stad | Stichting van Tbilisi | Religieus, Historisch, Architectuur | [way/337365208](https://www.openstreetmap.org/way/337365208) |
| Klokkentoren van het Gabriadze-theater | Oude stad | Onafhankelijk Georgië | Kunst en theater, Uitzicht en foto | [node/1567308849](https://www.openstreetmap.org/node/1567308849) |
| Shardeni-straat | Oude stad | Onafhankelijk Georgië | Eten en markten, Cultureel | [way/1041451281](https://www.openstreetmap.org/way/1041451281) |
| Museum voor de geschiedenis van Tbilisi (Karvasla) | Oude stad | Vreemde overheersing, Russisch Rijk | Historisch, Cultureel | [node/4325006493](https://www.openstreetmap.org/node/4325006493) |
| Grote Synagoge | Oude stad | Russisch Rijk | Religieus, Multicultureel | [way/75311791](https://www.openstreetmap.org/way/75311791) |
| Norashen-kerk | Oude stad | Vreemde overheersing | Religieus, Multicultureel | [way/284620213](https://www.openstreetmap.org/way/284620213) |
| Betlemi-kerk en trappen | Oude stad | Erekle II | Religieus, Uitzicht en foto | [way/163799009](https://www.openstreetmap.org/way/163799009) |
| Ateshgah (vuurtempel) | Oude stad | Vreemde overheersing | Religieus, Multicultureel, Historisch | [way/1206891444](https://www.openstreetmap.org/way/1206891444) |
| Nationale Botanische Tuin | Oude stad | Russisch Rijk | Natuur | [relation/19630635](https://www.openstreetmap.org/relation/19630635) |
| Kabelbaan Rike–Narikala | Avlabari | Onafhankelijk Georgië | Uitzicht en foto, Modern | [node/1668768830](https://www.openstreetmap.org/node/1668768830) |
| Sololaki-wijk | Sololaki | Russisch Rijk | Architectuur, Historisch | [relation/2073133](https://www.openstreetmap.org/relation/2073133) |
| Kote Afkhazi-straat | Sololaki | Russisch Rijk | Historisch, Multicultureel, Eten en markten | [way/133607532](https://www.openstreetmap.org/way/133607532) |
| Gudiashvili-plein | Sololaki | Russisch Rijk | Architectuur, Kunst en theater | [way/172908444](https://www.openstreetmap.org/way/172908444) |
| Schrijvershuis van Georgië | Sololaki | Russisch Rijk, Sovjettijd | Literatuur, Architectuur | [way/163798516](https://www.openstreetmap.org/way/163798516) |
| Metekhi-kerk | Avlabari | Gouden Eeuw, Vreemde overheersing | Religieus, Historisch, Uitzicht en foto | [way/1064270003](https://www.openstreetmap.org/way/1064270003) |
| Ruiterstandbeeld Vakhtang Gorgasali | Avlabari | Stichting van Tbilisi, Sovjettijd | Historisch, Uitzicht en foto | [way/1062990549](https://www.openstreetmap.org/way/1062990549) |
| Vredesbrug | Oude stad | Onafhankelijk Georgië | Modern, Uitzicht en foto | [way/125589004](https://www.openstreetmap.org/way/125589004) |
| Rikepark | Avlabari | Onafhankelijk Georgië | Natuur, Modern | [relation/9868102](https://www.openstreetmap.org/relation/9868102) |
| Sameba-kathedraal (Heilige Drie-eenheid) | Avlabari | Onafhankelijk Georgië | Religieus, Architectuur, Uitzicht en foto | [way/585352693](https://www.openstreetmap.org/way/585352693) |
| Voormalig presidentieel paleis | Avlabari | Onafhankelijk Georgië | Politiek en protest, Modern | [way/362739744](https://www.openstreetmap.org/way/362739744) |
| Ondergrondse drukkerij van Stalin | Avlabari | Russisch Rijk | Politiek en protest, Historisch | [way/1376878173](https://www.openstreetmap.org/way/1376878173) |
| Paleis van koningin Darejan | Avlabari | Erekle II | Historisch, Uitzicht en foto | [way/123574122](https://www.openstreetmap.org/way/123574122) |
| Europaplein | Avlabari | Onafhankelijk Georgië | Modern, Politiek en protest | [way/1217904103](https://www.openstreetmap.org/way/1217904103) |
| Public Service Hall | Oude stad | Onafhankelijk Georgië | Modern, Architectuur | [way/1066392731](https://www.openstreetmap.org/way/1066392731) |
| Pantheon van Mtatsminda | Mtatsminda | Russisch Rijk, Sovjettijd | Literatuur, Historisch, Religieus | [relation/9841336](https://www.openstreetmap.org/relation/9841336) |
| Kabelspoorweg naar Mtatsminda | Mtatsminda | Russisch Rijk | Uitzicht en foto | [way/1042188760](https://www.openstreetmap.org/way/1042188760) |
| Mtatsminda-park | Mtatsminda | Sovjettijd, Onafhankelijk Georgië | Uitzicht en foto, Natuur | [relation/13443464](https://www.openstreetmap.org/relation/13443464) |
| Rommelmarkt bij de Droge Brug | Oude stad | Sovjettijd, Onafhankelijk Georgië | Eten en markten, Cultureel | [way/1150481713](https://www.openstreetmap.org/way/1150481713) |
| Aghmashenebeli-laan | Chughureti | Russisch Rijk | Architectuur, Eten en markten, Multicultureel | [way/28502375](https://www.openstreetmap.org/way/28502375) |
| Marjanishvili-theater | Chughureti | Sovjettijd | Kunst en theater, Cultureel | [node/390460502](https://www.openstreetmap.org/node/390460502) |
| Fabrika | Chughureti | Sovjettijd, Onafhankelijk Georgië | Modern, Kunst en theater, Eten en markten | [way/548795814](https://www.openstreetmap.org/way/548795814) |
| Dezerter-bazaar | Chughureti | — | Eten en markten | [way/236526369](https://www.openstreetmap.org/way/236526369) |
| Circus van Tbilisi | Buiten het centrum | Sovjettijd | Architectuur, Kunst en theater | [way/1234716193](https://www.openstreetmap.org/way/1234716193) |
| Vakepark | Vake | Sovjettijd | Natuur | [relation/17233994](https://www.openstreetmap.org/relation/17233994) |
| Schildpaddenmeer | Buiten het centrum | — | Natuur, Uitzicht en foto | [way/28043570](https://www.openstreetmap.org/way/28043570) |
| Openluchtmuseum voor Etnografie | Buiten het centrum | Sovjettijd | Cultureel, Historisch, Natuur | [relation/14141290](https://www.openstreetmap.org/relation/14141290) |
| Kroniek van Georgië | Buiten het centrum | Sovjettijd | Kunst en theater, Uitzicht en foto, Historisch | [way/707446533](https://www.openstreetmap.org/way/707446533) |
| Blauw Klooster (Lurji Monastiri) | Chughureti | Gouden Eeuw | Religieus, Historisch | [way/188447537](https://www.openstreetmap.org/way/188447537) |
