// Kleiner API-Server für die App.
//   GET /api/health                                  – welche Datenquelle aktiv ist
//   GET /api/matches?leagues=BL1,ger.2&from=…&to=…   – Spiele der laufenden Saison (optional gefiltert)
//
// Start: npm run dev (zusammen mit der App) oder npm run dev:api

import { createServer, type ServerResponse } from 'node:http'
import { LEAGUE_CODES, currentSeason } from '../src/shared/leagues.ts'
import { hasApiKey, loadMatches, provider } from './loadMatches.ts'
import { stadiums } from './stadiums.ts'

const PORT = Number(process.env.API_PORT ?? 8787)

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/health') {
      return send(res, 200, { provider: provider.name, season: currentSeason(), stadiums: stadiums.length })
    }
    if (url.pathname === '/api/matches') {
      const requested = (url.searchParams.get('leagues') ?? '').split(',').filter(Boolean)
      const leagues = requested.length
        ? LEAGUE_CODES.filter((c) => requested.includes(c))
        : LEAGUE_CODES
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const data = await loadMatches(leagues)
      // from/to (YYYY-MM-DD) filtern grob nach UTC-Datum; die App rechnet in Ortszeit nach.
      if (from) data.matches = data.matches.filter((m) => m.kickoff.slice(0, 10) >= from)
      if (to) data.matches = data.matches.filter((m) => m.kickoff.slice(0, 10) <= to)
      return send(res, 200, data)
    }
    send(res, 404, { error: 'Nicht gefunden' })
  } catch (err) {
    console.error(err)
    send(res, 500, { error: (err as Error).message })
  }
})

server.listen(PORT, () => {
  console.log(`API läuft auf http://localhost:${PORT} – Datenquelle: ${provider.name}`
    + (hasApiKey ? '' : ' (kein FOOTBALL_DATA_API_KEY in .env, nutze freie Demo-Quellen)'))
})
