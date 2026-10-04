// Rückfrage-Dialog wie ein iOS-Alert: zoomt weich auf, optional mit Passwortfeld.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from '../lib/fastMotion.tsx'
import { alertStore, closeAlert, type AlertSpec } from '../state/ui.ts'

export function AlertHost() {
  const spec = alertStore.use()
  return <AnimatePresence>{spec && <Alert key={spec.title} spec={spec} />}</AnimatePresence>
}

function Alert({ spec }: { spec: AlertSpec }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && closeAlert()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [busy])

  const confirm = async () => {
    if (busy || (spec.password && !password)) return
    setBusy(true)
    const err = await spec.onConfirm(password)
    setBusy(false)
    if (err) {
      setError(err)
      setShake((s) => s + 1)
    } else {
      closeAlert()
    }
  }

  return (
    <>
      <motion.div className="alert-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onClick={() => !busy && closeAlert()} />
      <div className="alert-wrap">
        <motion.div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title"
          initial={{ opacity: 0, scale: 1.12 }} animate={{ opacity: 1, scale: 1, x: shake ? [0, -10, 9, -6, 4, 0] : 0 }}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 34, x: { duration: 0.4 } }}>
          <div className="alert-body">
            <h2 id="alert-title">{spec.title}</h2>
            <p>{spec.message}</p>
            {spec.password && (
              <input className="input alert-input" type="password" placeholder="Passwort" autoComplete="current-password"
                autoFocus value={password} enterKeyHint="done"
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                onKeyDown={(e) => e.key === 'Enter' && void confirm()} />
            )}
            <AnimatePresence initial={false}>
              {error && (
                <motion.p className="alert-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}>{error}</motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="alert-actions">
            <button type="button" className="alert-btn" onClick={closeAlert} disabled={busy}>Abbrechen</button>
            <button type="button" className={`alert-btn strong ${spec.destructive ? 'danger' : ''}`} onClick={() => void confirm()}
              disabled={busy || (spec.password && !password)}>
              {busy ? <span className="spinner sm" /> : spec.confirm}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}
