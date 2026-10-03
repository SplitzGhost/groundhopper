// Sticker fürs Sammelalbum: rund für Stadien/Vereine/Länder, Wappenform für Derbys.

import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import type { Match, Stadium } from '../shared/types.ts'
import type { Derby } from '../lib/derbies.ts'
import { useMatches } from '../state/matches.ts'
import { openSheet } from '../state/ui.ts'
import { Crest } from './ui.tsx'
import { spring } from '../lib/motion.ts'
import { StadiumIcon } from './icons.tsx'

interface StickerProps {
  got: boolean
  name: string
  sub?: string
  shield?: boolean
  index: number
  onClick?: () => void
  children: ReactNode
}

export function Sticker({ got, name, sub, shield, index, onClick, children }: StickerProps) {
  return (
    <motion.button
      type="button"
      className={`sticker ${got ? 'got' : 'locked'}`}
      initial={{ opacity: 0, scale: 0.6, y: 12 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ ...spring, delay: (index % 8) * 0.035 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
    >
      <div className={`sticker-disc ${shield ? 'shield' : ''}`} style={{ '--shine-d': `${(index * 0.73) % 5}s` } as CSSProperties}>
        {children}
        {got && (
          <motion.span className="sticker-check" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.25 + (index % 8) * 0.035 }}>
            <Check size={13} strokeWidth={3.6} />
          </motion.span>
        )}
      </div>
      <div className="sticker-name">{name}</div>
      {sub && <div className="sticker-sub">{sub}</div>}
    </motion.button>
  )
}

export function StadiumSticker({ stadium, visits, index }: { stadium: Stadium; visits: number; index: number }) {
  const { crests } = useMatches()
  const crest = crests.get(stadium.teams[0].name)
  return (
    <Sticker got={visits > 0} name={stadium.name} sub={visits > 1 ? `${visits}× besucht` : stadium.city} index={index}
      onClick={() => openSheet({ kind: 'stadium', id: stadium.id })}>
      {crest ? <Crest src={crest} name={stadium.teams[0].name} size={44} /> : <StadiumIcon size={30} />}
    </Sticker>
  )
}

export function ClubSticker({ name, stadiumId, seen, index }: { name: string; stadiumId: string; seen: number; index: number }) {
  const { crests } = useMatches()
  return (
    <Sticker got={seen > 0} name={name.replace(/\s+(FC|CF|AFC|SC)$/, '')} sub={seen > 0 ? `${seen}× gesehen` : undefined} index={index}
      onClick={() => openSheet({ kind: 'stadium', id: stadiumId })}>
      <Crest src={crests.get(name)} name={name} size={46} />
    </Sticker>
  )
}

export function DerbySticker({ derby, got, index }: { derby: Derby; got: boolean; index: number }) {
  const { crests, matches } = useMatches()
  const [a, b] = derby.teams
  const open = () => {
    // Nächstes (oder letztes) Aufeinandertreffen öffnen
    const games = matches.filter((m: Match) =>
      (m.home.name === a && m.away.name === b) || (m.home.name === b && m.away.name === a))
    const next = games.find((m) => Date.parse(m.kickoff) > Date.now()) ?? games.at(-1)
    if (next) openSheet({ kind: 'match', id: next.id })
  }
  return (
    <Sticker got={got} name={derby.name} shield index={index} onClick={open}>
      <div className="derby-crests">
        <Crest src={crests.get(a)} name={a} size={30} />
        <Crest src={crests.get(b)} name={b} size={30} />
      </div>
    </Sticker>
  )
}
