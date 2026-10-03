# Groundhopper

Fußball-App zum Sammeln von Stadionbesuchen – iPhone-Prototyp mit den Top-5-Ligen Europas
(Bundesliga, Premier League, La Liga, Serie A, Ligue 1). Blau-weißes Design im Apple-Stil
mit Liquid-Glass-Bedienelementen, folgt dem Hell-/Dunkelmodus des Systems.

- **Karte:** Vollbild-Karte mit Standort und allen Stadien. Filter nach Ligen und „nur neue Stadien“,
  Tagesleiste unten (Heute, Morgen, nächste Spieltage, Datum frei wählbar) – dann erscheinen nur
  Stadien mit Spielen an diesem Tag, samt Anstoßzeit und Karussell nach Entfernung sortiert.
  ★ zeigt nur gemerkte Spiele. Suche nach Stadion, Verein oder Ort.
- **Spiele:** kompletter Spielplan zum Durchsuchen; vergangene Spiele abhaken („Ich war da“),
  kommende merken (★). Reiter Merkliste und Besucht, Spiele auch von Hand eintragbar (+).
- **Sammelalbum:** Level und Punkte, Sticker für Stadien, Vereine, Derbys und Länder,
  Fortschrittsringe je Liga, Erfolge (z. B. Torfestival, Doppelschicht, Flutlicht).
  Neu Freigeschaltetes meldet die App als Mitteilung aus der Dynamic Island.
- **Profil:** Statistiken, Backup als Datei exportieren/importieren. Alle Nutzerdaten bleiben auf dem Gerät.

## Starten

```bash
npm install
npm run dev
```

App: http://localhost:5173 · API: http://localhost:8787

Am Computer wird die App in einem iPhone-Rahmen angezeigt.

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
  screens/         Karte, Spiele, Sammelalbum
  sheets/          Bottom-Sheets: Stadion, Spiel, Filter, Suche, Profil, Eintragen, Album-Übersicht
  components/      Bausteine: Glas-Buttons, Haken, Sheet, Karte (MapLibre), Sticker …
  state/           Globaler Zustand: Spielplan, Nutzerdaten, Standort, Oberfläche, Mitteilungen
  shared/          Typen, Ligen, Vereinsnamen-Abgleich (von App und Server genutzt)
  data/            stadiums.json – erzeugt aus tools/stadiums.source.ts
  lib/             App-Logik ohne Oberfläche: API, Speicher, Geo, Album/Erfolge, Derbys
tools/
  stadiums.source.ts  Stadion-Quelldaten (Verein → Stadion)
  geocode.ts          `npm run stadiums` – Koordinaten über OpenStreetMap
  icons.ts            `npm run icons` – App-Icons als PNG
```

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | App + API zusammen starten |
| `npm run dev:phone` | wie `dev`, aber mit HTTPS fürs iPhone |
| `npm run stadiums` | Stadion-Koordinaten neu erzeugen (nach Änderungen an der Quellliste) |
| `npm run icons` | App-Icons neu erzeugen |
| `npm run typecheck` | TypeScript prüfen |
| `npm run build` | Produktions-Build |

Kartendaten © OpenFreeMap, © OpenMapTiles, © OpenStreetMap-Mitwirkende.
