import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Map as MapIcon } from 'lucide-react'
import { tabStore, type Tab } from '../state/ui.ts'
import { BallIcon, CardsIcon } from './icons.tsx'
import { softSpring } from '../lib/motion.ts'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'map', label: 'Karte', icon: <MapIcon size={22} strokeWidth={2.1} /> },
  { id: 'games', label: 'Spiele', icon: <BallIcon size={22} /> },
  { id: 'album', label: 'Sammelalbum', icon: <CardsIcon size={23} /> },
]

export function TabBar() {
  const tab = tabStore.use()
  return (
    <nav className="glass tabbar" aria-label="Hauptnavigation">
      {TABS.map((t) => (
        <motion.button
          key={t.id}
          type="button"
          className={`tab ${tab === t.id ? 'active' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          whileTap={{ scale: 0.9 }}
          transition={softSpring}
          onClick={() => tabStore.set(t.id)}
        >
          {tab === t.id && <motion.span layoutId="tab-indicator" className="tab-indicator" transition={softSpring} />}
          {/* Beim Antippen federt das Symbol kurz – neu gestartet über den key */}
          <motion.span key={tab === t.id ? 'on' : 'off'} className="tab-icon"
            initial={tab === t.id ? { scale: 0.7, y: 2 } : false} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 14 }}>
            {t.icon}
          </motion.span>
          <span>{t.label}</span>
        </motion.button>
      ))}
    </nav>
  )
}
