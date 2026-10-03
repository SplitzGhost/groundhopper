import { motion } from 'motion/react'
import { LEAGUES, LEAGUE_CODES } from '../shared/leagues.ts'
import { stadiumsOfLeague } from '../lib/stadiums.ts'
import { mapFilterStore, setMapFilter } from '../state/ui.ts'
import { Sheet } from '../components/Sheet.tsx'
import { Switch } from '../components/ui.tsx'
import { Flag } from '../components/Flag.tsx'

export function FilterSheet() {
  const filter = mapFilterStore.use()
  const all = filter.leagues.length === LEAGUE_CODES.length

  return (
    <Sheet title="Filter" actions={
      <motion.button type="button" whileTap={{ scale: 0.92 }} style={{ color: 'var(--accent)', fontWeight: 600, padding: '0 6px' }}
        onClick={() => setMapFilter({ leagues: all ? [] : LEAGUE_CODES })}>
        {all ? 'Keine' : 'Alle'}
      </motion.button>
    }>
      <div className="section-head" style={{ paddingTop: 4 }}><h3 className="section-title">Ligen</h3></div>
      <div className="card inset list">
        {LEAGUES.map((l, i) => {
          const on = filter.leagues.includes(l.code)
          return (
            <motion.div key={l.code} className="list-row indent"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.035 }}>
              <Flag code={l.countryCode} size={18} />
              <div className="row-main">
                <div className="row-title">{l.name}</div>
                <div className="row-sub">{l.country} · {stadiumsOfLeague(l.code).length} Stadien</div>
              </div>
              <Switch label={l.name} on={on} onChange={(v) => setMapFilter({
                leagues: v ? LEAGUE_CODES.filter((c) => c === l.code || filter.leagues.includes(c)) : filter.leagues.filter((c) => c !== l.code),
              })} />
            </motion.div>
          )
        })}
      </div>

      <div className="section-head"><h3 className="section-title">Sammlung</h3></div>
      <div className="card inset list">
        <div className="list-row">
          <div className="row-main">
            <div className="row-title">Nur neue Stadien</div>
            <div className="row-sub">Bereits besuchte Stadien ausblenden</div>
          </div>
          <Switch label="Nur neue Stadien" on={filter.onlyUnvisited} onChange={(v) => setMapFilter({ onlyUnvisited: v })} />
        </div>
      </div>
      <p className="muted sheet-pad" style={{ fontSize: 13, marginTop: 14 }}>
        Den Spieltag wählst du unten auf der Karte. Mit dem Stern oben siehst du nur deine gemerkten Spiele.
      </p>
    </Sheet>
  )
}
