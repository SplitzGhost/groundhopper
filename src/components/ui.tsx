// Kleine, wiederverwendbare Bedienelemente im iOS-/Liquid-Glass-Stil.

import { useState, type PointerEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { softSpring, spring } from '../lib/motion.ts'
import { Star } from 'lucide-react'
import { StadiumIcon } from './icons.tsx'


/** Lichtfleck auf Glas dort, wo der Finger aufsetzt. */
function usePressLight() {
  const [pressed, setPressed] = useState(false)
  return {
    'data-pressed': pressed,
    onPointerDown(e: PointerEvent<HTMLElement>) {
      const r = e.currentTarget.getBoundingClientRect()
      e.currentTarget.style.setProperty('--px', `${e.clientX - r.left}px`)
      e.currentTarget.style.setProperty('--py', `${e.clientY - r.top}px`)
      setPressed(true)
    },
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
  }
}

interface GlassButtonProps {
  icon: ReactNode
  label: string
  onClick?: () => void
  active?: boolean
  tint?: boolean
  small?: boolean
  badge?: number | null
  className?: string
}

export function GlassButton({ icon, label, onClick, active, tint, small, badge, className = '' }: GlassButtonProps) {
  const light = usePressLight()
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      className={`glass glass-btn ${small ? 'sm' : ''} ${tint ? 'glass-tint' : ''} ${active ? 'active' : ''} ${className}`}
      whileTap={{ scale: 0.86 }}
      transition={spring}
      onClick={onClick}
      {...light}
    >
      {icon}
      {!!badge && (
        <motion.span className="badge-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
          {badge}
        </motion.span>
      )}
    </motion.button>
  )
}

interface PillButtonProps {
  children: ReactNode
  onClick?: () => void
  tint?: boolean
  small?: boolean
  block?: boolean
  className?: string
  disabled?: boolean
}

export function PillButton({ children, onClick, tint, small, block, className = '', disabled }: PillButtonProps) {
  const light = usePressLight()
  return (
    <motion.button
      type="button"
      disabled={disabled}
      className={`glass pill-btn ${tint ? 'glass-tint' : ''} ${small ? 'sm' : ''} ${block ? 'block' : ''} ${className}`}
      whileTap={{ scale: 0.95 }}
      transition={spring}
      onClick={onClick}
      style={disabled ? { opacity: 0.5 } : undefined}
      {...light}
    >
      {children}
    </motion.button>
  )
}

// ---------- Wappen ----------

export function Crest({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const initials = name.replace(/\b(FC|CF|AC|SC|SV|AS|SS|RC|CA|1\.|FSV|TSG|VfB|VfL)\b/g, '').trim()
    .split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="crest" style={{ width: size, height: size, ['--s' as string]: `${size}px` }}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="crest-fallback">{initials || '?'}</span>
      )}
    </span>
  )
}

// ---------- Haken „Ich war da“ ----------

export function CheckToggle({ checked, onToggle, size = 28 }: { checked: boolean; onToggle: () => void; size?: number }) {
  // Zählt nur echte Antipp-Aktionen, damit beim Rendern bereits abgehakter Spiele nichts aufploppt.
  const [burst, setBurst] = useState(0)
  return (
    <motion.button
      type="button"
      className="check-btn"
      aria-label={checked ? 'Besuch entfernen' : 'Ich war da'}
      aria-pressed={checked}
      whileTap={{ scale: 0.78 }}
      transition={spring}
      onClick={(e) => {
        e.stopPropagation()
        if (!checked) setBurst((b) => b + 1)
        onToggle()
      }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        initial={false}
        animate={checked ? { scale: [1, 1.22, 1] } : { scale: 1 }}
        transition={{ duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }}
      >
        <circle
          cx="14" cy="14" r="12.5"
          strokeWidth={1.8}
          style={{
            fill: checked ? 'var(--accent)' : 'transparent',
            stroke: checked ? 'var(--accent)' : 'var(--text-3)',
            transition: 'fill .25s, stroke .25s',
          }}
        />
        <motion.path
          d="M8.6 14.6l3.6 3.6 7.3-7.9"
          fill="none"
          stroke="#fff"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1], delay: checked ? 0.06 : 0 }}
        />
      </motion.svg>
      {checked && burst > 0 && (
        <motion.span
          key={burst}
          style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '2px solid var(--accent)', pointerEvents: 'none' }}
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </motion.button>
  )
}

// ---------- Merken-Stern ----------

export function StarToggle({ on, onToggle, size = 22 }: { on: boolean; onToggle: () => void; size?: number }) {
  return (
    <motion.button
      type="button"
      className="check-btn"
      aria-label={on ? 'Nicht mehr merken' : 'Spiel merken'}
      aria-pressed={on}
      whileTap={{ scale: 0.78 }}
      transition={spring}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <motion.span
        style={{ display: 'grid', color: on ? 'var(--gold)' : 'var(--text-3)', transition: 'color .25s' }}
        initial={false}
        animate={on ? { scale: [1, 1.35, 1], rotate: [0, -12, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
      >
        <Star size={size} strokeWidth={2} fill={on ? 'currentColor' : 'none'} />
      </motion.span>
    </motion.button>
  )
}

// ---------- Segmented Control ----------

export function Segmented<T extends string>({ id, options, value, onChange }: {
  id: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={`segment ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={id} className="segment-thumb" transition={softSpring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ---------- Chips ----------

export function Chip({ on, onClick, children, layoutId }: { on: boolean; onClick: () => void; children: ReactNode; layoutId: string }) {
  return (
    <button type="button" className={`chip ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      {on && <motion.span layoutId={layoutId} className="chip-bg" transition={softSpring} />}
      <span>{children}</span>
    </button>
  )
}

// ---------- Schalter ----------

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <motion.span className="switch-knob" animate={{ x: on ? 20 : 0 }} transition={spring}
        whileTap={{ width: 32 }} />
    </button>
  )
}

// ---------- Fortschrittsring ----------

export function ProgressRing({ value, size = 56, stroke = 6, children }: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  return (
    <span className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--fill)' }} />
        {value > 0 && <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          style={{ stroke: value >= 1 ? 'var(--success)' : 'var(--accent)' }}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: value }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
        />}
      </svg>
      {children && <span className="ring-label">{children}</span>}
    </span>
  )
}

// ---------- Leerer Zustand ----------

export function Empty({ icon, title, text, children }: { icon?: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
      <div className="empty-icon">{icon ?? <StadiumIcon size={32} />}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </motion.div>
  )
}
