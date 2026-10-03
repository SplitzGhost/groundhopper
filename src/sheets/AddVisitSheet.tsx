// Spiel von Hand eintragen – z. B. ältere Spiele, Pokal oder Testspiele.
// Passt das Spiel zu einem aus dem Spielplan, wird es direkt damit verknüpft.

import { useMemo, useState } from 'react'
import type { LeagueCode } from '../shared/types.ts'
import { LEAGUES } from '../shared/leagues.ts'
import { STADIUMS, findTeam } from '../lib/stadiums.ts'
import { ALL_TEAMS, canonicalTeam } from '../lib/album.ts'
import { localDateKey } from '../lib/dates.ts'
import { useMatches } from '../state/matches.ts'
import { addVisit, getUserData, visitFromMatch } from '../state/userData.ts'
import { notify } from '../state/toast.ts'
import { Sheet } from '../components/Sheet.tsx'
import { useSheet } from '../components/sheetContext.ts'
import { PillButton } from '../components/ui.tsx'

export function AddVisitSheet() {
  const { close } = useSheet()
  const matches = useMatches()
  const [date, setDate] = useState(localDateKey())
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [competition, setCompetition] = useState<LeagueCode | 'other'>('BL1')
  const [otherName, setOtherName] = useState('')
  const [stadiumId, setStadiumId] = useState<'auto' | 'none' | string>('auto')

  const autoStadium = useMemo(() => findTeam(home)?.stadiumId ?? null, [home])
  const resolvedStadium = stadiumId === 'auto' ? autoStadium : stadiumId === 'none' ? null : stadiumId

  // Passendes Spiel im Spielplan?
  const linked = useMemo(() => {
    const h = canonicalTeam(home)
    const a = canonicalTeam(away)
    return (matches.byDay.get(date) ?? []).find((m) => canonicalTeam(m.home.name, m.league) === h && canonicalTeam(m.away.name, m.league) === a)
  }, [matches.byDay, date, home, away])

  const valid = home.trim() && away.trim() && date

  const save = () => {
    if (!valid) return
    if (linked) {
      if (!getUserData().visits.some((v) => v.matchId === linked.id)) addVisit(visitFromMatch(linked))
      else notify({ kind: 'info', title: 'Schon eingetragen', subtitle: 'Dieses Spiel ist bereits in deinem Album', icon: 'info' })
    } else {
      const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Number(s) || 0))
      const homeName = canonicalTeam(home.trim())
      const awayName = canonicalTeam(away.trim())
      addVisit({
        matchId: null,
        date,
        kickoff: null,
        league: competition === 'other' ? null : competition,
        competition: competition === 'other' ? otherName.trim() || 'Sonstiges' : null,
        homeTeam: homeName,
        awayTeam: awayName,
        homeCrest: matches.crests.get(homeName) ?? null,
        awayCrest: matches.crests.get(awayName) ?? null,
        homeScore: num(homeScore),
        awayScore: num(awayScore),
        stadiumId: resolvedStadium,
        customStadium: null,
        rating: null,
        notes: '',
      })
    }
    close()
  }

  return (
    <Sheet title="Spiel eintragen">
      <datalist id="team-names">
        {ALL_TEAMS.map((t) => <option key={t.name} value={t.name} />)}
      </datalist>
      <div className="sheet-pad" style={{ display: 'grid', gap: 14 }}>
        <div className="field">
          <label htmlFor="add-date">Datum</label>
          <input id="add-date" className="input" type="date" value={date} max={localDateKey()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 10, alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="add-home">Heim</label>
            <input id="add-home" className="input" list="team-names" value={home} onChange={(e) => setHome(e.target.value)} placeholder="z. B. 1. FC Köln" />
          </div>
          <input aria-label="Tore Heim" className="input tnum" inputMode="numeric" value={homeScore} placeholder="–"
            style={{ textAlign: 'center' }} onChange={(e) => setHomeScore(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 10, alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="add-away">Gast</label>
            <input id="add-away" className="input" list="team-names" value={away} onChange={(e) => setAway(e.target.value)} placeholder="z. B. Borussia Dortmund" />
          </div>
          <input aria-label="Tore Gast" className="input tnum" inputMode="numeric" value={awayScore} placeholder="–"
            style={{ textAlign: 'center' }} onChange={(e) => setAwayScore(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>

        {linked ? (
          <div className="card" style={{ padding: '12px 14px', color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>
            Im Spielplan gefunden – Ergebnis und Stadion werden übernommen.
          </div>
        ) : <>
          <div className="field">
            <label htmlFor="add-comp">Wettbewerb</label>
            <select id="add-comp" className="input" value={competition} onChange={(e) => setCompetition(e.target.value as LeagueCode | 'other')}>
              {LEAGUES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              <option value="other">Anderer Wettbewerb …</option>
            </select>
          </div>
          {competition === 'other' && (
            <input className="input" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="z. B. DFB-Pokal, Testspiel" />
          )}
          <div className="field">
            <label htmlFor="add-stadium">Stadion</label>
            <select id="add-stadium" className="input" value={stadiumId} onChange={(e) => setStadiumId(e.target.value)}>
              <option value="auto">{autoStadium ? `Heimstadion: ${STADIUMS.find((s) => s.id === autoStadium)!.name}` : 'Automatisch (Heimverein)'}</option>
              <option value="none">Anderes / unbekannt</option>
              {STADIUMS.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
            </select>
          </div>
        </>}

        <PillButton tint block disabled={!valid} onClick={save}>Eintragen</PillButton>
      </div>
    </Sheet>
  )
}
