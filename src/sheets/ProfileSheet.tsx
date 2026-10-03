import { useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import { CloudOff, Download, LogIn, LogOut, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react'
import { collect, levelOf } from '../lib/album.ts'
import { computeStats } from '../lib/collection.ts'
import { exportUserData, importUserData } from '../lib/storage.ts'
import { useMatches } from '../state/matches.ts'
import { replaceUserData, useUserData } from '../state/userData.ts'
import { notify } from '../state/toast.ts'
import { showAlert } from '../state/ui.ts'
import { authOpenStore, deleteAccount, resetCollection, signOut, sync, syncStatusStore, useAccount, type SyncStatus } from '../state/account.ts'
import { cloudEnabled } from '../lib/cloud.ts'
import { Sheet } from '../components/Sheet.tsx'
import { ProgressRing } from '../components/ui.tsx'

export function ProfileSheet() {
  const data = useUserData()
  const account = useAccount()
  const matches = useMatches()
  const file = useRef<HTMLInputElement>(null)
  const stats = useMemo(() => computeStats(data.visits), [data.visits])
  const c = useMemo(() => collect(data.visits), [data.visits])
  const level = levelOf(c.points)

  const tiles: [string | number, string][] = [
    [stats.games, 'Spiele'],
    [stats.stadiums, 'Stadien'],
    [stats.countries, 'Länder'],
    [stats.goals, 'Tore'],
    [stats.goalsPerGame.toLocaleString('de-DE', { maximumFractionDigits: 1 }), 'Tore/Spiel'],
    [c.derbies.size, 'Derbys'],
  ]

  const doExport = () => {
    const url = URL.createObjectURL(exportUserData(data))
    const a = document.createElement('a')
    a.href = url
    a.download = `groundhopper-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const doImport = async (f: File) => {
    try {
      replaceUserData(await importUserData(f))
      notify({ kind: 'info', title: 'Backup geladen', subtitle: 'Deine Sammlung ist wiederhergestellt', icon: 'check' })
    } catch {
      notify({ kind: 'info', title: 'Import fehlgeschlagen', subtitle: 'Keine gültige Groundhopper-Datei', icon: 'info' })
    }
  }

  return (
    <Sheet title="Profil">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 20px 18px' }}>
        <ProgressRing value={level.progress} size={76} stroke={5}>
          <span style={{ fontSize: 26, fontWeight: 800 }}>{level.level}</span>
        </ProgressRing>
        <div>
          <div style={{ font: '800 24px/1.1 var(--font-display)', letterSpacing: -0.5 }}>{level.name}</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            {c.points} Punkte{level.next ? ` · noch ${level.toNext} bis ${level.next}` : ''}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {tiles.map(([value, label], i) => (
          <motion.div key={label} className="stat-tile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: i * 0.04 }}>
            <b>{value}</b><span>{label}</span>
          </motion.div>
        ))}
      </div>

      <AccountSection />

      <div className="section-head"><h3 className="section-title">Daten</h3></div>
      <div className="card inset list">
        <button type="button" className="list-row row-press" onClick={doExport}>
          <Download size={20} style={{ color: 'var(--accent)' }} />
          <div className="row-main"><div className="row-title">Backup exportieren</div><div className="row-sub">Sammlung als Datei sichern</div></div>
        </button>
        <button type="button" className="list-row row-press" onClick={() => file.current?.click()}>
          <Upload size={20} style={{ color: 'var(--accent)' }} />
          <div className="row-main"><div className="row-title">Backup importieren</div><div className="row-sub">Ersetzt die aktuelle Sammlung</div></div>
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
            e.target.value = ''
          }} />
      </div>

      <p className="muted sheet-pad" style={{ fontSize: 12.5, marginTop: 16, lineHeight: 1.5 }}>
        Spielplan: Top 5 über {matches.provider === 'football-data' ? 'football-data.org' : matches.provider === 'demo' ? 'freie Demo-Quellen' : '–'},
        alle weiteren Ligen und Pokale über ESPN und OpenLigaDB
        {matches.status === 'ready' && ` · ${matches.matches.length.toLocaleString('de-DE')} Spiele`}<br />
        Karte © OpenFreeMap, OpenMapTiles, OpenStreetMap-Mitwirkende.
        {account.mode === 'user' ? ' Deine Sammlung wird mit deinem Konto synchronisiert.' : ' Deine Daten bleiben auf diesem Gerät.'}
      </p>
    </Sheet>
  )
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  idle: 'Synchronisiert',
  syncing: 'Wird synchronisiert …',
  offline: 'Offline – wird später übertragen',
  error: 'Server gerade nicht erreichbar',
}

/** Konto: Name, Sync-Status, Abmelden, Sammlung zurücksetzen, Konto löschen */
function AccountSection() {
  const account = useAccount()
  const status = syncStatusStore.use()
  const pending = account.mode === 'user' && account.dirty && status === 'idle'

  const askReset = () => showAlert({
    title: 'Sammlung zurücksetzen?',
    message: account.mode === 'user'
      ? 'Alle Spiele, die Merkliste und deine Sammelkarten werden gelöscht – auch auf deinen anderen Geräten. Dein Konto bleibt bestehen.'
      : 'Alle Spiele, die Merkliste und deine Sammelkarten auf diesem Gerät werden gelöscht.',
    confirm: 'Zurücksetzen',
    destructive: true,
    async onConfirm() {
      await resetCollection()
      notify({ kind: 'info', title: 'Sammlung zurückgesetzt', subtitle: 'Zeit für neue Stadien', icon: 'check' })
    },
  })

  const askSignOut = async () => {
    if ((await signOut()) === 'done') return
    showAlert({
      title: 'Nicht alles übertragen',
      message: 'Einige Änderungen konnten noch nicht hochgeladen werden und gehen beim Abmelden verloren.',
      confirm: 'Trotzdem abmelden',
      destructive: true,
      async onConfirm() {
        await signOut(true)
      },
    })
  }

  const askDelete = () => showAlert({
    title: 'Konto löschen?',
    message: 'Dein Konto und deine gesamte Sammlung werden endgültig gelöscht. Das lässt sich nicht rückgängig machen. Gib zur Bestätigung dein Passwort ein.',
    confirm: 'Löschen',
    destructive: true,
    password: true,
    async onConfirm(password) {
      const err = await deleteAccount(password)
      if (!err) notify({ kind: 'info', title: 'Konto gelöscht', icon: 'check' })
      return err
    },
  })

  return (
    <>
      <div className="section-head"><h3 className="section-title">Konto</h3></div>
      <div className="card inset list">
        {account.mode === 'user' ? (
          <>
            <button type="button" className="list-row row-press" onClick={() => void sync()}>
              <span className="avatar">{account.username.slice(0, 1).toUpperCase()}</span>
              <div className="row-main">
                <div className="row-title truncate">{account.username}</div>
                <div className={`row-sub sync-line ${status}`}>
                  {status === 'offline' || status === 'error' ? <CloudOff size={13} /> : <span className="sync-dot" />}
                  {pending ? STATUS_TEXT.syncing : STATUS_TEXT[status]}
                </div>
              </div>
              <RefreshCw size={18} className={`dim ${status === 'syncing' || pending ? 'spin' : ''}`} />
            </button>
            <button type="button" className="list-row row-press" onClick={() => void askSignOut()}>
              <LogOut size={20} style={{ color: 'var(--accent)' }} />
              <div className="row-main"><div className="row-title">Abmelden</div><div className="row-sub">Sammlung bleibt im Konto gespeichert</div></div>
            </button>
          </>
        ) : (
          <>
            <div className="list-row">
              <span className="avatar guest">G</span>
              <div className="row-main">
                <div className="row-title">Gast</div>
                <div className="row-sub">Sammlung nur auf diesem Gerät</div>
              </div>
            </div>
            {cloudEnabled && (
              <button type="button" className="list-row row-press" onClick={() => authOpenStore.set(true)}>
                <LogIn size={20} style={{ color: 'var(--accent)' }} />
                <div className="row-main"><div className="row-title">Anmelden oder Konto erstellen</div><div className="row-sub">Sammlung sichern und auf andere Geräte übertragen</div></div>
              </button>
            )}
          </>
        )}
        <button type="button" className="list-row row-press" onClick={askReset}>
          <RotateCcw size={20} style={{ color: 'var(--danger)' }} />
          <div className="row-main"><div className="row-title danger-text">Sammlung zurücksetzen</div><div className="row-sub">{account.mode === 'user' ? 'Alle Spiele und Karten löschen, Konto bleibt' : 'Alle Spiele und Karten löschen'}</div></div>
        </button>
        {account.mode === 'user' && (
          <button type="button" className="list-row row-press" onClick={askDelete}>
            <Trash2 size={20} style={{ color: 'var(--danger)' }} />
            <div className="row-main"><div className="row-title danger-text">Konto löschen</div><div className="row-sub">Konto und Sammlung endgültig entfernen</div></div>
          </button>
        )}
      </div>
    </>
  )
}
