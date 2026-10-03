// Sammelliste zum Vervollständigen – schiebt sich wie eine iOS-Unterseite von rechts herein.
// Vereine: große Wappen, grau bis man sie live gesehen hat. Stadien: 3D-Grafik als weißes
// Modell, bunt nach dem ersten Besuch. Dazu Ligen, Derbys und Erfolge.

import { useMemo, type CSSProperties } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { League, Stadium } from '../shared/types.ts'
import { LEAGUES } from '../shared/leagues.ts'
import { collect, type Collection } from '../lib/album.ts'
import { clubSections, clubsOfLeague, countryOfList, groundSections, groundsOfLeague, listInfo, type ListId } from '../lib/lists.ts'
import { DERBIES } from '../lib/derbies.ts'
import { crestFor, leagueLogo } from '../lib/crests.ts'
import { stadiumCapacity } from '../data/stadiumInfo.ts'
import { clubInfo } from '../data/clubs.ts'
import { shortClub } from '../lib/matchCards.ts'
import { useUserData } from '../state/userData.ts'
import { closeList, listStore, openSheet, tabStore } from '../state/ui.ts'
import { GlassButton, ProgressRing } from '../components/ui.tsx'
import { Flag } from '../components/Flag.tsx'
import { StadiumArt } from '../components/StadiumArt.tsx'
import { AchievementIcon } from '../components/AchievementIcon.tsx'

export function ListView() {
  const id = listStore.use()
  // Gehört zum Album-Tab – in anderen Tabs ausblenden, beim Zurückkehren wieder da (wie ein iOS-Navigationsstapel)
  const tab = tabStore.use()
  return (
    <AnimatePresence>
      {id && tab === 'album' && <ListPage key={id} id={id} />}
    </AnimatePresence>
  )
}

const pop = (i: number) => ({
  initial: { opacity: 0, y: 14, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 30, delay: 0.12 + Math.min(i, 18) * 0.025 },
})

function ListPage({ id }: { id: ListId }) {
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])
  const info = listInfo(id, c)
  const country = countryOfList(id)

  // Vom linken Rand nach rechts wischen = zurück (wie in iOS)
  const onDragEnd = (_: unknown, i: PanInfo) => {
    if (i.offset.x > 110 || i.velocity.x > 600) closeList()
  }

  return (
    <motion.div className="listpage"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { type: 'spring', stiffness: 420, damping: 42 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.9 }} onDragEnd={onDragEnd}>
      <header className="listpage-head">
        <GlassButton label="Zurück" icon={<ChevronLeft size={24} strokeWidth={2.4} />} onClick={closeList} />
        <div className="listpage-title">
          <b>{country && <Flag code={country} size={14} />}{info.title}</b>
          <span>{info.subtitle}</span>
        </div>
        <ProgressRing value={info.total ? info.got / info.total : 0} size={46} stroke={4.5}>
          <span className="tnum" style={{ fontSize: 12, fontWeight: 800 }}>{info.got}/{info.total}</span>
        </ProgressRing>
      </header>
      <div className="listpage-body">
        {id.startsWith('clubs:') && <ClubGrid country={country!} c={c} />}
        {id.startsWith('stadiums:') && <StadiumGrid country={country!} c={c} />}
        {id === 'leagues' && <LeagueRows c={c} />}
        {id === 'derbies' && <DerbyRows c={c} />}
        {id === 'achievements' && <AchievementGrid c={c} />}
      </div>
    </motion.div>
  )
}

// ---------- Vereine ----------

/** Überschrift eines Liga-Abschnitts – nur, wenn das Land mehrere Ligen hat */
function SectionHead({ league, got, total, show }: { league: League; got: number; total: number; show: boolean }) {
  if (!show) return null
  return (
    <div className="lsec-head">
      <img src={leagueLogo(league.code)} alt="" draggable={false} />
      <b>{league.name}</b>
      <span className="tnum">{got}/{total}</span>
    </div>
  )
}

