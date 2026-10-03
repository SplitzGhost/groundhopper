// Stadion-Steckbriefe für Stadionliste und Spielkarten: Kapazität, Eröffnung, eine kurze Besonderheit –
// und die Bauform, aus der StadiumArt die vereinfachte 3D-Grafik erzeugt.
// Kapazitäten gerundet, Stand Saison 2026/27.

export type StadiumShape =
  /** Ovale Schüssel */
  | 'bowl'
  /** Rechteckig mit geschlossenen Ecken */
  | 'arena'
  /** Vier einzelne Tribünen, offene Ecken (englischer Stil) */
  | 'box'
  /** Oval mit Laufbahn */
  | 'track'

export type RoofType =
  | 'none'
  /** Nur über der Haupttribüne (hinten) */
  | 'main'
  /** Über beiden Längsseiten */
  | 'sides'
  /** Rundum über allen Rängen */
  | 'full'
  /** Mit (schließbarem) Dach über dem Spielfeld */
  | 'closed'

export type Facade = 'concrete' | 'glass' | 'brick' | 'metal' | 'club' | 'shell' | 'lattice'

export type Feature =
  /** Gelbe Stützpylone außen (Dortmund) */
  | 'pylons'
  /** Leuchtende Eckpylone (Köln, Genua) */
  | 'cornerTowers'
  /** Flutlichtmasten in den Ecken */
  | 'masts'
  /** Rampentürme mit Dachgerüst in Vereinsfarbe (San Siro) */
  | 'towers'
  /** Einzelner Marathonturm hinter einer Kurve */
  | 'marathon'
  /** Bogen über der Haupttribüne */
  | 'arch'
  /** Betonrippen an der Fassade */
  | 'ribs'
  /** Arkaden an der Längsseite (Louis II) */
  | 'arcades'

export interface StadiumSpec {
  capacity: number
  opened: number | null
  shape: StadiumShape
  roof: RoofType
  /** Anzahl Ränge 1–3 */
  tiers: 1 | 2 | 3
  facade: Facade
  /** Höhenfaktor je Seite: hinten (Haupttribüne), rechts, vorne, links. 0 = keine Tribüne */
  sides?: [number, number, number, number]
  features?: Feature[]
  fact?: string
}

type Row = [capacity: number, opened: number | null, shape: StadiumShape, roof: RoofType, tiers: 1 | 2 | 3, facade: Facade,
  extra?: { sides?: StadiumSpec['sides']; features?: Feature[]; fact?: string }]

