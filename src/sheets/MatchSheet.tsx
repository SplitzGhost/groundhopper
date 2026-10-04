// Spieldetails: Paarung, Ergebnis, Stadion – und „Ich war dabei“ bzw. „Merken“.
// Für manuell eingetragene Besuche ohne Spiel aus der Datenquelle gibt es VisitSheet.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from '../lib/fastMotion.tsx'
import { Camera, Check, ChevronRight, Flame, Star, Trash2, Users } from 'lucide-react'
import type { Visit } from '../shared/types.ts'
import { leagueByCode } from '../shared/leagues.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { formatDayLong, formatTime, localDateKey, relativeDay } from '../lib/dates.ts'
import { derbyOf } from '../lib/derbies.ts'
import { canonicalTeam } from '../lib/album.ts'
import { crestFor } from '../lib/crests.ts'
import { useMatches } from '../state/matches.ts'
import { removeVisit, toggleMatchVisit, toggleWatch, updateVisit, useUserData, visitOfMatch } from '../state/userData.ts'
import { openSheet, pendingCardStore } from '../state/ui.ts'
import { CardsIcon } from '../components/icons.tsx'
import { Sheet } from '../components/Sheet.tsx'
import { useSheet } from '../components/sheetContext.ts'
import { hasStarted } from '../lib/matchState.ts'
import { Crest, PillButton } from '../components/ui.tsx'
import { softSpring, spring } from '../lib/motion.ts'
import { StadiumThumb } from '../components/StadiumThumb.tsx'
import { Flag } from '../components/Flag.tsx'
import { Companions, PhotoStrip } from '../components/social.tsx'
import { useAccount } from '../state/account.ts'