function ClubGrid({ country, c }: { country: string; c: Collection }) {
  const sections = clubSections(country)
  // Gesehene zuerst? Nein – feste alphabetische Reihenfolge, wie ein Stickeralbum
  let n = 0
  return sections.map(({ league, items }) => {
    const offset = n
    n += items.length
    return (
      <section key={league.code}>
        <SectionHead league={league} show={sections.length > 1} total={items.length}
          got={items.filter((x) => c.clubs.has(x.name)).length} />
        <ClubItems clubs={items} c={c} offset={offset} />
      </section>
    )
  })
}

function ClubItems({ clubs, c, offset }: { clubs: ReturnType<typeof clubsOfLeague>; c: Collection; offset: number }) {
  return (
    <div className="lc-grid">
      {clubs.map((club, j) => {
        const i = offset + j
        const seen = c.clubs.get(club.name)?.length ?? 0
        return (
          <motion.button key={club.name} type="button" className={`lc-item ${seen ? 'got' : ''}`} {...pop(i)}
            whileTap={{ scale: 0.92 }} style={{ '--club': clubInfo(club.name).primary } as CSSProperties}
            onClick={() => openSheet({ kind: 'club', name: club.name })}>
            <span className="lc-crest">
              <img src={crestFor(club.name, 'sm') ?? undefined} alt="" loading="lazy" draggable={false} />
              {seen > 0 && <span className="lc-check"><Check size={11} strokeWidth={3.4} /></span>}
            </span>
            <span className="lc-name">{shortClub(club.name)}</span>
            <span className="lc-sub">{seen ? `${seen}× live` : 'offen'}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// ---------- Stadien ----------

function StadiumGrid({ country, c }: { country: string; c: Collection }) {
  const sections = groundSections(country)
  let n = 0
  return sections.map(({ league, items }) => {
    const offset = n
    n += items.length
    return (
      <section key={league.code}>
        <SectionHead league={league} show={sections.length > 1} total={items.length}
          got={items.filter((s) => c.stadiums.has(s.id)).length} />
        <div className="ls-grid">
          {items.map((s, j) => <StadiumItem key={s.id} s={s} c={c} i={offset + j} />)}
        </div>
      </section>
    )
  })
}

function StadiumItem({ s, c, i }: { s: Stadium; c: Collection; i: number }) {
  const visits = c.stadiums.get(s.id)?.length ?? 0
  const capacity = stadiumCapacity(s)
  return (
    <motion.button type="button" className={`ls-item ${visits ? 'got' : ''}`} {...pop(i)}
      whileTap={{ scale: 0.95 }} style={{ '--club': clubInfo(s.teams[0].name).primary } as CSSProperties}
      onClick={() => openSheet({ kind: 'stadium', id: s.id })}>
      <span className="ls-art"><StadiumArt stadiumId={s.id} mono={!visits} size="sm" /></span>
      {visits > 0 && <span className="ls-badge"><Check size={11} strokeWidth={3.4} />{visits > 1 ? `${visits}×` : ''}</span>}
      <span className="ls-name truncate">{s.name}</span>
      <span className="ls-sub truncate">{s.city}{capacity ? ` · ${capacity.toLocaleString('de-DE')}` : ''}</span>
    </motion.button>
  )
}

// ---------- Ligen ----------

function LeagueRows({ c }: { c: Collection }) {
  // Wettbewerbe mit Spielen zuerst, sonst Katalogreihenfolge
  const games = (code: string) => c.visits.filter((v) => v.league === code).length
  const list = [...LEAGUES].sort((a, b) => Number(games(b.code) > 0) - Number(games(a.code) > 0))
  return (
    <div className="ll-list">
      {list.map((l, i) => {
        const n = games(l.code)
        const grounds = groundsOfLeague(l.code)
        const gotGrounds = grounds.filter((s) => c.stadiums.has(s.id)).length
        const clubs = clubsOfLeague(l.code)
        const gotClubs = clubs.filter((x) => c.clubs.has(x.name)).length
        return (
          <motion.button key={l.code} type="button" className={`ll-item ${n ? 'got' : ''}`} {...pop(i)}
            whileTap={{ scale: 0.97 }} onClick={() => openSheet({ kind: 'league', code: l.code })}>
            <span className="ll-logo"><img src={leagueLogo(l.code)} alt="" loading="lazy" draggable={false} /></span>
            <div className="ll-main">
              <div className="ll-title"><b>{l.name}</b><Flag code={l.countryCode} size={11} /></div>
              {l.kind === 'league' && clubs.length ? (
                <div className="ll-bars">
                  <Bar label="Stadien" got={gotGrounds} total={grounds.length} />
                  <Bar label="Vereine" got={gotClubs} total={clubs.length} />
                </div>
              ) : (
                <div className="ll-cup tnum">{n ? `${n} ${n === 1 ? 'Spiel' : 'Spiele'} live` : l.kind === 'cup' ? 'Pokal · noch kein Spiel' : 'Noch kein Spiel'}</div>
              )}
            </div>
            <ChevronRight size={18} className="dim" />
          </motion.button>
        )
      })}
    </div>
  )
}

function Bar({ label, got, total }: { label: string; got: number; total: number }) {
  return (
    <span className="ll-bar">
      <span className="tnum">{label} {got}/{total}</span>
      <span className={`tile-bar ${got === total ? 'done' : ''}`}>
        <motion.i initial={{ width: 0 }} animate={{ width: `${total ? (got / total) * 100 : 0}%` }} transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1], delay: 0.3 }} />
      </span>
    </span>
  )
}

// ---------- Derbys ----------

function DerbyRows({ c }: { c: Collection }) {
  return (
    <div className="ld-list">
      {LEAGUES.map((l) => {
        const derbies = DERBIES.filter((d) => d.league === l.code)
        if (!derbies.length) return null
        return (
          <section key={l.code}>
            <div className="ld-head"><Flag code={l.countryCode} size={12} />{l.name}</div>
            <div className="card list">
              {derbies.map((d, i) => {
                const seen = c.derbies.get(d.id)?.length ?? 0
                const [a, b] = d.teams
                return (
                  <motion.button key={d.id} type="button" className={`list-row row-press ld-item ${seen ? 'got' : ''}`} {...pop(i)}
                    style={{ '--a': clubInfo(a).primary, '--b': clubInfo(b).primary } as CSSProperties}
                    onClick={() => openSheet({ kind: 'derby', id: d.id })}>
                    <span className="ld-crests">
                      <img src={crestFor(a) ?? undefined} alt="" loading="lazy" />
                      <img src={crestFor(b) ?? undefined} alt="" loading="lazy" />
                    </span>
                    <div className="row-main">
                      <div className="row-title truncate">{d.name}</div>
                      <div className="row-sub truncate">{shortClub(a)} – {shortClub(b)}</div>
                    </div>
                    {seen ? <span className="ld-seen">{seen}×</span> : <ChevronRight size={18} className="dim" />}
                  </motion.button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ---------- Erfolge ----------

function AchievementGrid({ c }: { c: Collection }) {
  return (
    <div className="la-grid">
      {c.achievements.map((a, i) => (
        <motion.div key={a.def.id} className={`la-item ${a.done ? 'got' : ''}`} {...pop(i)}>
          <ProgressRing value={a.done ? 1 : a.progress / a.def.target} size={58} stroke={4}>
            <span className="la-icon"><AchievementIcon id={a.def.id} size={24} /></span>
          </ProgressRing>
          <b>{a.def.title}</b>
          <span>{a.def.description}</span>
          {!a.done && a.def.target > 1 && <small className="tnum">{a.progress}/{a.def.target}</small>}
        </motion.div>
      ))}
    </div>
  )
}
