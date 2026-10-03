// App-Hülle: Karte liegt immer unten, Spiele und Album blenden darüber ein.
// Am Computer wird die App in einem iPhone-Rahmen gezeigt – gebaut ist sie fürs iPhone.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BatteryFull, Share, SignalHigh, Wifi, X } from 'lucide-react'
import { tabStore, type Tab } from './state/ui.ts'
import { MapScreen } from './screens/MapScreen.tsx'
import { GamesScreen } from './screens/GamesScreen.tsx'
import { AlbumScreen } from './screens/AlbumScreen.tsx'
import { TabBar } from './components/TabBar.tsx'
import { DynamicIsland } from './components/DynamicIsland.tsx'
import { SheetHost } from './sheets/SheetHost.tsx'
import { BinderView } from './screens/BinderView.tsx'
import { ListView } from './screens/ListView.tsx'
import { CardViewer } from './components/cards/CardViewer.tsx'
import { GlassButton } from './components/ui.tsx'
import { loadPref, savePref } from './lib/storage.ts'
import { refreshReports } from './state/userData.ts'
import { AuthScreen } from './screens/AuthScreen.tsx'
import { AlertHost } from './components/Alert.tsx'

export default function App() {
  const appRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(390)

  useEffect(() => {
    const el = appRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    // Fehlende Spielberichte der Sammelkarten im Hintergrund nachladen
    const t = setTimeout(() => void refreshReports(), 2500)
    return () => {
      ro.disconnect()
      clearTimeout(t)
    }
  }, [])

  return (
    <div className="device">
      <div className="device-frame">
        <div className="app" ref={appRef}>
          <MapScreen />
          <Overlay tab="games"><GamesScreen /></Overlay>
          <Overlay tab="album"><AlbumScreen /></Overlay>
          <TabBar />
          <ListView />
          <BinderView />
          <SheetHost />
          <CardViewer />
          <InstallHint />
          <AuthScreen />
          <AlertHost />
          <FakeStatusBar />
          <div className="fake-island" />
          <DynamicIsland appWidth={width} />
        </div>
      </div>
    </div>
  )
}

/** Bildschirm über der Karte: weiches Ein-/Ausblenden mit leichter Tiefe, bleibt gemountet (Scrollposition). */
function Overlay({ tab, children }: { tab: Tab; children: ReactNode }) {
  const active = tabStore.use() === tab
  // Erst beim ersten Öffnen rendern, danach gemountet lassen
  const [mounted, setMounted] = useState(active)
  if (active && !mounted) setMounted(true)

  return (
    <motion.div
      className="screen"
      initial={false}
      animate={active
        ? { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', visibility: 'visible' }
        : { opacity: 0, scale: 0.97, y: 10, filter: 'blur(4px)', transitionEnd: { visibility: 'hidden' } }}
      transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.8 }}
      style={{ pointerEvents: active ? 'auto' : 'none' }}
      aria-hidden={!active}
    >
      {mounted && children}
    </motion.div>
  )
}

function FakeStatusBar() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="fake-statusbar" aria-hidden>
      <span>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="icons">
        <SignalHigh size={17} strokeWidth={2.6} />
        <Wifi size={17} strokeWidth={2.6} />
        <BatteryFull size={24} strokeWidth={1.8} />
      </span>
    </div>
  )
}

/** Auf dem iPhone in Safari: Hinweis, die App zum Home-Bildschirm hinzuzufügen (= echtes Vollbild). */
function InstallHint() {
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || matchMedia('(display-mode: standalone)').matches
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isIos || standalone || loadPref('install-hint-dismissed', false)) return
    const t = setTimeout(() => setShow(true), 2500)
    return () => clearTimeout(t)
  }, [isIos, standalone])

  const dismiss = () => {
    setShow(false)
    savePref('install-hint-dismissed', true)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="glass glass-strong install-hint"
          initial={{ y: 140, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 140, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
          <span className="empty-icon" style={{ width: 46, height: 46, borderRadius: 14, margin: 0, flex: 'none' }}>
            <Share size={22} strokeWidth={2.2} />
          </span>
          <div style={{ flex: 1, fontSize: 14, lineHeight: 1.35 }}>
            <b>Im Vollbild nutzen</b><br />
            <span className="muted">Tippe auf „Teilen“ und dann auf „Zum Home-Bildschirm“.</span>
          </div>
          <GlassButton small label="Schließen" icon={<X size={18} strokeWidth={2.6} />} onClick={dismiss} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
