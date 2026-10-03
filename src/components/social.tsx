// Bausteine rund um Freunde: Profilbild, „Mit dabei“-Leiste mit Freundesauswahl und Fotoleiste.

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, Check, Clock, ImagePlus, Plus, Send, UserPlus } from 'lucide-react'
import type { Visit } from '../shared/types.ts'
import type { GroupMember } from '../lib/cloud.ts'
import { jpegSrc } from '../lib/images.ts'
import { addPhoto, avatarVersion, MAX_PHOTOS, setAvatar, tagFriends, useAvatar, useCompanions, usePhotos, useSocial } from '../state/social.ts'
import { closeAllSheets, closeCard, openPhoto, tabStore } from '../state/ui.ts'
import { notify } from '../state/toast.ts'
import { spring } from '../lib/motion.ts'
import { PillButton } from './ui.tsx'

// ---------- Profilbild ----------

/** Farben wie bei Kontakten in iOS: jeder Name bekommt dauerhaft eine eigene */
const TINTS = [
  ['#3aa0ff', '#0068e6'],
  ['#4fd1c5', '#0e9488'],
  ['#8b8cff', '#4f46e5'],
  ['#ffb35c', '#f06a1d'],
  ['#5edc8c', '#16a34a'],
  ['#ff86b0', '#e0336e'],
  ['#b190ff', '#7c3aed'],
]

function tintOf(name: string) {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

export function Avatar({ name, v, size = 36, className = '' }: { name: string; v?: number | null; size?: number; className?: string }) {
  const src = useAvatar(name, v)
  const [a, b] = tintOf(name)
  return (
    <span className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `linear-gradient(180deg, ${a}, ${b})` }}>
      {src
        ? <motion.img key={src} src={src} alt="" draggable={false} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} />
        : name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Eigenes Profilbild mit Kamera-Plakette – Tippen wählt ein neues Bild */
export function AvatarEdit({ name, v, size = 64 }: { name: string; v: number | null; size?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <motion.button type="button" className="avatar-edit" aria-label="Profilbild ändern" whileTap={{ scale: 0.92 }} transition={spring}
        onClick={() => input.current?.click()}>
        <Avatar name={name} v={v} size={size} />
        <span className="avatar-edit-badge">
          {busy ? <span className="spinner sm on-tint" /> : <Camera size={14} strokeWidth={2.6} />}
        </span>
      </motion.button>
      <input ref={input} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(true)
        await setAvatar(f)
        setBusy(false)
      }} />
    </>
  )
}

// ---------- Mit dabei ----------

/** Name mit Profilbild; angefragte (noch nicht bestätigte) Freunde blass mit Uhr */
export function CompanionChip({ member, me }: { member: GroupMember; me?: string }) {
  const isMe = !!me && member.username.toLowerCase() === me.toLowerCase()
  return (
    <motion.span className={`companion ${member.status === 'pending' ? 'pending' : ''}`} layout
      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={spring}>
      <Avatar name={member.username} v={member.avatar} size={24} />
      <span>{isMe ? 'Du' : member.username}</span>
      {member.status === 'pending' && <Clock size={13} strokeWidth={2.6} aria-label="angefragt" />}
    </motion.span>
  )
}