const ROWS: Record<string, Row> = {
  // ---------- Bundesliga ----------
  'allianz-arena-munchen': [75024, 2005, 'bowl', 'full', 3, 'shell', { fact: 'Die Hülle aus rund 2.800 Luftkissen leuchtet bei Heimspielen rot.' }],
  'signal-iduna-park-dortmund': [81365, 1974, 'arena', 'full', 2, 'metal', { sides: [1, 1, 1, 1.22], features: ['pylons'], fact: 'Die Südtribüne ist mit rund 25.000 Stehplätzen die größte Stehtribüne Europas.' }],
  'bayarena-leverkusen': [30210, 1958, 'arena', 'full', 2, 'glass', { fact: 'Das schwebende Dach wurde 2009 rund um das Stadion ergänzt.' }],
  'red-bull-arena-leipzig': [47069, 2004, 'bowl', 'full', 2, 'glass', { fact: 'Wurde in den Erdwall des alten Zentralstadions hineingebaut.' }],
  'mhparena-stuttgart': [60449, 1933, 'bowl', 'full', 2, 'concrete', { fact: 'Bis 2009 lief hier noch eine Laufbahn um den Rasen.' }],
  'deutsche-bank-park-frankfurt-am-main': [58000, 1925, 'bowl', 'closed', 2, 'glass', { fact: 'Das Innendach aus Membran lässt sich über dem Spielfeld schließen.' }],
  'europa-park-stadion-freiburg-im-breisgau': [34700, 2021, 'arena', 'full', 2, 'glass', { fact: 'Ersetzte 2021 das Dreisamstadion mitten in der Stadt.' }],
  'borussia-park-monchengladbach': [54042, 2004, 'arena', 'full', 2, 'glass'],
  'mewa-arena-mainz': [33305, 2011, 'arena', 'full', 2, 'club'],
  'wwk-arena-augsburg': [30660, 2009, 'arena', 'full', 2, 'glass', { fact: 'Eines der ersten Stadien, das klimaneutral betrieben wird.' }],
  'weserstadion-bremen': [42100, 1947, 'arena', 'full', 2, 'glass', { fact: 'Die Fassade ist mit Solarmodulen verkleidet.' }],
  'stadion-an-der-alten-forsterei-berlin': [22012, 1920, 'box', 'full', 1, 'concrete', { sides: [1.25, 1, 1, 1], fact: 'Fans haben das Stadion 2008/09 in über 140.000 Arbeitsstunden selbst umgebaut.' }],
  'prezero-arena-sinsheim': [30150, 2009, 'arena', 'full', 2, 'glass'],
  'rheinenergiestadion-koln': [49698, 2004, 'box', 'full', 2, 'glass', { features: ['cornerTowers'], fact: 'Die vier Eckpylone leuchten nachts weit über Müngersdorf.' }],
  'volksparkstadion-hamburg': [57000, 1953, 'arena', 'full', 2, 'concrete'],
  'veltins-arena-gelsenkirchen': [62271, 2001, 'arena', 'closed', 2, 'metal', { fact: 'Der Rasen wird zum Wachsen komplett aus dem Stadion herausgefahren.' }],
  'home-deluxe-arena-paderborn': [15000, 2008, 'box', 'full', 1, 'concrete'],
  'ursapharm-arena-an-der-kaiserlinde-spiesen-elversberg': [10000, null, 'box', 'main', 1, 'concrete', { sides: [1.2, 0.7, 0.8, 0.7], fact: 'Spielt in einer Gemeinde mit gut 13.000 Einwohnern.' }],

  // ---------- Premier League ----------
  'emirates-stadium-london': [60704, 2006, 'bowl', 'full', 3, 'glass', { fact: 'Ersetzte 2006 das legendäre Highbury ein paar Straßen weiter.' }],
  'villa-park-birmingham': [42640, 1897, 'box', 'full', 2, 'brick', { sides: [1.1, 1, 1, 1.15], fact: 'Der Holte End gehört zu den berühmtesten Kurven Englands.' }],
  'vitality-stadium-bournemouth': [11307, 1910, 'box', 'full', 1, 'concrete', { fact: 'Eines der kleinsten Stadien der Premier League.' }],
  'gtech-community-stadium-london': [17250, 2020, 'arena', 'full', 1, 'glass'],
  'american-express-stadium-brighton': [31876, 2011, 'bowl', 'full', 2, 'glass', { sides: [1.3, 0.8, 1.1, 0.8], fact: 'Die geschwungenen Dachbögen erinnern an die Hügel der South Downs.' }],
  'stamford-bridge-london': [40343, 1877, 'box', 'full', 2, 'concrete', { fact: 'Gebaut 1877 – zunächst für Leichtathletik, Chelsea kam erst 1905.' }],
  'coventry-building-society-arena-coventry': [32609, 2005, 'arena', 'full', 2, 'glass'],
  'selhurst-park-london': [25486, 1924, 'box', 'full', 1, 'brick', { sides: [1.15, 0.9, 1, 0.85] }],
  'hill-dickinson-stadium-liverpool': [52888, 2025, 'box', 'full', 2, 'brick', { sides: [1, 1, 1, 1.15], fact: 'Steht direkt am Mersey in den Bramley-Moore Docks.' }],
  'craven-cottage-london': [29600, 1896, 'box', 'full', 1, 'brick', { sides: [1, 0.9, 1.15, 0.9], fact: 'Das kleine Cottage in der Ecke steht unter Denkmalschutz.' }],
  'mkm-stadium-kingston-upon-hull': [25586, 2002, 'bowl', 'full', 1, 'glass', { sides: [1.25, 0.9, 1, 0.9] }],
  'portman-road-ipswich': [29813, 1884, 'box', 'full', 2, 'concrete'],
  'elland-road-leeds': [37645, 1897, 'box', 'full', 2, 'concrete', { sides: [1, 1, 1.1, 1] }],
  'anfield-liverpool': [61276, 1884, 'box', 'full', 2, 'concrete', { sides: [1.35, 1.05, 0.95, 1], fact: 'Vor dem Anpfiff singt der Kop „You’ll Never Walk Alone“.' }],
  'etihad-stadium-manchester': [61470, 2002, 'bowl', 'full', 3, 'glass', { features: ['masts'], fact: 'Wurde für die Commonwealth Games 2002 gebaut.' }],
  'old-trafford-manchester': [74197, 1910, 'arena', 'full', 2, 'concrete', { sides: [1.15, 1, 1, 1], fact: 'Wird „Theatre of Dreams“ genannt.' }],
  'st-james-park-newcastle-upon-tyne': [52305, 1892, 'arena', 'full', 2, 'glass', { sides: [1.35, 1.25, 0.8, 0.8], fact: 'Zwei riesige und zwei kleine Tribünen – das Stadion wirkt schief.' }],
  'city-ground-nottingham': [30404, 1898, 'box', 'full', 1, 'concrete', { fact: 'Liegt am Ufer des Trent, schräg gegenüber von Notts County.' }],
  'stadium-of-light-sunderland': [49000, 1997, 'bowl', 'full', 2, 'glass', { sides: [1.2, 1, 1, 1] }],
  'tottenham-hotspur-stadium-london': [62850, 2019, 'bowl', 'full', 3, 'glass', { sides: [1, 1, 1, 1.2], fact: 'Unter dem Rasen liegt ein zweites Spielfeld für NFL-Spiele.' }],

  // ---------- La Liga ----------
  'santiago-bernabeu-madrid': [83186, 1947, 'arena', 'closed', 3, 'metal', { fact: 'Hat ein schließbares Dach und einen versenkbaren Rasen.' }],
  'spotify-camp-nou-barcelona': [105000, 1957, 'bowl', 'full', 3, 'concrete', { fact: 'Wird zum größten Stadion Europas ausgebaut.' }],
  'riyadh-air-metropolitano-madrid': [70460, 2017, 'bowl', 'full', 2, 'glass', { sides: [1.2, 0.95, 1, 0.95] }],
  'san-mames-bilbao': [53289, 2013, 'arena', 'full', 3, 'glass', { fact: 'Wird von den Fans „La Catedral“ genannt.' }],
  'reale-arena-donostia-san-sebastian': [39500, 1993, 'arena', 'full', 2, 'glass', { fact: 'Seit dem Umbau 2019 ohne Laufbahn, die Ränge rückten näher ans Feld.' }],
  'estadio-de-la-cartuja-sevilla': [70000, 1999, 'track', 'sides', 2, 'concrete', { fact: 'Betis spielt hier, solange das Benito Villamarín neu gebaut wird.' }],
  'ramon-sanchez-pizjuan-sevilla': [43883, 1958, 'bowl', 'main', 2, 'concrete', { sides: [1.2, 1, 1, 1] }],
  'mestalla-valencia': [49430, 1923, 'arena', 'main', 3, 'concrete', { sides: [1.3, 1, 1, 1], fact: 'Gilt als eines der steilsten Stadien Europas.' }],
  'estadio-de-la-ceramica-vila-real': [23500, 1923, 'arena', 'full', 2, 'club', { fact: 'Die Fassade ist mit Keramikfliesen verkleidet – daher der Name.' }],
  'el-sadar-pamplona': [23576, 1967, 'arena', 'full', 2, 'club'],
  'abanca-balaidos-vigo': [24870, 1928, 'box', 'sides', 2, 'concrete'],
  'abanca-riazor-a-coruna': [32490, 1944, 'arena', 'sides', 2, 'concrete', { fact: 'Liegt direkt an der Strandpromenade von A Coruña.' }],
  'mendizorrotza-vitoria-gasteiz': [19840, 1924, 'box', 'full', 2, 'concrete'],
  'martinez-valero-elche': [31388, 1976, 'bowl', 'main', 2, 'concrete'],
  'rcde-stadium-cornella-de-llobregat': [40000, 2009, 'arena', 'full', 2, 'club'],
  'coliseum-getafe': [16500, 1998, 'box', 'full', 1, 'concrete'],
  'la-rosaleda-malaga': [30044, 1941, 'bowl', 'main', 2, 'concrete'],
  'ciutat-de-valencia-valencia': [26354, 1969, 'box', 'main', 2, 'concrete'],
  'el-sardinero-santander': [22222, 1988, 'arena', 'sides', 2, 'concrete', { fact: 'Liegt nur wenige Schritte vom Strand El Sardinero entfernt.' }],
  'estadio-de-vallecas-madrid': [14708, 1976, 'box', 'main', 2, 'concrete', { sides: [1.1, 1, 1, 0], fact: 'Hat nur drei Tribünen – hinter einem Tor steht eine Wand.' }],

  // ---------- Serie A ----------
  'san-siro-milano': [75817, 1926, 'bowl', 'full', 3, 'concrete', { features: ['towers'], fact: 'Die Rampentürme tragen das markante rote Dachgerüst.' }],
  'allianz-stadium-torino': [41507, 2011, 'arena', 'full', 2, 'metal', { fact: 'Das erste vereinseigene Stadion eines großen Serie-A-Klubs.' }],
  'stadio-diego-armando-maradona-napoli': [54726, 1959, 'track', 'full', 2, 'concrete', { fact: 'Trägt seit 2020 den Namen von Diego Maradona.' }],
  'stadio-olimpico-roma': [70634, 1953, 'track', 'full', 2, 'concrete', { fact: 'Hier fand das Finale der WM 1990 statt.' }],
  'gewiss-stadium-bergamo': [24950, 1928, 'box', 'full', 1, 'glass'],
  'stadio-artemio-franchi-firenze': [43147, 1931, 'track', 'main', 1, 'concrete', { features: ['marathon'], fact: 'Markant ist die schlanke Torre di Maratona hinter der Kurve.' }],
  'stadio-renato-dall-ara-bologna': [36462, 1927, 'track', 'main', 2, 'brick', { features: ['marathon'], fact: 'Eingeweiht 1927 – mit eigenem Marathonturm aus Backstein.' }],
  'stadio-olimpico-grande-torino-torino': [27958, 1933, 'arena', 'full', 2, 'concrete', { fact: 'Für die Olympischen Winterspiele 2006 modernisiert.' }],
  'bluenergy-stadium-udine': [25144, 1976, 'arena', 'full', 2, 'concrete', { features: ['arch'], fact: 'Das Dach der Haupttribüne hängt an einem großen Bogen.' }],
  'stadio-luigi-ferraris-genova': [33205, 1911, 'box', 'full', 2, 'brick', { features: ['cornerTowers'], fact: 'Eines der ältesten noch genutzten Stadien Italiens.' }],
  'unipol-domus-cagliari': [16416, 2017, 'box', 'none', 1, 'metal', { fact: 'Ein Provisorium, bis das neue Stadion fertig ist.' }],
  'stadio-via-del-mare-lecce': [31533, 1966, 'bowl', 'main', 1, 'concrete'],
  'stadio-giuseppe-sinigaglia-como': [13602, 1927, 'box', 'main', 1, 'concrete', { fact: 'Liegt direkt am Ufer des Comer Sees.' }],
  'stadio-ennio-tardini-parma': [22352, 1923, 'box', 'main', 1, 'concrete'],
  'mapei-stadium-citta-del-tricolore-reggio-emilia': [21525, 1995, 'box', 'full', 2, 'concrete'],
  'u-power-stadium-monza': [15039, 1988, 'arena', 'full', 1, 'concrete'],
  'stadio-pier-luigi-penzo-venezia': [11150, 1913, 'box', 'main', 1, 'metal', { fact: 'Viele Fans kommen mit dem Boot zum Spiel.' }],
  'stadio-benito-stirpe-frosinone': [16227, 2017, 'box', 'full', 1, 'glass'],

  // ---------- Ligue 1 ----------
  'parc-des-princes-paris': [47929, 1972, 'bowl', 'full', 2, 'concrete', { features: ['ribs'], fact: 'Die geschwungenen Betonrippen der Fassade sind sein Markenzeichen.' }],
  'stade-jean-bouin-paris': [19904, 2013, 'arena', 'full', 1, 'lattice', { fact: 'Steht direkt neben dem Parc des Princes.' }],
  'orange-velodrome-marseille': [67394, 1937, 'bowl', 'full', 2, 'glass', { fact: 'Wurde auch für Radrennen gebaut – daher der Name.' }],
  'groupama-stadium-decines-charpieu': [59186, 2016, 'arena', 'full', 2, 'glass'],
  'stade-louis-ii-monaco': [16360, 1985, 'box', 'main', 1, 'concrete', { features: ['arcades'], fact: 'Unter dem Spielfeld liegen ein Parkhaus und eine Schwimmhalle.' }],
  'decathlon-arena-stade-pierre-mauroy-villeneuve-d-ascq': [50186, 2012, 'arena', 'closed', 2, 'metal', { fact: 'Eine Spielfeldhälfte lässt sich für Hallen-Events hochfahren.' }],
  'stade-bollaert-delelis-lens': [38223, 1933, 'box', 'full', 2, 'concrete', { fact: 'Fasst mehr Zuschauer, als Lens Einwohner hat.' }],
  'allianz-riviera-nice': [36178, 2013, 'arena', 'full', 2, 'lattice'],
  'roazhon-park-rennes': [29778, 1912, 'arena', 'full', 2, 'concrete'],
  'stade-de-la-meinau-strasbourg': [26109, 1914, 'box', 'full', 2, 'glass'],
  'stadium-de-toulouse-toulouse': [33150, 1937, 'box', 'full', 2, 'concrete', { fact: 'Liegt auf einer Insel in der Garonne.' }],
  'stade-francis-le-ble-brest': [15931, 1922, 'box', 'full', 1, 'concrete'],
  'stade-de-l-abbe-deschamps-auxerre': [18541, 1918, 'box', 'main', 1, 'concrete'],
  'stade-raymond-kopa-angers': [19350, 1912, 'box', 'full', 1, 'concrete'],
  'stade-oceane-le-havre': [25178, 2012, 'arena', 'full', 2, 'club', { fact: 'Die blaue Hülle leuchtet nachts wie ein Lampion.' }],
  'mmarena-le-mans': [25064, 2011, 'arena', 'full', 2, 'glass'],
  'stade-du-moustoir-lorient': [18110, 1959, 'box', 'full', 1, 'concrete', { fact: 'Hier wird auf Kunstrasen gespielt.' }],
  'stade-de-l-aube-troyes': [21684, 1924, 'box', 'full', 1, 'concrete'],
}

const FALLBACK: StadiumSpec = { capacity: 20000, opened: null, shape: 'arena', roof: 'full', tiers: 1, facade: 'concrete' }

export const STADIUM_INFO: Record<string, StadiumSpec> = Object.fromEntries(
  Object.entries(ROWS).map(([id, [capacity, opened, shape, roof, tiers, facade, extra]]) =>
    [id, { capacity, opened, shape, roof, tiers, facade, ...extra }]),
)

export const stadiumSpec = (id: string): StadiumSpec => STADIUM_INFO[id] ?? FALLBACK
