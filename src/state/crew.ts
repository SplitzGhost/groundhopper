// Wer auf einer Sammelkarte steht: der Besitzer der Karte mit seinem Hopper und alle Freunde,
// die bei dem Spiel mit dabei waren (bestätigt). Bei eigenen Karten ist das eigene Trikot das gerade
// angezogene; Freunde tragen, was sie selbst gewählt haben.

import { useMemo } from 'react'
import type { HopperLook, KitId } from '../lib/hopper/look.ts'
import { parseHopper } from '../lib/hopper/look.ts'
import { useAccount } from './account.ts'
import { useHopper, useWardrobe, wornKit } from './hopper.ts'
import { useCompanions, useFriend, type Companion } from './social.ts'

export interface CrewMember {
  key: string
  username: string | null
  look: HopperLook
  kit: KitId
  /** Der Besitzer der Karte (steht vorn in der Mitte) */
  owner: boolean
}

/** Wer bei dem Spiel dabei war: eigene Karte aus dem Freundes-Stand, Karte eines Freundes aus seinem Profil */
export function useCardCompanions(visitId: string, owner?: string): Companion[] {
  const own = useCompanions(visitId)
  const friend = useFriend(owner)
  return useMemo(() => {
    if (!owner) return own
    const seen = new Map<string, Companion>()
    for (const g of friend?.profile?.groups ?? []) {
      if (g.visit !== visitId) continue
      for (const m of g.members) seen.set(m.username.toLowerCase(), m)
    }
    return [...seen.values()]
  }, [own, friend, owner, visitId])
}

/** Alle Hopper für eine Karte – leer, solange der Besitzer keinen Hopper hat */
export function useCrew(visitId: string, owner?: string): CrewMember[] {
  const mine = useHopper()
  const wardrobe = useWardrobe()
  const account = useAccount()
  const friend = useFriend(owner)
  const companions = useCardCompanions(visitId, owner)
  const myName = account.mode === 'user' ? account.username : null
  const myKit = wornKit(mine, wardrobe)

  return useMemo(() => {
    const out: CrewMember[] = []
    const lead = owner ? parseHopper(friend?.profile?.hopper) : mine
    if (!lead) return out
    out.push({ key: owner ?? 'me', username: owner ?? myName, look: lead.look, kit: owner ? lead.kit : myKit, owner: true })
    for (const m of companions) {
      if (m.status !== 'accepted') continue
      const isMe = !!myName && m.username.toLowerCase() === myName.toLowerCase()
      const h = isMe ? mine : parseHopper(m.hopper)
      if (!h) continue
      out.push({ key: m.username.toLowerCase(), username: m.username, look: h.look, kit: isMe ? myKit : h.kit, owner: false })
    }
    return out
  }, [owner, friend, mine, myName, myKit, companions])
}