/** Freunde zum Antippen auswählen */
export function FriendPicker({ friends, picked, onToggle }: {
  friends: { username: string; avatar: number | null }[]
  picked: string[]
  onToggle: (username: string) => void
}) {
  return (
    <div className="friend-picker">
      {friends.map((f, i) => {
        const on = picked.includes(f.username)
        return (
          <motion.button key={f.username} type="button" className={`friend-pick ${on ? 'on' : ''}`} aria-pressed={on}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(i, 8) * 0.03 }}
            whileTap={{ scale: 0.92 }} onClick={() => onToggle(f.username)}>
            <span className="friend-pick-avatar">
              <Avatar name={f.username} v={f.avatar} size={44} />
              <AnimatePresence>
                {on && (
                  <motion.span className="friend-pick-check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}>
                    <Check size={13} strokeWidth={3.4} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="truncate">{f.username}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

function goFindFriends() {
  closeCard()
  closeAllSheets()
  tabStore.set('friends')
}

/**
 * Wer bei einem eigenen Besuch dabei war – plus Auswahl, um weitere Freunde zu markieren.
 * `collapsed`: Auswahl erst nach Tippen auf „Markieren“ zeigen (in der Erinnerung).
 */
export function Companions({ visit, collapsed = false }: { visit: Visit; collapsed?: boolean }) {
  const { data, status } = useSocial()
  const companions = useCompanions(visit.id)
  const [open, setOpen] = useState(!collapsed)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const taken = new Set(companions.map((c) => c.username.toLowerCase()))
  const candidates = (data?.friends ?? []).filter((f) => !taken.has(f.username.toLowerCase()))

  const send = async () => {
    setBusy(true)
    const err = await tagFriends(visit, picked)
    setBusy(false)
    if (!err) {
      setPicked([])
      if (collapsed) setOpen(false)
    }
  }

  return (
    <div className="companions-box">
      <div className="companions">
        <AnimatePresence initial={false}>
          {companions.map((c) => <CompanionChip key={c.username} member={c} />)}
        </AnimatePresence>
        {collapsed && !open && candidates.length > 0 && (
          <motion.button type="button" className="companion add" layout whileTap={{ scale: 0.92 }} onClick={() => setOpen(true)}>
            <UserPlus size={15} strokeWidth={2.5} /> Markieren
          </motion.button>
        )}
        {!companions.length && collapsed && !candidates.length && status !== 'ready' && (
          <span className="muted companions-empty">Wird geladen …</span>
        )}
      </div>

      {data && data.friends.length === 0 && (
        <div className="companions-hint">
          <span>Füge Freunde hinzu, um sie bei Spielen zu markieren – sie bekommen dann dieselbe Karte.</span>
          <PillButton small onClick={goFindFriends}><UserPlus size={15} strokeWidth={2.5} /> Freunde finden</PillButton>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && candidates.length > 0 && (
          <motion.div key="picker" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }} style={{ overflow: 'hidden' }}>
            <div className="companions-sub">{companions.length ? 'Wer war noch dabei?' : 'Wer war mit dir im Stadion?'}</div>
            <FriendPicker friends={candidates} picked={picked} onToggle={(u) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : [...p, u]))} />
            <AnimatePresence>
              {picked.length > 0 && (
                <motion.div key="send" initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 8, height: 0 }}
                  transition={spring} style={{ overflow: 'hidden' }}>
                  <div style={{ paddingTop: 10 }}>
                    <PillButton small tint block disabled={busy} onClick={() => void send()}>
                      {busy ? <span className="spinner sm on-tint" /> : <Send size={15} strokeWidth={2.5} />}
                      {picked.length === 1 ? `${picked[0]} fragen` : `${picked.length} Freunde fragen`}
                    </PillButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------- Fotos ----------

/** Fotoleiste einer Erinnerung. `owner` null = eigene Karte (dann mit „+ Foto“). */
export function PhotoStrip({ owner, visitId, canAdd }: { owner: string | null; visitId: string; canAdd: boolean }) {
  const { data } = useSocial()
  const { status, photos } = usePhotos(owner, visitId)
  const [uploading, setUploading] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const room = MAX_PHOTOS - photos.filter((p) => p.mine).length - uploading

  const upload = async (files: File[]) => {
    const list = files.slice(0, Math.max(0, room))
    if (files.length > list.length) {
      notify({ kind: 'info', title: `Höchstens ${MAX_PHOTOS} Fotos`, subtitle: list.length ? `Die ersten ${list.length} werden hochgeladen` : 'Lösche erst ein Foto', icon: 'info' })
    }
    setUploading((n) => n + list.length)
    for (const f of list) {
      await addPhoto(visitId, f)
      setUploading((n) => n - 1)
    }
  }

  if (!canAdd && status !== 'loading' && photos.length === 0) return <div className="photo-empty muted">Noch keine Fotos</div>

  return (
    <div className="photo-strip">
      <AnimatePresence initial={false}>
        {photos.map((p) => (
          <motion.button key={p.id} type="button" className="photo-thumb" layout
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring}
            whileTap={{ scale: 0.93 }} onClick={() => openPhoto(owner, visitId, p.id)} aria-label={`Foto von ${p.username}`}>
            <img src={jpegSrc(p.thumb)} alt="" draggable={false} />
            {!p.mine && <span className="photo-by"><Avatar name={p.username} v={avatarVersion(data, p.username)} size={20} /></span>}
          </motion.button>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <motion.span key={`up-${i}`} className="photo-thumb uploading" layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}>
            <span className="spinner sm" />
          </motion.span>
        ))}
        {status === 'loading' && photos.length === 0 && [0, 1].map((i) => <span key={`sk-${i}`} className="photo-thumb skeleton" />)}
        {canAdd && room > 0 && (
          <motion.button key="add" type="button" className="photo-add" layout whileTap={{ scale: 0.92 }} transition={spring}
            onClick={() => input.current?.click()}>
            {photos.length ? <Plus size={22} strokeWidth={2.4} /> : <ImagePlus size={22} strokeWidth={2.2} />}
            <span>Foto</span>
          </motion.button>
        )}
      </AnimatePresence>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        e.target.value = ''
        if (files.length) void upload(files)
      }} />
    </div>
  )
}
