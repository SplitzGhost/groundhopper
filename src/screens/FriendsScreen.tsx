// Freunde: eigenes Profilbild, Suche nach Benutzernamen, offene Anfragen (Freundschaft und
// „Warst du dabei?“), die Freundesliste und gesendete Anfragen.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, Clock, Search, UserPlus, Users, X } from 'lucide-react'
import type { FoundUser, Relation, TagRequest } from '../lib/cloud.ts'
import { cloudEnabled } from '../lib/cloud.ts'
import { leagueByCode } from '../shared/leagues.ts'
import { stadiumById } from '../lib/stadiums.ts'
import { crestFor } from '../lib/crests.ts'
import { formatDayMedium, timeAgo } from '../lib/dates.ts'
import { authOpenStore, useAccount } from '../state/account.ts'
import {
  refreshSocial, removeFriend, respondFriend, respondTag, searchUsers, sendFriendRequest, setAvatar, useSocial,
} from '../state/social.ts'
import { openFriend, showAlert, tabStore } from '../state/ui.ts'
import { useUserData } from '../state/userData.ts'
import { ScreenScaffold } from '../components/ScreenScaffold.tsx'
import { ProfileButton } from '../components/ProfileButton.tsx'
import { Crest, Empty, PillButton } from '../components/ui.tsx'
import { Avatar, AvatarEdit } from '../components/social.tsx'
import { spring } from '../lib/motion.ts'

export function FriendsScreen() {
  const account = useAccount()
  return (
    <ScreenScaffold title="Freunde" actions={<ProfileButton />}>
      {account.mode === 'user' ? <SignedIn username={account.username} /> : <Guest />}
    </ScreenScaffold>
  )
}

function Guest() {
  return (
    <Empty icon={<Users size={32} strokeWidth={2.2} />} title="Gemeinsam ins Stadion"
      text="Mit einem Konto findest du Freunde, schaust dir ihre Sammlungen an und teilt Karten und Fotos von gemeinsamen Spielen.">
      {cloudEnabled && (
        <div style={{ marginTop: 10 }}>
          <PillButton tint onClick={() => authOpenStore.set(true)}>Anmelden oder Konto erstellen</PillButton>
        </div>
      )}
    </Empty>
  )
}

