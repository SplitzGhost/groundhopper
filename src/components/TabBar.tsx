// Tab-Leiste unten. Alle Bewegungen sind reines CSS (gleitender Hintergrund, Federn des Symbols,
// Eindrücken beim Antippen) – das spielt iOS selbst ab, auch im Stromsparmodus flüssig.

import type { CSSProperties, ReactNode } from 'react'
import { Map as MapIcon, Users } from 'lucide-react'
import { tabStore, type Tab } from '../state/ui.ts'
import { BallIcon, CardsIcon } from './icons.tsx'
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
        <button
          key={t.id}
          type="button"
          data-tab={t.id}
          className={`tab ${tab === t.id ? 'active' : ''}`}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => tabStore.set(t.id)}
        >
          {/* Beim Aktivieren federt das Symbol kurz – neu gestartet über den key */}
          <span key={tab === t.id ? 'on' : 'off'} className="tab-icon">{t.icon}</span>
          {t.id === 'friends' && pending > 0 && (
            <span key={pending} className="tab-badge tnum">{pending > 9 ? '9+' : pending}</span>
          )}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
