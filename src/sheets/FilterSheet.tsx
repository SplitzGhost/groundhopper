// Filter für Karte und Spielplan: Wettbewerbe nach Ländern gruppiert (aufklappbar), dazu
// Schnellauswahl (Weltweit, Europa, Deutschland, Top 5) und „nur neue Stadien“.

import { useState } from 'react'
import { AnimatePresence, motion } from '../lib/fastMotion.tsx'
import { ChevronRight } from 'lucide-react'
import type { LeagueCode } from '../shared/types.ts'
import { LEAGUE_CODES, LEAGUE_GROUPS, LEAGUES, type LeagueGroup } from '../shared/leagues.ts'
import { stadiumsOfLeague } from '../lib/stadiums.ts'
import { leagueLogo } from '../lib/crests.ts'
import { mapFilterStore, setMapFilter } from '../state/ui.ts'
import { Sheet } from '../components/Sheet.tsx'
import { Chip, Switch } from '../components/ui.tsx'
import { Flag } from '../components/Flag.tsx'
import { softSpring } from '../lib/motion.ts'

const EUROPE = new Set(['de', 'gb', 'gb-sct', 'es', 'it', 'fr', 'uefa', 'nl', 'pt', 'be', 'at', 'tr', 'gr', 'dk', 'no', 'se', 'ru'])

const PRESETS: { id: string; label: string; codes: LeagueCode[] }[] = [
  { id: 'all', label: 'Weltweit', codes: LEAGUE_CODES },
  { id: 'europe', label: 'Europa', codes: LEAGUES.filter((l) => EUROPE.has(l.countryCode)).map((l) => l.code) },
  { id: 'de', label: 'Deutschland', codes: LEAGUES.filter((l) => l.countryCode === 'de' || l.countryCode === 'uefa').map((l) => l.code) },
  { id: 'top5', label: 'Top 5', codes: LEAGUES.filter((l) => l.source === 'top5').map((l) => l.code) },
]

const sameSet = (a: LeagueCode[], b: LeagueCode[]) => a.length === b.length && b.every((c) => a.includes(c))
/** In Katalogreihenfolge zurückgeben – so bleibt der gespeicherte Filter stabil */
const ordered = (set: Set<LeagueCode>) => LEAGUE_CODES.filter((c) => set.has(c))

export function FilterSheet() {
  const filter = mapFilterStore.use()
  const all = filter.leagues.length === LEAGUE_CODES.length
  const [open, setOpen] = useState<string | null>(null)

  const setLeagues = (codes: Iterable<LeagueCode>) => setMapFilter({ leagues: ordered(new Set(codes)) })
  const toggle = (codes: LeagueCode[], on: boolean) => {
    const next = new Set(filter.leagues)
    for (const c of codes) {
      if (on) next.add(c)
      else next.delete(c)
    }
    setLeagues(next)
  }

  return (
    <Sheet title="Filter" actions={
      <motion.button type="button" whileTap={{ scale: 0.92 }} style={{ color: 'var(--accent)', fontWeight: 600, padding: '0 6px' }}
        onClick={() => setLeagues(all ? [] : LEAGUE_CODES)}>
        {all ? 'Keine' : 'Alle'}
      </motion.button>
    }>
      <div className="chips" style={{ paddingTop: 6 }}>
        {PRESETS.map((p) => (
          <Chip key={p.id} layoutId="filter-preset" on={sameSet(filter.leagues, p.codes)} onClick={() => setLeagues(p.codes)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div className="section-head" style={{ paddingTop: 14 }}>
        <h3 className="section-title">Ligen & Pokale</h3>
        <span className="section-hint tnum">{filter.leagues.length} von {LEAGUE_CODES.length}</span>
      </div>
      <div className="card inset list">
        {LEAGUE_GROUPS.map((g, i) => (
          <GroupRow key={g.countryCode} group={g} index={i} selected={filter.leagues}
            open={open === g.countryCode} onOpen={() => setOpen(open === g.countryCode ? null : g.countryCode)}
            onToggle={toggle} />
        ))}
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
        Der Filter gilt für Karte und Spielplan. Den Spieltag wählst du unten auf der Karte, mit dem Stern
        oben siehst du nur deine gemerkten Spiele.
      </p>
    </Sheet>
  )
}

function GroupRow({ group, index, selected, open, onOpen, onToggle }: {
  group: LeagueGroup
  index: number
  selected: LeagueCode[]
  open: boolean
  onOpen: () => void
  onToggle: (codes: LeagueCode[], on: boolean) => void
}) {
  const codes = group.leagues.map((l) => l.code)
  const on = codes.filter((c) => selected.includes(c)).length
  const single = group.leagues.length === 1

  return (
    <motion.div className="fg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, delay: Math.min(index, 12) * 0.025 }}>
      <div className="list-row indent fg-head">
        <button type="button" className="fg-open" onClick={single ? undefined : onOpen} aria-expanded={single ? undefined : open}>
          <Flag code={group.countryCode} size={18} />
          <div className="row-main">
            <div className="row-title truncate">{single ? group.leagues[0].name : group.country}</div>
            <div className="row-sub truncate">
              {single ? group.country : on === codes.length ? `Alle ${codes.length} Wettbewerbe` : `${on} von ${codes.length} Wettbewerben`}
            </div>
          </div>
          {!single && (
            <motion.span className="fg-chevron" animate={{ rotate: open ? 90 : 0 }} transition={softSpring}>
              <ChevronRight size={18} strokeWidth={2.4} />
            </motion.span>
          )}
        </button>
        <Switch label={group.country} on={on === codes.length} onChange={() => onToggle(codes, on !== codes.length)} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="fg-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
            {group.leagues.map((l) => (
              <div key={l.code} className="list-row fg-league">
                <img className="fg-logo" src={leagueLogo(l.code)} alt="" loading="lazy" draggable={false} />
                <div className="row-main">
                  <div className="row-title truncate">{l.name}</div>
                  <div className="row-sub truncate">
                    {l.kind === 'cup' ? 'Pokal' : `${stadiumsOfLeague(l.code).length} Stadien`}
                  </div>
                </div>
                <Switch label={l.name} on={selected.includes(l.code)} onChange={(v) => onToggle([l.code], v)} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
