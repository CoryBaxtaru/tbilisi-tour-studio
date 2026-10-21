// Source list for the Tbilisi site catalogue (card deck).
// Names, tags and notes are SUGGESTIONS by Claude for the guide to review: verification 'onbevestigd'.
// Coordinates are NOT written here: scripts/build-catalog.mjs looks them up in OpenStreetMap (Nominatim)
// and records the OSM object as provenance. `q` is the search query; `osm` pins an exact object if needed.
//
// Fields: id, name (Dutch display name), q, district, eras[], themes[], note (short Dutch description).

export const SITES = [
  // Rustaveli & Freedom Square
  { id: 'vrijheidsplein', name: 'Vrijheidsplein (voorheen Leninplein)', q: 'Freedom Square, Tbilisi', district: 'rustaveli', eras: ['russisch-rijk', 'sovjet', 'onafhankelijk'], themes: ['historisch', 'politiek', 'architectuur'], note: 'Centraal plein; in de Sovjettijd Leninplein, nu met de Sint-Joriszuil.' },
  { id: 'rustaveli-avenue', name: 'Rustavelilaan', q: 'Shota Rustaveli Avenue, Tbilisi', district: 'rustaveli', eras: ['russisch-rijk', 'republiek', 'sovjet', 'onafhankelijk'], themes: ['historisch', 'cultureel', 'politiek', 'architectuur'], note: 'Hoofdboulevard met theaters, musea en het oude parlement; decor van veel protesten.' },
  { id: 'oud-parlement', osm: 'R1020718', name: 'Parlementsgebouw (Rustavelilaan)', q: 'Rustaveli Avenue 8, Tbilisi', district: 'rustaveli', eras: ['sovjet', 'onafhankelijk'], themes: ['politiek', 'historisch', 'architectuur'], note: 'Monumentaal gebouw aan de Rustavelilaan; plek van politieke manifestaties.' },
  { id: 'paleis-onderkoning', name: 'Paleis van de onderkoning (Jeugdpaleis)', q: 'Tbilisi Youth Palace', district: 'rustaveli', eras: ['russisch-rijk', 'republiek'], themes: ['historisch', 'politiek', 'architectuur'], note: 'Voormalige residentie van de Russische onderkoning in de Kaukasus.' },
  { id: 'kashveti', name: 'Kashveti-kerk', q: 'Kashveti Church, Tbilisi', district: 'rustaveli', eras: ['russisch-rijk'], themes: ['religieus', 'architectuur'], note: 'Kerk aan de Rustavelilaan, tegenover het oude parlement.' },
  { id: 'nationaal-museum', name: 'Georgisch Nationaal Museum', q: 'Georgian National Museum, Tbilisi', district: 'rustaveli', eras: ['oudheid', 'gouden-eeuw', 'sovjet'], themes: ['historisch', 'cultureel'], note: 'Belangrijkste museum van het land, met archeologische collecties en een tentoonstelling over de Sovjetbezetting.' },
  { id: 'rustaveli-theater', name: 'Rustaveli-theater', q: 'Rustaveli Theatre, Tbilisi', district: 'rustaveli', eras: ['russisch-rijk', 'sovjet'], themes: ['kunst', 'cultureel', 'architectuur'], note: 'Toonaangevend dramatheater aan de Rustavelilaan.' },
  { id: 'opera', name: 'Opera- en balletheater', q: 'Tbilisi Opera and Ballet Theatre', district: 'rustaveli', eras: ['russisch-rijk'], themes: ['kunst', 'architectuur', 'cultureel'], note: 'Operagebouw in Moorse stijl aan de Rustavelilaan.' },
  { id: 'museum-schone-kunsten', osm: 'N637763969', name: 'Museum voor Schone Kunsten', q: 'Museum of Fine Arts, Tbilisi', district: 'oude-stad', eras: ['gouden-eeuw'], themes: ['kunst', 'religieus', 'cultureel'], note: 'Kunstmuseum met onder meer een schatkamer van middeleeuwse edelsmeedkunst.' },
  { id: 'staatsuniversiteit', name: 'Staatsuniversiteit Tbilisi (eerste gebouw)', q: 'Ilia Chavchavadze Avenue 1, Tbilisi', district: 'vake', eras: ['republiek', 'sovjet'], themes: ['historisch', 'cultureel', 'architectuur'], note: 'Eerste Georgische universiteit; opgericht in de korte periode van onafhankelijkheid.' },
  { id: 'bank-of-georgia', name: 'Voormalig ministerie van Wegenbouw', q: 'Bank of Georgia Headquarters, Tbilisi', district: 'buiten', eras: ['sovjet'], themes: ['architectuur', 'modern'], note: 'Spraakmakend Sovjetmodernistisch gebouw van gestapelde blokken.' },

  // Old Town (Kala)
  { id: 'narikala', name: 'Narikala-vesting', q: 'Narikala, Tbilisi', district: 'oude-stad', eras: ['stichting', 'overheersing'], themes: ['historisch', 'uitzicht'], note: 'Vesting op de heuvel boven de oude stad, door opeenvolgende heersers uitgebreid.' },
  { id: 'moeder-georgie', name: 'Moeder van Georgië (Kartlis Deda)', q: 'Kartlis Deda, Tbilisi', district: 'oude-stad', eras: ['sovjet'], themes: ['cultureel', 'uitzicht'], note: 'Groot aluminium beeld op de Sololaki-heuvel, met wijnschaal en zwaard.' },
  { id: 'abanotubani', name: 'Abanotubani (zwavelbaden)', q: 'Abanotubani, Tbilisi', district: 'oude-stad', eras: ['stichting', 'overheersing', 'russisch-rijk'], themes: ['historisch', 'cultureel', 'multicultureel', 'architectuur'], note: 'Badhuiswijk met koepels boven warme zwavelbronnen; verbonden met het ontstaan van de stad.' },
  { id: 'chreli-abano', name: 'Chreli Abano (Orbeliani-bad)', q: 'Chreli Abano, Tbilisi', district: 'oude-stad', eras: ['overheersing', 'russisch-rijk'], themes: ['architectuur', 'cultureel'], note: 'Badhuis met opvallende blauwe tegelgevel.' },
  { id: 'waterval', name: 'Waterval van Leghvtakhevi', q: 'Leghvtakhevi Waterfall, Tbilisi', district: 'oude-stad', eras: [], themes: ['natuur', 'uitzicht'], note: 'Waterval in de kloof achter de zwavelbaden, midden in de stad.' },
  { id: 'jumah-moskee', name: 'Jumah-moskee', q: 'Jumah Mosque, Tbilisi', district: 'oude-stad', eras: ['russisch-rijk'], themes: ['religieus', 'multicultureel'], note: 'Moskee in Abanotubani.' },
  { id: 'meidan', name: 'Meidan (Gorgasaliplein)', q: 'Vakhtang Gorgasali Square, Tbilisi', district: 'oude-stad', eras: ['overheersing', 'russisch-rijk'], themes: ['historisch', 'eten', 'multicultureel'], note: 'Oud marktplein aan de rivier, kruispunt van handelaren.' },
  { id: 'erekle-plein', name: 'Erekle II-plein', q: 'Erekle II Square, Tbilisi', district: 'oude-stad', eras: ['erekle'], themes: ['historisch'], note: 'Pleintje bij de Sioni-kathedraal, genoemd naar koning Erekle II.' },
  { id: 'sioni', name: 'Sioni-kathedraal', q: 'Sioni Cathedral, Tbilisi', district: 'oude-stad', eras: ['stichting', 'gouden-eeuw', 'overheersing'], themes: ['religieus', 'historisch'], note: 'Kathedraal in de oude stad, vaak verwoest en herbouwd.' },
  { id: 'anchiskhati', name: 'Anchiskhati-basiliek', q: 'Anchiskhati Basilica, Tbilisi', district: 'oude-stad', eras: ['stichting'], themes: ['religieus', 'historisch', 'architectuur'], note: 'Geldt als de oudste bewaarde kerk van Tbilisi.' },
  { id: 'gabriadze', name: 'Klokkentoren van het Gabriadze-theater', q: 'Gabriadze Theatre, Tbilisi', district: 'oude-stad', eras: ['onafhankelijk'], themes: ['kunst', 'uitzicht'], note: 'Scheve, sprookjesachtige klokkentoren naast het marionettentheater.' },
  { id: 'shardeni', name: 'Shardeni-straat', q: 'Shardeni Street, Tbilisi', district: 'oude-stad', eras: ['onafhankelijk'], themes: ['eten', 'cultureel'], note: 'Voetgangersstraat met cafés, restaurants en galerieën.' },
  { id: 'tbilisi-history-museum', name: 'Museum voor de geschiedenis van Tbilisi (Karvasla)', q: 'Tbilisi History Museum', district: 'oude-stad', eras: ['overheersing', 'russisch-rijk'], themes: ['historisch', 'cultureel'], note: 'Stadsmuseum in een voormalige karavanserai.' },
  { id: 'synagoge', name: 'Grote Synagoge', q: 'Great Synagogue, Tbilisi', district: 'oude-stad', eras: ['russisch-rijk'], themes: ['religieus', 'multicultureel'], note: 'Synagoge in de oude stad.' },
  { id: 'norashen', name: 'Norashen-kerk', q: 'Norashen Church, Tbilisi', district: 'oude-stad', eras: ['overheersing'], themes: ['religieus', 'multicultureel'], note: 'Armeens-apostolische kerk in de oude stad.' },
  { id: 'betlemi', name: 'Betlemi-kerk en trappen', q: 'Betlemi Church, Tbilisi', district: 'oude-stad', eras: ['erekle'], themes: ['religieus', 'uitzicht'], note: 'Kerk hoog in de oude stad, bereikbaar via trappenstraatjes.' },
  { id: 'ateshgah', name: 'Ateshgah (vuurtempel)', q: 'Ateshgah, Tbilisi', district: 'oude-stad', eras: ['overheersing'], themes: ['religieus', 'multicultureel', 'historisch'], note: 'Restant van een zoroastrische vuurtempel.' },
  { id: 'botanische-tuin', name: 'Nationale Botanische Tuin', q: 'National Botanical Garden of Georgia', district: 'oude-stad', eras: ['russisch-rijk'], themes: ['natuur'], note: 'Grote tuin in de kloof achter Narikala.' },
  { id: 'kabelbaan-narikala', osm: 'N1668768830', name: 'Kabelbaan Rike–Narikala', q: 'Narikala cable car, Tbilisi', district: 'avlabari', eras: ['onafhankelijk'], themes: ['uitzicht', 'modern'], note: 'Kabelbaan van het Rikepark naar de vesting; de kaart wijst het dalstation Rike aan.' },

  // Sololaki
  { id: 'sololaki', name: 'Sololaki-wijk', q: 'Sololaki, Tbilisi', district: 'sololaki', eras: ['russisch-rijk'], themes: ['architectuur', 'historisch'], note: 'Wijk met herenhuizen, binnenplaatsen en beschilderde trappenhuizen.' },
  { id: 'kote-afkhazi', name: 'Kote Afkhazi-straat', q: 'Kote Abkhazi Street, Tbilisi', district: 'sololaki', eras: ['russisch-rijk'], themes: ['historisch', 'multicultureel', 'eten'], note: 'Oude hoofdstraat tussen Vrijheidsplein en de oude stad.' },
  { id: 'gudiashvili-plein', name: 'Gudiashvili-plein', q: 'Gudiashvili Square, Tbilisi', district: 'sololaki', eras: ['russisch-rijk'], themes: ['architectuur', 'kunst'], note: 'Plein met gerestaureerde negentiende-eeuwse gevels.' },
  { id: 'schrijvershuis', name: 'Schrijvershuis van Georgië', q: "Writers' House of Georgia", district: 'sololaki', eras: ['russisch-rijk', 'sovjet'], themes: ['literatuur', 'architectuur'], note: 'Art-nouveauvilla, later ontmoetingsplek van schrijvers.' },

  // Across the river
  { id: 'metekhi', name: 'Metekhi-kerk', q: 'Metekhi Church, Tbilisi', district: 'avlabari', eras: ['gouden-eeuw', 'overheersing'], themes: ['religieus', 'historisch', 'uitzicht'], note: 'Kerk op de rots boven de rivier, tegenover de oude stad.' },
  { id: 'vakhtang-gorgasali', name: 'Ruiterstandbeeld Vakhtang Gorgasali', q: 'Vakhtang Gorgasali statue, Tbilisi', district: 'avlabari', eras: ['stichting', 'sovjet'], themes: ['historisch', 'uitzicht'], note: 'Beeld van de koning die volgens de overlevering de stad stichtte.' },
  { id: 'vredesbrug', name: 'Vredesbrug', q: 'Bridge of Peace, Tbilisi', district: 'oude-stad', eras: ['onafhankelijk'], themes: ['modern', 'uitzicht'], note: 'Glazen voetgangersbrug over de Mtkvari.' },
  { id: 'rike-park', name: 'Rikepark', q: 'Rike Park, Tbilisi', district: 'avlabari', eras: ['onafhankelijk'], themes: ['natuur', 'modern'], note: 'Park aan de rivier met moderne architectuur.' },
  { id: 'sameba', name: 'Sameba-kathedraal (Heilige Drie-eenheid)', q: 'Holy Trinity Cathedral of Tbilisi', district: 'avlabari', eras: ['onafhankelijk'], themes: ['religieus', 'architectuur', 'uitzicht'], note: 'Zeer grote orthodoxe kathedraal op de Elia-heuvel.' },
  { id: 'presidentieel-paleis', name: 'Voormalig presidentieel paleis', q: 'Presidential Palace, Tbilisi', district: 'avlabari', eras: ['onafhankelijk'], themes: ['politiek', 'modern'], note: 'Paleis met glazen koepel boven Avlabari.' },
  { id: 'stalin-drukkerij', osm: 'W1376878173', name: 'Ondergrondse drukkerij van Stalin', q: 'Underground Printing House, Tbilisi', district: 'avlabari', eras: ['russisch-rijk'], themes: ['politiek', 'historisch'], note: 'Geheime drukkerij van revolutionairen, nu een klein museum.' },
  { id: 'darejan-paleis', name: 'Paleis van koningin Darejan', q: 'Queen Darejan Palace, Tbilisi', district: 'avlabari', eras: ['erekle'], themes: ['historisch', 'uitzicht'], note: 'Paleis met balkon boven de rivier, verbonden met de vrouw van Erekle II.' },
  { id: 'europaplein', name: 'Europaplein', q: 'Europe Square, Tbilisi', district: 'avlabari', eras: ['onafhankelijk'], themes: ['modern', 'politiek'], note: 'Plein aan de rivier bij het dalstation van de kabelbaan.' },
  { id: 'public-service-hall', name: 'Public Service Hall', q: 'Public Service Hall, Tbilisi', district: 'oude-stad', eras: ['onafhankelijk'], themes: ['modern', 'architectuur'], note: 'Gebouw met paddenstoelvormige daken aan de rivier.' },

  // Mtatsminda
  { id: 'pantheon-mtatsminda', name: 'Pantheon van Mtatsminda', q: 'Mtatsminda Pantheon', district: 'mtatsminda', eras: ['russisch-rijk', 'sovjet'], themes: ['literatuur', 'historisch', 'religieus'], note: 'Begraafplaats van schrijvers en publieke figuren bij de Mamadaviti-kerk.' },
  { id: 'kabelspoor', name: 'Kabelspoorweg naar Mtatsminda', q: 'Tbilisi Funicular', district: 'mtatsminda', eras: ['russisch-rijk'], themes: ['uitzicht'], note: 'Kabelspoor tegen de heilige berg op.' },
  { id: 'mtatsminda-park', name: 'Mtatsminda-park', q: 'Mtatsminda Park', district: 'mtatsminda', eras: ['sovjet', 'onafhankelijk'], themes: ['uitzicht', 'natuur'], note: 'Pretpark en uitkijkpunt boven de stad.' },

  // North of the centre
  { id: 'droge-brug', name: 'Rommelmarkt bij de Droge Brug', q: 'Dry Bridge, Tbilisi', district: 'oude-stad', eras: ['sovjet', 'onafhankelijk'], themes: ['eten', 'cultureel'], note: 'Openluchtmarkt met antiek, schilderijen en Sovjetsouvenirs.' },
  { id: 'aghmashenebeli', name: 'Aghmashenebeli-laan', q: 'Davit Aghmashenebeli Avenue, Tbilisi', district: 'chughureti', eras: ['russisch-rijk'], themes: ['architectuur', 'eten', 'multicultureel'], note: 'Gerestaureerde negentiende-eeuwse laan op de linkeroever.' },
  { id: 'marjanishvili-theater', name: 'Marjanishvili-theater', q: 'Marjanishvili Theatre, Tbilisi', district: 'chughureti', eras: ['sovjet'], themes: ['kunst', 'cultureel'], note: 'Toonaangevend theater op de linkeroever.' },
  { id: 'fabrika', name: 'Fabrika', q: 'Fabrika, Tbilisi', district: 'chughureti', eras: ['sovjet', 'onafhankelijk'], themes: ['modern', 'kunst', 'eten'], note: 'Voormalige naaifabriek, nu hostel en creatieve hotspot.' },
  { id: 'dezerter-bazaar', name: 'Dezerter-bazaar', q: 'Dezerter Bazaar, Tbilisi', district: 'chughureti', eras: [], themes: ['eten'], note: 'Grote overdekte markt bij het station.' },
  { id: 'circus', name: 'Circus van Tbilisi', q: 'Tbilisi Circus', district: 'buiten', eras: ['sovjet'], themes: ['architectuur', 'kunst'], note: 'Koepelgebouw van het staatscircus.' },

  // Further out (transport needed)
  { id: 'vake-park', name: 'Vakepark', q: 'Vake Park, Tbilisi', district: 'vake', eras: ['sovjet'], themes: ['natuur'], note: 'Groot park met een gedenkteken voor de Tweede Wereldoorlog.' },
  { id: 'schildpaddenmeer', name: 'Schildpaddenmeer', q: 'Turtle Lake, Tbilisi', district: 'buiten', eras: [], themes: ['natuur', 'uitzicht'], note: 'Klein meer in de heuvels boven Vake.' },
  { id: 'etnografisch-museum', osm: 'R14141290', name: 'Openluchtmuseum voor Etnografie', q: 'Ethnographic Museum, Tbilisi', district: 'buiten', eras: ['sovjet'], themes: ['cultureel', 'historisch', 'natuur'], note: 'Traditionele huizen uit heel Georgië op een heuvel.' },
  { id: 'kroniek-georgie', name: 'Kroniek van Georgië', q: 'Chronicle of Georgia', district: 'buiten', eras: ['sovjet'], themes: ['kunst', 'uitzicht', 'historisch'], note: 'Reusachtige zuilen met reliëfs uit de Georgische geschiedenis, bij de Tbilisi-zee.' },
  { id: 'lurji-monastiri', name: 'Blauw Klooster (Lurji Monastiri)', q: 'Lurji Monastery, Tbilisi', district: 'chughureti', eras: ['gouden-eeuw'], themes: ['religieus', 'historisch'], note: 'Middeleeuwse kerk met een blauwe koepel.' },
];
