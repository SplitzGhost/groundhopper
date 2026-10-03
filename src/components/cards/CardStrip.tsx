// Waagrechte Reihe kleiner Spielkarten (z. B. „Deine Karten“ bei Verein, Stadion, Derby).

import { motion } from 'motion/react'
import type { MatchCard } from '../../lib/matchCards.ts'
import { useRevealed } from '../../state/revealed.ts'
import { flyingCardStore, openCard } from '../../state/ui.ts'
import { CardReverse, MatchCardFront } from './MatchCard.tsx'

export function CardStrip({ cards, className = '' }: { cards: MatchCard[]; className?: string }) {
  const revealed = useRevealed()
  const flying = flyingCardStore.use()
  return (
    <div className={`card-row ${className}`}>
      {cards.map((card, i) => (
        <motion.button key={card.id} type="button" className="card-row-item" data-card={card.id}
          style={{ visibility: flying === card.id ? 'hidden' : 'visible' }}
          initial={{ opacity: 0, x: 24, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28, delay: 0.08 + Math.min(i, 6) * 0.05 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => openCard(card.id)}>
          {revealed.has(card.id) ? <MatchCardFront card={card} /> : <CardReverse isNew />}
        </motion.button>
      ))}
    </div>
  )
}
