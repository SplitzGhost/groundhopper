// Anmeldebildschirm: beim ersten Start (Anmelden, Konto erstellen oder als Gast weiter)
// und später aus dem Profil heraus, wenn man als Gast doch ein Konto möchte.

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from '../lib/fastMotion.tsx'
import { CloudUpload, X } from 'lucide-react'
import { authOpenStore, continueAsGuest, signIn, useAccount } from '../state/account.ts'
import { GlassButton, PillButton, Segmented } from '../components/ui.tsx'

type Kind = 'login' | 'register'

export function AuthScreen() {
  const account = useAccount()
  const open = authOpenStore.use()
  const show = account.mode === 'none' || (account.mode === 'guest' && open)
  return (
    <AnimatePresence>
      {show && <AuthPanel key="auth" asGuest={account.mode === 'guest'} />}
    </AnimatePresence>
  )
}

function AuthPanel({ asGuest }: { asGuest: boolean }) {
  const [kind, setKind] = useState<Kind>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const passRef = useRef<HTMLInputElement>(null)
  const repeatRef = useRef<HTMLInputElement>(null)

  const fail = (msg: string) => {
    setError(msg)
    setShake((s) => s + 1)
  }

  const submit = async () => {
    if (busy) return
    if (!username.trim() || !password) return fail('Bitte Benutzername und Passwort eingeben.')
    if (kind === 'register') {
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username.trim())) return fail('Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt, - und _')
      if (password.length < 6) return fail('Das Passwort braucht mindestens 6 Zeichen.')
      if (password !== repeat) return fail('Die Passwörter stimmen nicht überein.')
    }
    setBusy(true)
    setError(null)
    const err = await signIn(kind, username, password)
    setBusy(false)
    if (err) fail(err)
  }

  const switchKind = (k: Kind) => {
    setKind(k)
    setError(null)
    setRepeat('')
  }

  const field = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring', stiffness: 380, damping: 30, delay: 0.12 + i * 0.05 },
  } as const)

  return (
    <motion.div className="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)', transition: { duration: 0.35 } }}
      transition={{ duration: 0.3 }}>
      <div className="auth-glow" aria-hidden />
      {asGuest && (
        <div className="auth-close">
          <GlassButton small label="Schließen" icon={<X size={18} strokeWidth={2.6} />} onClick={() => authOpenStore.set(false)} />
        </div>
      )}

      <div className="auth-scroll">
        <motion.div className="auth-hero" initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
          <motion.img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="auth-icon"
            animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
          <h1>Groundhopper</h1>
          <p className="muted">{asGuest ? 'Sichere deine Sammlung und nimm sie auf jedes Gerät mit.' : 'Deine Stadionsammlung – auf all deinen Geräten.'}</p>
        </motion.div>

        <motion.form className="auth-card glass glass-strong" noValidate
          animate={{ x: shake ? [0, -12, 10, -7, 4, 0] : 0 }} transition={{ duration: 0.4 }}
          onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <motion.div {...field(0)}>
            <Segmented id="auth-kind" value={kind} onChange={switchKind}
              options={[{ value: 'login', label: 'Anmelden' }, { value: 'register', label: 'Konto erstellen' }]} />
          </motion.div>

          <motion.div className="field" {...field(1)}>
            <label htmlFor="auth-user">Benutzername</label>
            <input id="auth-user" className="input" name="username" autoComplete="username" autoCapitalize="none"
              autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={20} value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passRef.current?.focus() } }} />
          </motion.div>

          <motion.div className="field" {...field(2)}>
            <label htmlFor="auth-pass">Passwort</label>
            <input id="auth-pass" ref={passRef} className="input" type="password" name="password"
              autoComplete={kind === 'login' ? 'current-password' : 'new-password'}
              enterKeyHint={kind === 'login' ? 'go' : 'next'} value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (kind === 'register') repeatRef.current?.focus()
                else void submit()
              }} />
          </motion.div>

          <AnimatePresence initial={false}>
            {kind === 'register' && (
              <motion.div key="repeat" className="auth-collapse" initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}>
                <div className="field">
                  <label htmlFor="auth-repeat">Passwort wiederholen</label>
                  <input id="auth-repeat" ref={repeatRef} className="input" type="password" name="password-repeat"
                    autoComplete="new-password" enterKeyHint="go" value={repeat}
                    onChange={(e) => { setRepeat(e.target.value); setError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit() } }} />
                </div>
                <p className="auth-note">Merk dir dein Passwort gut – ohne E-Mail-Adresse lässt es sich nicht zurücksetzen.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {error && (
              <motion.p key="err" className="auth-error" role="alert" initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{error}</motion.p>
            )}
          </AnimatePresence>

          <motion.div {...field(3)}>
            <PillButton tint block onClick={() => void submit()} disabled={busy}>
              {busy ? <span className="spinner sm on-tint" /> : kind === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </PillButton>
          </motion.div>
        </motion.form>

        {!asGuest && (
          <motion.div className="auth-guest" {...field(5)}>
            <button type="button" className="auth-link" onClick={continueAsGuest}>Als Gast fortfahren</button>
            <span className="muted">Deine Sammlung bleibt dann nur auf diesem Gerät. Ein Konto kannst du später im Profil anlegen.</span>
          </motion.div>
        )}
        {asGuest && (
          <motion.div className="auth-guest" {...field(5)}>
            <CloudUpload size={18} className="muted" />
            <span className="muted">Was du als Gast gesammelt hast, wird in dein Konto übernommen.</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
