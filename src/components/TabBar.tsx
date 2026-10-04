import type { CSSProperties, ReactNode } from 'react'
import { motion } from '../lib/fastMotion.tsx'
import { Map as MapIcon, Users } from 'lucide-react'
import { tabStore, type Tab } from '../state/ui.ts'
import { BallIcon, CardsIcon } from './icons.tsx'
import { softSpring } from '../lib/motion.ts'
import { usePendingCount } from '../state/social.ts'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'map', label: 'Karte', icon: <MapIcon size={22} strokeWidth={2.1} /> },
  { id: 'games', label: 'Spiele', icon: <BallIcon size={22} /> },
  { id: 'album', label: 'Sammelalbum', icon: <CardsIcon size={23} /> },
  { id: 'friends', label: 'Freunde', icon: <Users size={22} strokeWidth={2.1} /> },
]

export function TabBar() {
  const tab = tabStore.use()
  const pending = usePendingCount()
  return (
    <nav className="glass tabbar" aria-label="Hauptnavigation">
      <span className="tab-indicator" style={{ '--i': TABS.findIndex((t) => t.id === tab) } as CSSProperties} />
      {TABS.map((t) => (
        <motion.button
          key={t.id}
          type="button"
          data-tab={t.id}
          className={`tab ${tab === t.id ? 'active' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          whileTap={{ scale: 0.9 }}
          transition={softSpring}
          onClick={() => tabStore.set(t.id)}
        >
          {/* Beim Antippen federt das Symbol kurz – neu gestartet über den key */}
          <motion.span key={tab === t.id ? 'on' : 'off'} className="tab-icon"
            initial={tab === t.id ? { scale: 0.7, y: 2 } : false} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 14 }}>
            {t.icon}
          </motion.span>
          {t.id === 'friends' && pending > 0 && (
            <motion.span key={pending} className="tab-badge tnum" initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 16 }}>
              {pending > 9 ? '9+' : pending}
            </motion.span>
          )}
          <span>{t.label}</span>
        </motion.button>
      ))}
    </nav>
  )
}
