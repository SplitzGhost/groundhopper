// Die Hopper auf der Sammelkarte: wie ein Erinnerungsfoto vor der Anzeigetafel.
// Der Besitzer der Karte steht vorn in der Mitte und winkt, die Freunde links und rechts daneben,
// leicht zur Mitte gedreht und etwas weiter hinten.

import { memo } from 'react'
import type { CrewMember } from '../../state/crew.ts'
import { HopperArt } from '../HopperArt.tsx'

/** Mehr passen nicht nebeneinander – der Rest erscheint als „+n“ */
const MAX = 5

/** Reihenfolge von links nach rechts: Besitzer in die Mitte, die anderen abwechselnd daneben */
function arrange(crew: CrewMember[]): CrewMember[] {
  const [lead, ...rest] = crew
  const left: CrewMember[] = []
  const right: CrewMember[] = []
  rest.forEach((m, i) => (i % 2 ? left.unshift(m) : right.push(m)))
  return [...left, lead, ...right]
}

export const CardCrew = memo(function CardCrew({ crew, large }: { crew: CrewMember[]; large: boolean }) {
  const shown = arrange(crew.slice(0, MAX))
  const extra = crew.length - shown.length
  const center = shown.findIndex((m) => m.owner)
  return (
    <div className={`mc-crew n${shown.length}`}>
      {shown.map((m, i) => {
        const d = i - center
        // zur Mitte gedreht; weiter außen etwas kleiner und weiter hinten
        const turn = Math.max(-0.5, Math.min(0.5, -d * 0.22))
        return (
          <span key={m.key} className={`mc-hopper ${m.owner ? 'lead' : ''}`}
            style={{ '--d': Math.abs(d), zIndex: 10 - Math.abs(d) } as React.CSSProperties}>
            <i className="mc-hopper-shadow" />
            <HopperArt look={m.look} kit={m.kit} size={large ? 'lg' : 'md'} turn={turn} wave={m.owner && shown.length > 0 ? 1 : 0} />
          </span>
        )
      })}
      {extra > 0 && <span className="mc-crew-more">+{extra}</span>}
    </div>
  )
})
