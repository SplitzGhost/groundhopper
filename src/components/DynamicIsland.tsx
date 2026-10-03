// Mitteilung, die aus der Dynamic Island herauswächst.

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Flag, Info, Shield, Star, Swords, Trophy } from 'lucide-react'
import { dismissToast, useToast, type ToastIcon } from '../state/toast.ts'
import { StadiumIcon } from './icons.tsx'
import { tabStore } from '../state/ui.ts'

const ICONS: Record<ToastIcon, ReactNode> = {
  stadium: <StadiumIcon size={20} />,
  club: <Shield size={19} strokeWidth={2.4} />,
  derby: <Swords size={19} strokeWidth={2.4} />,
  trophy: <Trophy size={19} strokeWidth={2.4} />,
  star: <Star size={19} strokeWidth={2.4} fill="currentColor" />,
  check: <Check size={20} strokeWidth={3} />,
  info: <Info size={20} strokeWidth={2.4} />,
  country: <Flag size={19} strokeWidth={2.4} />,
}

export function DynamicIsland({ appWidth }: { appWidth: number }) {
  const shown = useToast()

  const width = Math.min(360, appWidth - 22)
  const gold = shown?.icon === 'star' || shown?.icon === 'trophy'

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key="island"
          className="island"
          onClick={() => {
            // Neue Karten: direkt ins Album
            if (shown.kind === 'unlock') tabStore.set('album')
            dismissToast()
          }}
          initial={{ width: 124, height: 36, borderRadius: 20, opacity: 0.6, padding: '0px 0px' }}
          animate={{ width, height: 68, borderRadius: 36, opacity: 1, padding: '0px 18px 0px 15px' }}
          exit={{ width: 124, height: 36, borderRadius: 20, opacity: 0, padding: '0px 0px', transition: { type: 'spring', stiffness: 500, damping: 40 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.9 }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={shown.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, width: '100%' }}
              initial={{ opacity: 0, filter: 'blur(6px)', scale: 0.92 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(6px)', scale: 0.92 }}
              transition={{ duration: 0.28, delay: 0.12 }}
            >
              <motion.span
                className="island-icon"
                style={gold ? { background: 'linear-gradient(180deg,#ffd34d,#ff9f0a)', boxShadow: '0 0 18px rgba(255,190,40,.55)' } : undefined}
                initial={{ scale: 0.4, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.15 }}
              >
                {ICONS[shown.icon]}
              </motion.span>
              <div className="island-text">
                <div className="island-title truncate">{shown.title}</div>
                {shown.subtitle && <div className="island-sub truncate">{shown.subtitle}</div>}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
