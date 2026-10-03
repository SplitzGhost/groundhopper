// Suche auf der Karte: Stadien und Vereine lokal, Orte über OpenStreetMap.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { MapPin, Search, X } from 'lucide-react'
import { STADIUMS } from '../lib/stadiums.ts'
import { normalizeTeamName } from '../shared/teamMatch.ts'
import { searchPlace, type PlaceResult } from '../lib/geo.ts'
import { useMatches } from '../state/matches.ts'
import { closeAllSheets, focusMap } from '../state/ui.ts'
import { Sheet } from '../components/Sheet.tsx'
import { Crest } from '../components/ui.tsx'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function SearchSheet() {
  const [q, setQ] = useState('')
  const [places, setPlaces] = useState<PlaceResult[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const { crests } = useMatches()

  const stadiums = useMemo(() => {
    const term = fold(q.trim())
    if (!term) return []
    const teamTerm = normalizeTeamName(q)
    return STADIUMS.filter((s) =>
      fold(s.name).includes(term) || fold(s.city).includes(term)
      || s.teams.some((t) => [t.name, ...t.aliases].some((n) => fold(n).includes(term) || (teamTerm && normalizeTeamName(n).includes(teamTerm)))),
    ).slice(0, 8)
  }, [q])

  // Ortssuche erst nach kurzer Tipppause (schont den freien OSM-Dienst)
  const term = q.trim()
  useEffect(() => {
    if (term.length < 3) return
    const t = setTimeout(() => {
      setLoadingPlaces(true)
      searchPlace(term).then(setPlaces, () => setPlaces([])).finally(() => setLoadingPlaces(false))
    }, 450)
    return () => clearTimeout(t)
  }, [term])
  const shownPlaces = term.length >= 3 ? places : []

  const goStadium = (id: string, lat: number, lon: number) => {
    closeAllSheets()
    // Nah heran und geneigt – die Karte zeigt das Stadion dann in 3D
    focusMap(lat, lon, 15.6, id)
  }

  return (
    <Sheet full header={
      <div className="sheet-header" style={{ paddingLeft: 16 }}>
        <label className="search-field" style={{ flex: 1, minWidth: 0 }}>
          <Search size={18} strokeWidth={2.4} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stadion, Verein oder Ort"
            enterKeyHint="search" autoCorrect="off" spellCheck={false} />
          {q && (
            <button type="button" aria-label="Leeren" onClick={() => setQ('')} style={{ display: 'grid', color: 'var(--text-3)' }}>
              <X size={18} strokeWidth={2.6} />
            </button>
          )}
        </label>
        <button type="button" style={{ color: 'var(--accent)', fontWeight: 600, flex: 'none' }} onClick={closeAllSheets}>Abbrechen</button>
      </div>
    }>
      {!q.trim() && (
        <p className="muted sheet-pad" style={{ textAlign: 'center', marginTop: 40 }}>
          Suche nach einem Stadion, einem Verein<br />oder einer Stadt.
        </p>
      )}

      {stadiums.length > 0 && <>
        <div className="section-head" style={{ paddingTop: 6 }}><h3 className="section-title">Stadien</h3></div>
        <div className="card inset list">
          {stadiums.map((s, i) => (
            <motion.button key={s.id} type="button" className="list-row indent row-press"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
              onClick={() => goStadium(s.id, s.lat, s.lon)}>
              <Crest src={crests.get(s.teams[0].name)} name={s.teams[0].name} size={34} />
              <div className="row-main">
                <div className="row-title truncate">{s.name}</div>
                <div className="row-sub truncate">{s.teams.map((t) => t.name).join(', ')} · {s.city}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </>}

      {(shownPlaces.length > 0 || loadingPlaces) && <>
        <div className="section-head"><h3 className="section-title">Orte</h3>{loadingPlaces && <span className="spinner" style={{ width: 16, height: 16 }} />}</div>
        <div className="card inset list">
          {shownPlaces.map((p, i) => (
            <motion.button key={p.label} type="button" className="list-row indent row-press"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
              onClick={() => {
                closeAllSheets()
                focusMap(p.lat, p.lon, 10)
              }}>
              <span className="empty-icon" style={{ width: 34, height: 34, borderRadius: 10, margin: 0 }}><MapPin size={18} /></span>
              <div className="row-main">
                <div className="row-title truncate">{p.label.split(',')[0]}</div>
                <div className="row-sub truncate">{p.label.split(',').slice(1).join(',').trim()}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </>}
    </Sheet>
  )
}
