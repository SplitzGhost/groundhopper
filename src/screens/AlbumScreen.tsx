// Sammelalbum: Level, Stadien, Ligen, Vereine, Derbys, Länder und Erfolge.

import { useEffect, useMemo } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { ChevronRight, CircleUserRound } from 'lucide-react'
import { LEAGUES } from '../shared/leagues.ts'
import { ALL_TEAMS, COUNTRIES, TEAM_NAMES, collect, levelOf } from '../lib/album.ts'
import { DERBIES } from '../lib/derbies.ts'
import { STADIUMS, stadiumsOfLeague } from '../lib/stadiums.ts'
import { useUserData } from '../state/userData.ts'
import { openSheet } from '../state/ui.ts'
import { ScreenScaffold } from '../components/ScreenScaffold.tsx'
import { GlassButton, ProgressRing } from '../components/ui.tsx'
import { ClubSticker, DerbySticker, StadiumSticker, Sticker } from '../components/Stickers.tsx'

export function AlbumScreen() {
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const level = levelOf(c.points)
  const clubsSeen = [...c.clubs.keys()].filter((n) => TEAM_NAMES.has(n)).length

  // Gesammeltes zuerst, damit die Vorschau-Reihe nicht nur aus grauen Stickern besteht
  const stadiumRow = useMemo(() => [...STADIUMS]
    .sort((a, b) => (c.stadiums.get(b.id)?.length ?? 0) - (c.stadiums.get(a.id)?.length ?? 0))
    .slice(0, 14), [c])
  const clubRow = useMemo(() => [...ALL_TEAMS]
    .sort((a, b) => (c.clubs.get(b.name)?.length ?? 0) - (c.clubs.get(a.name)?.length ?? 0))
    .slice(0, 14), [c])
  const derbyRow = useMemo(() => [...DERBIES].sort((a, b) => Number(c.derbies.has(b.id)) - Number(c.derbies.has(a.id))), [c])

  const countryTotals = useMemo(() => {
    const t = new Map<string, number>()
    for (const s of STADIUMS) t.set(s.country, (t.get(s.country) ?? 0) + 1)
    return t
  }, [])

  const doneAchievements = c.achievements.filter((a) => a.done).length

  return (
    <ScreenScaffold
      title="Sammelalbum"
      actions={<GlassButton label="Profil" icon={<CircleUserRound size={23} strokeWidth={2} />} onClick={() => openSheet({ kind: 'profile' })} />}
    >
      {/* Level-Karte */}
      <motion.div className="hero" initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <div className="hero-level">Level {level.level} · <AnimatedNumber value={c.points} /> Punkte</div>
        <div className="hero-name">{level.name}</div>
        <div className="hero-bar">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(3, level.progress * 100)}%` }}
            transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1], delay: 0.2 }} />
        </div>
        <div className="hero-next">{level.next ? `Noch ${level.toNext} Punkte bis „${level.next}“` : 'Höchstes Level erreicht!'}</div>
        <div className="hero-stats">
          <div className="hero-stat"><b><AnimatedNumber value={data.visits.length} /></b><span>Spiele</span></div>
          <div className="hero-stat"><b><AnimatedNumber value={c.stadiums.size} /></b><span>Stadien</span></div>
          <div className="hero-stat"><b><AnimatedNumber value={clubsSeen} /></b><span>Vereine</span></div>
          <div className="hero-stat"><b><AnimatedNumber value={c.countries.size} /></b><span>Länder</span></div>
        </div>
      </motion.div>

      <SectionHead title="Stadien" count={`${c.stadiums.size} von ${STADIUMS.length}`} onAll={() => openSheet({ kind: 'album', section: 'stadiums' })} />
      <div className="sticker-row">
        {stadiumRow.map((s, i) => <StadiumSticker key={s.id} stadium={s} visits={c.stadiums.get(s.id)?.length ?? 0} index={i} />)}
      </div>

      <SectionHead title="Ligen" count={`${c.completeLeagues.size} von ${LEAGUES.length} komplett`} />
      <div className="league-progress">
        {LEAGUES.map((l, i) => {
          const all = stadiumsOfLeague(l.code)
          const got = all.filter((s) => c.stadiums.has(s.id)).length
          return (
            <motion.button key={l.code} type="button" className="sticker" whileTap={{ scale: 0.92 }}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.05 }}
              onClick={() => openSheet({ kind: 'album', section: `league:${l.code}` })}>
              <ProgressRing value={got / all.length} size={62} stroke={6}>
                <span style={{ fontSize: 24 }}>{l.flag}</span>
              </ProgressRing>
              <div className="sticker-name">{l.name}</div>
              <div className="sticker-sub">{got}/{all.length}</div>
            </motion.button>
          )
        })}
      </div>

      <SectionHead title="Vereine" count={`${clubsSeen} von ${TEAM_NAMES.size}`} onAll={() => openSheet({ kind: 'album', section: 'clubs' })} />
      <div className="sticker-row">
        {clubRow.map((t, i) => <ClubSticker key={t.name} name={t.name} stadiumId={t.stadiumId} seen={c.clubs.get(t.name)?.length ?? 0} index={i} />)}
      </div>

      <SectionHead title="Derbys" count={`${c.derbies.size} von ${DERBIES.length}`} onAll={() => openSheet({ kind: 'album', section: 'derbies' })} />
      <div className="sticker-row">
        {derbyRow.map((d, i) => <DerbySticker key={d.id} derby={d} got={c.derbies.has(d.id)} index={i} />)}
      </div>

      <SectionHead title="Länder" count={`${c.countries.size} von ${countryTotals.size}`} />
      <div className="sticker-row">
        {[...countryTotals.entries()].map(([code, total], i) => (
          <Sticker key={code} got={c.countries.has(code)} name={COUNTRIES[code]?.name ?? code} sub={`${c.countries.get(code) ?? 0}/${total}`} index={i}>
            <span className="flag">{COUNTRIES[code]?.flag}</span>
          </Sticker>
        ))}
      </div>

      <SectionHead title="Erfolge" count={`${doneAchievements} von ${c.achievements.length}`} />
      <div className="card inset list">
        {[...c.achievements].sort((a, b) => Number(b.done) - Number(a.done)).map((a, i) => (
          <motion.div key={a.def.id} className={`ach-row ${a.done ? 'done' : ''}`}
            initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(i, 8) * 0.03 }}>
            <span className="ach-icon">{a.def.emoji}</span>
            <div className="row-main">
              <div className="row-title">{a.def.title}</div>
              <div className="row-sub">{a.def.description}</div>
              {!a.done && a.def.target > 1 && (
                <div className="ach-bar">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${(a.progress / a.def.target) * 100}%` }}
                    viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }} />
                </div>
              )}
            </div>
            <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: a.done ? 'var(--accent)' : 'var(--text-3)' }}>
              {a.done ? '✓' : `${a.progress}/${a.def.target}`}
            </span>
          </motion.div>
        ))}
      </div>
    </ScreenScaffold>
  )
}

function SectionHead({ title, count, onAll }: { title: string; count: string; onAll?: () => void }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}<b className="tnum">{count}</b></h2>
      {onAll && (
        <motion.button type="button" className="section-link" whileTap={{ scale: 0.92 }} onClick={onAll}>
          Alle <ChevronRight size={18} strokeWidth={2.6} />
        </motion.button>
      )}
    </div>
  )
}

/** Zahl, die weich zum neuen Wert hochzählt. */
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 })
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('de-DE'))
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  return <motion.span>{rounded}</motion.span>
}