export function MatchSheet({ id }: { id: string }) {
  const matches = useMatches()
  const data = useUserData()
  const m = matches.byId.get(id)
  if (!m) return <Sheet title="Spiel"><p className="sheet-pad muted">Spiel nicht gefunden.</p></Sheet>

  const visit = visitOfMatch(data, m.id)
  const watched = data.watchlist.includes(m.id)
  const started = hasStarted(m)
  const league = leagueByCode(m.league)
  const stadium = stadiumById(m.stadiumId)
  const day = localDateKey(m.kickoff)
  const hasScore = m.score.home !== null && m.score.away !== null
  const derby = derbyOf(canonicalTeam(m.home.name, m.league), canonicalTeam(m.away.name, m.league))

  return (
    <Sheet title={<span className="title-flag"><Flag code={league.countryCode} size={15} />{league.name}{m.matchday ? <span className="muted" style={{ fontWeight: 600 }}> · {m.matchday}. Spieltag</span> : null}</span>}>
      {derby && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <span className="league-tag derby-tag"><Flame size={12} strokeWidth={2.6} /> {derby.name}</span>
        </div>
      )}
      <Versus
        home={{ name: m.home.name, crest: m.home.crest }}
        away={{ name: m.away.name, crest: m.away.crest }}
        mid={hasScore
          ? <span className="versus-score">{m.score.home}:{m.score.away}</span>
          : <span className="versus-time">{formatTime(m.kickoff)}</span>}
        sub={<>
          {m.status === 'live' && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>● Live · </span>}
          {relativeDay(day) ?? formatDayLong(day)}
          {hasScore && m.score.halfTimeHome !== null && <div className="dim tnum">({m.score.halfTimeHome}:{m.score.halfTimeAway})</div>}
        </>}
      />

      {stadium && (
        <button type="button" className="card inset list-row row-press pressable" style={{ width: 'calc(100% - 32px)' }}
          onClick={() => openSheet({ kind: 'stadium', id: stadium.id })}>
          <StadiumThumb stadiumId={stadium.id} collected={data.visits.some((x) => x.stadiumId === stadium.id)} />
          <div className="row-main">
            <div className="row-title truncate">{stadium.name}</div>
            <div className="row-sub">{stadium.city}</div>
          </div>
          <ChevronRight size={20} className="dim" />
        </button>
      )}

      <div className="sheet-pad" style={{ marginTop: 16 }}>
        {started ? (
          <PillButton block tint={!visit} onClick={() => toggleMatchVisit(m)}>
            <motion.span key={String(!!visit)} initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={spring}
              style={{ display: 'grid', color: visit ? 'var(--accent)' : undefined }}>
              <Check size={20} strokeWidth={3} />
            </motion.span>
            {visit ? 'Dabei gewesen' : 'Ich war dabei'}
          </PillButton>
        ) : (
          <PillButton block tint={!watched} onClick={() => toggleWatch(m.id)}>
            <motion.span key={String(watched)} initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={spring}
              style={{ display: 'grid', color: watched ? 'var(--gold)' : undefined }}>
              <Star size={19} strokeWidth={2.5} fill={watched ? 'currentColor' : 'none'} />
            </motion.span>
            {watched ? 'Gemerkt' : 'Spiel merken'}
          </PillButton>
        )}
      </div>

      <AnimatePresence initial={false}>
        {visit && (
          <motion.div key="editor" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={softSpring} style={{ overflow: 'hidden' }}>
            <VisitEditor visit={visit} />
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}

/** Manuell eingetragener Besuch */
export function VisitSheet({ id }: { id: string }) {
  const data = useUserData()
  const v = data.visits.find((x) => x.id === id)
  const { close } = useSheet()
  useEffect(() => {
    if (!v) close()
  }, [v, close])
  if (!v) return <Sheet title="Besuch">{null}</Sheet>
  const stadium = stadiumById(v.stadiumId)
  const competition = v.league ? leagueByCode(v.league).name : v.competition

  return (
    <Sheet title={competition ?? 'Spiel'}>
      <Versus
        home={{ name: v.homeTeam, crest: crestFor(v.homeTeam) ?? v.homeCrest ?? null }}
        away={{ name: v.awayTeam, crest: crestFor(v.awayTeam) ?? v.awayCrest ?? null }}
        mid={v.homeScore !== null && v.awayScore !== null
          ? <span className="versus-score">{v.homeScore}:{v.awayScore}</span>
          : <span className="versus-time">–:–</span>}
        sub={formatDayLong(v.date)}
      />
      {stadium && (
        <button type="button" className="card inset list-row row-press pressable" style={{ width: 'calc(100% - 32px)' }}
          onClick={() => openSheet({ kind: 'stadium', id: stadium.id })}>
          <StadiumThumb stadiumId={stadium.id} collected={data.visits.some((x) => x.stadiumId === stadium.id)} />
          <div className="row-main">
            <div className="row-title truncate">{stadium.name}</div>
            <div className="row-sub">{stadium.city}</div>
          </div>
          <ChevronRight size={20} className="dim" />
        </button>
      )}
      <VisitEditor visit={v} />
    </Sheet>
  )
}

function Versus({ home, away, mid, sub }: {
  home: { name: string; crest: string | null }
  away: { name: string; crest: string | null }
  mid: React.ReactNode
  sub: React.ReactNode
}) {
  return (
    <div className="versus">
      {[home, away].map((t, i) => (
        <motion.div key={t.name} className="versus-team" style={{ order: i ? 3 : 1 }}
          initial={{ opacity: 0, x: i ? 24 : -24, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}>
          <Crest src={t.crest} name={t.name} size={64} />
          <span>{t.name}</span>
        </motion.div>
      ))}
      <motion.div className="versus-mid" style={{ order: 2 }}
        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.15 }}>
        {mid}
        <span className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{sub}</span>
      </motion.div>
    </div>
  )
}

/** Bewertung, Notizen und Entfernen eines Besuchs */
function VisitEditor({ visit }: { visit: Visit }) {
  const [notes, setNotes] = useState(visit.notes)
  const latest = useRef({ id: visit.id, notes, saved: visit.notes })

  // Notizen beim Schließen des Sheets sichern
  useEffect(() => () => {
    const l = latest.current
    if (l.notes !== l.saved) updateVisit(l.id, { notes: l.notes })
  }, [])

  const pending = pendingCardStore.use() === visit.id
  const signedIn = useAccount().mode === 'user'

  return (
    <div style={{ paddingTop: 8 }}>
      <AnimatePresence initial={false}>
        {pending && (
          <motion.div key="earned" className="earned-card" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30, delay: 0.15 }}>
            <motion.span className="earned-card-icon" initial={{ rotate: -25, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 12, delay: 0.3 }}><CardsIcon size={22} /></motion.span>
            <div><b>Neue Spielkarte verdient</b><span>Bewerte das Spiel – beim Schließen deckst du die Karte auf.</span></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="section-head"><h3 className="section-title">Deine Bewertung</h3></div>
      <div className="card inset" style={{ padding: '14px 16px' }}>
        <div className="stars" style={{ justifyContent: 'center', gap: 14 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (visit.rating ?? 0) >= n
            return (
              <motion.button key={n} type="button" className={`star-btn ${on ? 'on' : ''}`} aria-label={`${n} Sterne`}
                whileTap={{ scale: 0.75 }}
                animate={on ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, delay: on ? (n - 1) * 0.04 : 0 }}
                onClick={() => updateVisit(visit.id, { rating: visit.rating === n ? null : n })}>
                <Star size={32} strokeWidth={1.8} fill={on ? 'currentColor' : 'none'} />
              </motion.button>
            )
          })}
        </div>
      </div>

      {signedIn && <>
        <div className="section-head"><h3 className="section-title section-icon"><Users size={17} strokeWidth={2.4} /> Mit dabei</h3></div>
        <div className="card inset" style={{ padding: '12px 14px' }}>
          <Companions visit={visit} />
        </div>
      </>}

      <div className="section-head"><h3 className="section-title">Notizen</h3></div>
      <div className="sheet-pad">
        <textarea className="input" value={notes} placeholder="Stimmung, Choreo, Bratwurst …"
          onChange={(e) => {
            setNotes(e.target.value)
            latest.current.notes = e.target.value
          }}
          onBlur={() => {
            if (notes !== latest.current.saved) {
              latest.current.saved = notes
              updateVisit(visit.id, { notes })
            }
          }} />
      </div>

      {signedIn && <>
        <div className="section-head"><h3 className="section-title section-icon"><Camera size={17} strokeWidth={2.4} /> Fotos</h3></div>
        <div className="sheet-pad">
          <PhotoStrip owner={null} visitId={visit.id} canAdd />
        </div>
      </>}

      <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 6px' }}>
        <button type="button" className="pressable" style={{ color: 'var(--danger)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}
          onClick={() => removeVisit(visit.id)}>
          <Trash2 size={17} strokeWidth={2.2} /> Besuch entfernen
        </button>
      </div>
    </div>
  )
}