function SignedIn({ username }: { username: string }) {
  const { data, status } = useSocial()
  const tab = tabStore.use()
  const [query, setQuery] = useState('')
  const searching = query.trim().length >= 2

  // Beim Öffnen des Tabs frisch holen
  useEffect(() => {
    if (tab === 'friends') void refreshSocial()
  }, [tab])

  const requests = (data?.incoming.length ?? 0) + (data?.tags.length ?? 0)

  return (
    <>
      <MeCard username={username} />

      <div className="friends-search">
        <label className="search-field">
          <Search size={18} strokeWidth={2.4} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Benutzername suchen"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
          <AnimatePresence>
            {query && (
              <motion.button type="button" className="search-clear" aria-label="Suche leeren" onClick={() => setQuery('')}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={spring}>
                <X size={13} strokeWidth={3} />
              </motion.button>
            )}
          </AnimatePresence>
        </label>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {searching ? (
          <motion.div key="search" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <SearchResults query={query.trim()} />
          </motion.div>
        ) : (
          <motion.div key="lists" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {requests > 0 && data && (
              <>
                <div className="section-head"><h2 className="section-title">Anfragen<b className="tnum">{requests}</b></h2></div>
                <div className="request-list">
                  <AnimatePresence initial={false}>
                    {data.tags.map((t) => <TagCard key={t.group} tag={t} />)}
                    {data.incoming.map((r) => (
                      <motion.div key={r.username} className="card inset request-row" layout
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }} transition={spring}>
                        <Avatar name={r.username} v={r.avatar} size={44} />
                        <div className="row-main">
                          <div className="row-title truncate">{r.username}</div>
                          <div className="row-sub">möchte dein Freund sein · {timeAgo(r.at)}</div>
                        </div>
                        <RoundButton label="Ablehnen" onClick={() => respondFriend(r.username, false)}><X size={19} strokeWidth={2.6} /></RoundButton>
                        <RoundButton label="Annehmen" tint onClick={() => respondFriend(r.username, true)}><Check size={19} strokeWidth={2.8} /></RoundButton>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}

            <div className="section-head">
              <h2 className="section-title">Freunde{data && data.friends.length > 0 && <b className="tnum">{data.friends.length}</b>}</h2>
            </div>
            {!data && status === 'loading' && <div className="card inset list"><SkeletonRows /></div>}
            {!data && status === 'error' && (
              <div className="card inset friends-note">Der Server ist gerade nicht erreichbar. Bitte später erneut versuchen.</div>
            )}
            {data && data.friends.length === 0 && (
              <motion.div className="card inset friends-note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span className="friends-note-icon"><UserPlus size={22} strokeWidth={2.2} /></span>
                <div>
                  <b>Noch keine Freunde</b>
                  <p>Such oben nach dem Benutzernamen deiner Freunde und schick ihnen eine Anfrage.</p>
                </div>
              </motion.div>
            )}
            {data && data.friends.length > 0 && (
              <div className="card inset list">
                <AnimatePresence initial={false}>
                  {data.friends.map((f, i) => (
                    <motion.button key={f.username} type="button" className="list-row row-press friend-row" layout="position"
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0, minHeight: 0, paddingTop: 0, paddingBottom: 0 }}
                      transition={{ ...spring, delay: Math.min(i, 10) * 0.03 }} onClick={() => openFriend(f.username)}>
                      <Avatar name={f.username} v={f.avatar} size={44} />
                      <div className="row-main">
                        <div className="row-title truncate">{f.username}</div>
                        <div className="row-sub tnum">
                          {f.games} {f.games === 1 ? 'Spiel' : 'Spiele'} · {f.stadiums} {f.stadiums === 1 ? 'Stadion' : 'Stadien'}
                        </div>
                      </div>
                      <ChevronRight size={20} className="dim" />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {data && data.outgoing.length > 0 && (
              <>
                <div className="section-head"><h2 className="section-title">Gesendet</h2></div>
                <div className="card inset list">
                  <AnimatePresence initial={false}>
                    {data.outgoing.map((o) => (
                      <motion.div key={o.username} className="list-row" layout="position"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, minHeight: 0, paddingTop: 0, paddingBottom: 0 }}>
                        <Avatar name={o.username} v={o.avatar} size={36} />
                        <div className="row-main">
                          <div className="row-title truncate">{o.username}</div>
                          <div className="row-sub">wartet auf Bestätigung · {timeAgo(o.at)}</div>
                        </div>
                        <button type="button" className="text-btn" onClick={() => void removeFriend(o.username)}>Zurückziehen</button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ---------- Eigenes Profil ----------

function MeCard({ username }: { username: string }) {
  const { data } = useSocial()
  const visits = useUserData().visits
  const v = data?.me.avatar ?? null
  const friends = data?.friends.length ?? 0
  const removeAvatar = () => showAlert({
    title: 'Profilbild entfernen?',
    message: 'Statt des Bildes zeigt die App wieder deinen Anfangsbuchstaben.',
    confirm: 'Entfernen',
    destructive: true,
    async onConfirm() {
      await setAvatar(null)
    },
  })
  return (
    <motion.div className="card inset me-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <AvatarEdit name={username} v={v} size={64} />
      <div className="row-main">
        <div className="me-name truncate">{username}</div>
        <div className="row-sub tnum">
          {friends} {friends === 1 ? 'Freund' : 'Freunde'} · {visits.length} {visits.length === 1 ? 'Spiel' : 'Spiele'}
        </div>
        {v != null
          ? <button type="button" className="text-btn small" onClick={removeAvatar}>Bild entfernen</button>
          : <div className="me-hint">Tippe aufs Bild für ein Profilfoto</div>}
      </div>
    </motion.div>
  )
}

// ---------- Suche ----------

function SearchResults({ query }: { query: string }) {
  const [result, setResult] = useState<{ q: string; users: FoundUser[] | string } | null>(null)

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      const users = await searchUsers(query)
      if (alive) setResult({ q: query, users })
    }, 280)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query])

  const setRelation = (name: string, relation: Relation) =>
    setResult((r) => (r && typeof r.users !== 'string' ? { ...r, users: r.users.map((u) => (u.username === name ? { ...u, relation } : u)) } : r))

  if (!result) return <div className="card inset list" style={{ marginTop: 16 }}><SkeletonRows n={2} /></div>
  if (typeof result.users === 'string') return <div className="card inset friends-note" style={{ marginTop: 16 }}>{result.users}</div>
  if (!result.users.length) {
    return (
      <Empty icon={<Search size={30} strokeWidth={2.2} />} title="Niemand gefunden"
        text={`Kein Konto beginnt mit „${result.q}“. Achte auf die genaue Schreibweise des Benutzernamens.`} />
    )
  }
  return (
    <div className="card inset list" style={{ marginTop: 16 }}>
      {result.users.map((u, i) => (
        <motion.div key={u.username} className="list-row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: Math.min(i, 10) * 0.03 }}>
          <Avatar name={u.username} v={u.avatar} size={40} />
          <div className="row-main"><div className="row-title truncate">{u.username}</div></div>
          <RelationButton user={u} onChange={(r) => setRelation(u.username, r)} />
        </motion.div>
      ))}
    </div>
  )
}

function RelationButton({ user, onChange }: { user: FoundUser; onChange: (r: Relation) => void }) {
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<Relation | null>) => {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if (r) onChange(r)
  }
  if (busy) return <span className="spinner sm" style={{ margin: '0 14px' }} />
  switch (user.relation) {
    case 'friend':
      return (
        <PillButton small onClick={() => openFriend(user.username)}>
          <Check size={15} strokeWidth={2.8} style={{ color: 'var(--success)' }} /> Freund
        </PillButton>
      )
    case 'outgoing':
      return (
        <PillButton small onClick={() => void run(async () => ((await removeFriend(user.username)) ? null : 'none'))}>
          <Clock size={15} strokeWidth={2.6} /> Angefragt
        </PillButton>
      )
    case 'incoming':
      return (
        <PillButton small tint onClick={() => void run(async () => ((await respondFriend(user.username, true)) ? null : 'friend'))}>
          <Check size={15} strokeWidth={2.8} /> Annehmen
        </PillButton>
      )
    default:
      return (
        <PillButton small tint onClick={() => void run(() => sendFriendRequest(user.username))}>
          <UserPlus size={15} strokeWidth={2.6} /> Hinzufügen
        </PillButton>
      )
  }
}

// ---------- „Warst du dabei?“ ----------

function TagCard({ tag }: { tag: TagRequest }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const v = tag.visit
  const competition = v.league ? leagueByCode(v.league).name : v.competition ?? 'Spiel'
  const ground = stadiumById(v.stadiumId)?.name ?? v.customStadium?.name ?? null
  const score = v.homeScore != null && v.awayScore != null ? `${v.homeScore}:${v.awayScore}` : '–:–'

  const answer = async (accept: boolean) => {
    setBusy(accept ? 'yes' : 'no')
    const err = await respondTag(tag, accept)
    if (err) setBusy(null)
  }

  return (
    <motion.div className="card inset tag-card" layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }} transition={spring}>
      <div className="tag-head">
        <Avatar name={tag.from ?? '?'} v={tag.avatar} size={30} />
        <span><b>{tag.from ?? 'Ein Freund'}</b> hat dich markiert</span>
        <span className="dim">{timeAgo(tag.at)}</span>
      </div>
      <div className="tag-match">
        <Crest src={crestFor(v.homeTeam, 'sm', v.league ?? undefined) ?? v.homeCrest ?? null} name={v.homeTeam} size={40} />
        <div className="tag-mid">
          <b className="tnum">{score}</b>
          <span className="truncate">{v.homeTeam} – {v.awayTeam}</span>
        </div>
        <Crest src={crestFor(v.awayTeam, 'sm', v.league ?? undefined) ?? v.awayCrest ?? null} name={v.awayTeam} size={40} />
      </div>
      <div className="tag-meta truncate">{formatDayMedium(v.date)} · {competition}{ground ? ` · ${ground}` : ''}</div>
      <div className="tag-q">Warst du bei diesem Spiel dabei?</div>
      <div className="tag-actions">
        <PillButton small block disabled={!!busy} onClick={() => void answer(false)}>
          {busy === 'no' ? <span className="spinner sm" /> : 'Nein'}
        </PillButton>
        <PillButton small block tint disabled={!!busy} onClick={() => void answer(true)}>
          {busy === 'yes' ? <span className="spinner sm on-tint" /> : <><Check size={16} strokeWidth={2.8} /> Ja, war dabei</>}
        </PillButton>
      </div>
    </motion.div>
  )
}

// ---------- Kleinteile ----------

function RoundButton({ label, tint, onClick, children }: { label: string; tint?: boolean; onClick: () => Promise<unknown>; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false)
  return (
    <motion.button type="button" aria-label={label} title={label} className={`glass round-btn ${tint ? 'glass-tint' : ''}`} disabled={busy}
      whileTap={{ scale: 0.86 }} transition={spring}
      onClick={async () => {
        setBusy(true)
        await onClick()
        setBusy(false)
      }}>
      {busy ? <span className={`spinner sm ${tint ? 'on-tint' : ''}`} /> : children}
    </motion.button>
  )
}

function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="list-row">
          <span className="skeleton" style={{ width: 44, height: 44, borderRadius: 22 }} />
          <div className="row-main" style={{ display: 'grid', gap: 6 }}>
            <span className="skeleton" style={{ width: '45%', height: 14 }} />
            <span className="skeleton" style={{ width: '30%', height: 11 }} />
          </div>
        </div>
      ))}
    </>
  )
}
