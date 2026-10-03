# Groundhopper

Fußball-App zum Sammeln von Stadionbesuchen – iPhone-Prototyp mit den Top-5-Ligen Europas
(Bundesliga, Premier League, La Liga, Serie A, Ligue 1). Blau-weißes Design im Apple-Stil
mit Liquid-Glass-Bedienelementen, folgt dem Hell-/Dunkelmodus des Systems.

- **Karte:** Vollbild-Karte mit Standort und allen Stadien. Filter nach Ligen und „nur neue Stadien“,
  Tagesleiste unten (Heute, Morgen, nächste Spieltage, Datum frei wählbar) – dann erscheinen nur
  Stadien mit Spielen an diesem Tag, samt Anstoßzeit und Karussell nach Entfernung sortiert.
  ★ zeigt nur gemerkte Spiele. Suche nach Stadion, Verein oder Ort.
- **Spiele:** Spielplan Tag für Tag, nach Ligen getrennt (mit Spieltag). Nach rechts wischen = Vortag,
  nach links = nächster Tag; Wochenleiste und Kalender springen zu jedem Datum, leere Tage zeigen den
  nächsten Spieltag. Haken setzen („Ich war da“) öffnet direkt Bewertung & Notizen; kommende Spiele merken (★).
  Suche über die ganze Saison; die Merkliste öffnet der Stern (★) oben, Spiele auch von Hand eintragbar (+).
- **Sammelalbum:**
  - **Sammelordner:** Jedes besuchte Spiel wird eine Spielkarte – beide Wappen auf einer diagonal geteilten
    Fläche in satten Vereinsfarben mit Glanz- und Schwebeeffekten im Loop (Derbys mit Glut und Funken), der Endstand als Anzeigetafel auf der Naht, dazu Extras wie Derby,
    Neues Stadion, Torfestival, Comeback, Last-Minute-Sieg, Hattrick, Flutlicht. Die Rückseite ist der
    Spielbericht: 3D-Stadion, Zuschauer, Schiedsrichter und Torticker (Quelle: ESPN, wird nach dem Abhaken
    geladen). „Mehr“ zeigt die eigene Erinnerung (Bewertung, Notizen). Neue Karten kommen verdeckt angeflogen
    und werden mit einem Tipp aufgedeckt. Im Ordner liegen vier Karten pro Seite, Wischen blättert die Seite
    in 3D um; sortierbar nach Datum, Alphabet oder Liga.
  - **Listen zum Vervollständigen:** Vereine und Stadien je Land (grau, bis man dort war), Ligen, Derbys und
    Erfolge. Antippen zeigt Infos und die zugehörigen Spielkarten.
  - Sammler-Pass mit Level und Punkten.
- **Profil:** Statistiken, Backup als Datei exportieren/importieren. Alle Nutzerdaten bleiben auf dem Gerät.

## Starten

```bash
npm install
npm run dev
```

App: http://localhost:5173 · API: http://localhost:8787

Am Computer wird die App in einem iPhone-Rahmen angezeigt. Alle Stadiongrafiken auf einen Blick:
http://localhost:5173/#stadien (nur im Entwicklungsmodus).

### Website (GitHub Pages)

Bei jedem Push auf `main` und zusätzlich alle 6 Stunden baut eine GitHub Action die App und
veröffentlicht sie unter **https://splitzghost.github.io/groundhopper/** – zum Testen auf iPhone und PC.
Dort läuft kein API-Server: die Action lädt den Spielplan vorher als Datei (`npm run data`).
Mit dem Repo-Secret `FOOTBALL_DATA_API_KEY` nutzt sie football-data.org, sonst die freien Demo-Quellen.

Lokal genauso testen (ohne API-Server):

```bash
npm run data
npm run dev:static
```

### Auf dem iPhone testen

```bash
npm run dev:phone
```

Startet mit selbstsigniertem HTTPS-Zertifikat (Safari gibt den Standort nur über HTTPS frei).
Auf dem iPhone im selben WLAN `https://<IP-des-PCs>:5173` öffnen, die Zertifikatswarnung bestätigen,
dann **Teilen → „Zum Home-Bildschirm“** – so läuft die App im Vollbild ohne Safari-Leisten.

## Datenquelle

| Modus | Wann | Quelle |
|---|---|---|
| `football-data` | `FOOTBALL_DATA_API_KEY` steht in `.env` | football-data.org (Gratis-Plan, alle 5 Ligen) |
| `demo` | kein Schlüssel | OpenLigaDB (BL), openfootball (PL, La Liga, Serie A), football-data.co.uk (Ligue 1, eingeschränkt) |

`.env.example` nach `.env` kopieren und den Schlüssel eintragen. Die Datei wird nicht eingecheckt.

Karte: MapLibre mit Vektorkacheln von [OpenFreeMap](https://openfreemap.org) – kostenlos, kein Schlüssel nötig.

## Projektaufbau

```
server/            Node-Server (läuft direkt als TypeScript, Node ≥ 22.18)
  index.ts         API-Endpunkte /api/health, /api/matches
  providers/       Datenquellen (football-data.org, Demo)
  cache.ts         Zwischenspeicher (.cache/), schont Anfrage-Limits
src/
  App.tsx          Hülle: Tabs, Sheets, Dynamic-Island-Mitteilungen, iPhone-Rahmen am PC
  screens/         Karte, Spiele, Sammelalbum, Sammelordner, Sammellisten
  sheets/          Bottom-Sheets: Stadion, Spiel, Verein, Liga, Derby, Kalender, Merkliste, Filter, Suche, Profil, Eintragen
  components/      Bausteine: Glas-Buttons, Haken, Sheet, Karte (MapLibre), Flaggen, Trikots …
    cards/         Spielkarten: Vorder-/Rückseite, Kartenreihe, vergrößerte Ansicht mit Erinnerung
    StadiumArt     3D-Stadiongrafik (Szene aus lib/stadiumScene.ts)
  state/           Globaler Zustand: Spielplan, Nutzerdaten, Standort, Oberfläche, Mitteilungen
  shared/          Typen, Ligen, Vereinsnamen-Abgleich (von App und Server genutzt)
  data/            stadiums.json (erzeugt aus tools/stadiums.source.ts), Stadion-Steckbriefe
                   mit Bauform für die Grafiken, Vereinsfarben und -daten
  lib/             App-Logik ohne Oberfläche: API, Speicher, Geo, Album/Erfolge, Spielkarten, Listen,
                   Spielbericht (ESPN), Derbys,
                   stadiumScene (Stadion-Geometrie → Polygone)
tools/
  stadiums.source.ts  Stadion-Quelldaten (Verein → Stadion)
  geocode.ts          `npm run stadiums` – Koordinaten über OpenStreetMap
  icons.ts            `npm run icons` – App-Icons als PNG
  build-data.ts       `npm run data` – Spielplan als statische Datei für GitHub Pages
```

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | App + API zusammen starten |
| `npm run dev:phone` | wie `dev`, aber mit HTTPS fürs iPhone |
| `npm run dev:static` | App ohne API-Server, Spielplan aus `public/data/` (wie auf GitHub Pages) |
| `npm run data` | Spielplan nach `public/data/matches.json` schreiben |
| `npm run stadiums` | Stadion-Koordinaten neu erzeugen (nach Änderungen an der Quellliste) |
| `npm run icons` | App-Icons neu erzeugen |
| `npm run typecheck` | TypeScript prüfen |
| `npm run build` | Produktions-Build |

Kartendaten © OpenFreeMap, © OpenMapTiles, © OpenStreetMap-Mitwirkende.
