// „Alle“-Ansicht einer Album-Kategorie als Stickerraster, nach Ligen gruppiert.

import { useMemo } from 'react'
import type { LeagueCode } from '../shared/types.ts'
import { LEAGUES, leagueByCode } from '../shared/leagues.ts'
import { ALL_TEAMS, collect } from '../lib/album.ts'
import { DERBIES } from '../lib/derbies.ts'
import { stadiumsOfLeague } from '../lib/stadiums.ts'
import { useUserData } from '../state/userData.ts'
import { Sheet } from '../components/Sheet.tsx'
import { ClubSticker, DerbySticker, StadiumSticker } from '../components/Stickers.tsx'

export function AlbumSheet({ section }: { section: string }) {
  const data = useUserData()
  const c = useMemo(() => collect(data.visits), [data.visits])

  const leagueOnly = section.startsWith('league:') ? (section.slice(7) as LeagueCode) : null
  const leagues = leagueOnly ? [leagueByCode(leagueOnly)] : LEAGUES

  if (section === 'derbies') {
    return (
      <Sheet full title={`Derbys · ${c.derbies.size}/${DERBIES.length}`}>
        {leagues.map((l) => (
          <Group key={l.code} title={`${l.flag} ${l.name}`}>
            {DERBIES.filter((d) => d.league === l.code).map((d, i) => <DerbySticker key={d.id} derby={d} got={c.derbies.has(d.id)} index={i} />)}
          </Group>
        ))}
      </Sheet>
    )
  }

  if (section === 'clubs') {
    return (
      <Sheet full title="Vereine">
        {leagues.map((l) => {
          const teams = ALL_TEAMS.filter((t) => t.league === l.code)
          const seen = teams.filter((t) => c.clubs.has(t.name)).length
          return (
            <Group key={l.code} title={`${l.flag} ${l.name}`} count={`${seen}/${teams.length}`}>
              {teams.map((t, i) => <ClubSticker key={t.name} name={t.name} stadiumId={t.stadiumId} seen={c.clubs.get(t.name)?.length ?? 0} index={i} />)}
            </Group>
          )
        })}
      </Sheet>
    )
  }

  return (
    <Sheet full title={leagueOnly ? leagueByCode(leagueOnly).name : 'Stadien'}>
      {leagues.map((l) => {
        const list = stadiumsOfLeague(l.code)
        const got = list.filter((s) => c.stadiums.has(s.id)).length
        return (
          <Group key={l.code} title={`${l.flag} ${l.name}`} count={`${got}/${list.length}`}>
            {list.map((s, i) => <StadiumSticker key={s.id} stadium={s} visits={c.stadiums.get(s.id)?.length ?? 0} index={i} />)}
          </Group>
        )
      })}
    </Sheet>
  )
}

function Group({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <section style={{ paddingBottom: 8 }}>
      <div className="section-head" style={{ paddingTop: 10 }}>
        <h3 className="section-title" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 16, color: 'var(--text)' }}>
          {title}{count && <b className="tnum" style={{ color: 'var(--text-2)' }}>{count}</b>}
        </h3>
      </div>
      <div className="sticker-grid">{children}</div>
    </section>
  )
}
