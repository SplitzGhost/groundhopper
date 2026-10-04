// Profil eines Freundes: Sammler-Pass, Kennzahlen, Erfolge und alle Spielkarten.
// Schiebt sich wie eine iOS-Unterseite von rechts herein; Karten öffnen sich wie die eigenen.

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from '../lib/fastMotion.tsx'
import { ChevronLeft, UserMinus, Users } from 'lucide-react'
import { collect } from '../lib/album.ts'
import { computeStats } from '../lib/collection.ts'
import type { MatchCard } from '../lib/matchCards.ts'
import { friendCards, loadFriend, removeFriend, useFriend, useSocial } from '../state/social.ts'
import { closeFriend, flyingCardStore, friendViewStore, openCard, showAlert, tabStore } from '../state/ui.ts'
import { useUserData } from '../state/userData.ts'
import { GlassButton, PillButton } from '../components/ui.tsx'
import { MatchCardFront } from '../components/cards/MatchCard.tsx'
import { Avatar } from '../components/social.tsx'
import { CollectorPass } from './AlbumScreen.tsx'
import { parseHopper } from '../lib/hopper/look.ts'
import { AchievementGrid } from './ListView.tsx'

export function FriendView() {
  const username = friendViewStore.use()
  // Gehört zum Freunde-Tab – in anderen Tabs ausblenden
  const tab = tabStore.use()
  return (
    <AnimatePresence>
      {username && tab === 'friends' && <FriendPage key={username} username={username} />}
    </AnimatePresence>
  )
}

const PREVIEW = 12

function FriendPage({ username }: { username: string }) {
  const entry = useFriend(username)
  const { data } = useSocial()
  const own = useUserData().visits
  const profile = entry?.profile ?? null
  const info = data?.friends.find((f) => f.username.toLowerCase() === username.toLowerCase())
  const [all, setAll] = useState(false)

  useEffect(() => {
    void loadFriend(username)
  }, [username])

  const visits = profile?.visits
  const c = useMemo(() => (visits ? collect(visits) : null), [visits])
  const stats = useMemo(() => (visits ? computeStats(visits) : null), [visits])
  const cards = useMemo(() => [...friendCards(profile)].reverse(), [profile])
  // Spiele, bei denen beide waren: gemeinsam markiert oder dasselbe Spiel aus dem Spielplan
  const me = data?.me.username.toLowerCase()
  const together = useMemo(() => {
    const mine = new Set(own.map((v) => v.matchId).filter(Boolean))
    const tagged = new Set((profile?.groups ?? [])
      .filter((g) => g.members.some((m) => m.username.toLowerCase() === me)).map((g) => g.visit))
    return (visits ?? []).filter((v) => tagged.has(v.id) || (v.matchId && mine.has(v.matchId))).length
  }, [own, visits, profile, me])

  const onDragEnd = (_: unknown, i: PanInfo) => {
    if (i.offset.x > 110 || i.velocity.x > 600) closeFriend()
  }

  const askRemove = () => showAlert({
    title: `${username} entfernen?`,
    message: 'Ihr seht dann gegenseitig eure Sammlungen nicht mehr. Gemeinsame Karten bleiben in euren Ordnern.',
    confirm: 'Entfernen',
    destructive: true,
    async onConfirm() {
      const err = await removeFriend(username)
      if (!err) closeFriend()
      return err
    },
  })

  // Spiele, Stadien, Vereine und Länder stehen schon im Pass
  const tiles: [string | number, string][] = stats && c ? [
    [stats.goals, 'Tore'],
    [stats.goalsPerGame.toLocaleString('de-DE', { maximumFractionDigits: 1 }), 'Tore/Spiel'],
    [c.derbies.size, 'Derbys'],
    [c.achievements.filter((a) => a.done).length, 'Erfolge'],
    [new Set(visits!.map((v) => v.league ?? v.competition)).size, 'Wettbewerbe'],
    [together, 'Gemeinsam'],
  ] : []

  return (
    <motion.div className="listpage friendpage"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { type: 'spring', stiffness: 420, damping: 42 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.9 }} onDragEnd={onDragEnd}>
      <header className="listpage-head">
        <GlassButton label="Zurück" icon={<ChevronLeft size={24} strokeWidth={2.4} />} onClick={closeFriend} />
        <div className="listpage-title">
          <b className="truncate">{profile?.username ?? username}</b>
          <span>{info?.since ? `Freunde seit ${new Date(info.since).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}` : 'Freund'}</span>
        </div>
        <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.1 }}>
          <Avatar name={username} v={profile?.avatar ?? info?.avatar ?? null} size={46} />
        </motion.span>
      </header>

      <div className="listpage-body">
        {!profile && entry?.status !== 'error' && (
          <div className="friend-loading"><span className="spinner" /></div>
        )}
        {!profile && entry?.status === 'error' && (
          <div className="card inset friends-note" style={{ marginTop: 12 }}>{entry.error}</div>
        )}

        {profile && c && (
          <>
            <CollectorPass c={c} hopper={parseHopper(profile.hopper)} />

            <div className="stat-grid" style={{ marginTop: 12 }}>
              {tiles.map(([value, label], i) => (
                <motion.div key={label} className={`stat-tile ${label === 'Gemeinsam' ? 'together' : ''}`}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26, delay: 0.1 + i * 0.04 }}>
                  <b>{typeof value === 'number' ? value.toLocaleString('de-DE') : value}</b><span>{label}</span>
                </motion.div>
              ))}
            </div>

            <div className="section-head">
              <h2 className="section-title">Spielkarten{cards.length > 0 && <b className="tnum">{cards.length}</b>}</h2>
            </div>
            {cards.length === 0 ? (
              <div className="card inset friends-note">
                <span className="friends-note-icon"><Users size={22} strokeWidth={2.2} /></span>
                <div><b>Noch keine Karten</b><p>{username} hat noch kein Spiel abgehakt.</p></div>
              </div>
            ) : (
              <>
                <div className="friend-cards">
                  {(all ? cards : cards.slice(0, PREVIEW)).map((card, i) => (
                    <FriendCard key={card.id} card={card} owner={username} index={i} />
                  ))}
                </div>
                {!all && cards.length > PREVIEW && (
                  <div className="sheet-pad" style={{ marginTop: 14 }}>
                    <PillButton block onClick={() => setAll(true)}>Alle {cards.length} Karten zeigen</PillButton>
                  </div>
                )}
              </>
            )}

            <div className="section-head">
              <h2 className="section-title">Erfolge<b className="tnum">{c.achievements.filter((a) => a.done).length}/{c.achievements.length}</b></h2>
            </div>
            <AchievementGrid c={c} />

            <div style={{ display: 'flex', justifyContent: 'center', padding: '26px 0 6px' }}>
              <button type="button" className="text-btn danger" onClick={askRemove}>
                <UserMinus size={17} strokeWidth={2.3} /> Als Freund entfernen
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

function FriendCard({ card, owner, index }: { card: MatchCard; owner: string; index: number }) {
  const flying = flyingCardStore.use() === card.id
  return (
    <motion.button type="button" className="friend-card" data-card={card.id}
      // Frühere Karten liegen oben, damit die Hopper der Nachbarkarten dahinter verschwinden
      style={{ zIndex: 1000 - index, ...(flying ? { visibility: 'hidden' } : null) }}
      initial={{ opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.05 + Math.min(index, 11) * 0.035 }}
      whileTap={{ scale: 0.94 }} onClick={() => openCard(card.id, false, owner)}
      aria-label={`${card.home} gegen ${card.away}`}>
      <MatchCardFront card={card} owner={owner} />
    </motion.button>
  )
}
