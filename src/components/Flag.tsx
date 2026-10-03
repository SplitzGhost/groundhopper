// Kleine Länderflaggen als SVG – sehen auf allen Geräten gleich aus (Emoji-Flaggen nicht).

import { useId } from 'react'

const FLAGS: Record<string, React.ReactNode> = {
  de: <><rect width="30" height="7" fill="#1a1a1a" /><rect y="7" width="30" height="6" fill="#dd2a2a" /><rect y="13" width="30" height="7" fill="#ffcd00" /></>,
  gb: <><rect width="30" height="20" fill="#fff" /><rect x="12.5" width="5" height="20" fill="#d8202f" /><rect y="7.5" width="30" height="5" fill="#d8202f" /></>,
  es: <><rect width="30" height="20" fill="#c60b1e" /><rect y="5" width="30" height="10" fill="#ffc400" /></>,
  it: <><rect width="10" height="20" fill="#009246" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ce2b37" /></>,
  fr: <><rect width="10" height="20" fill="#0055a4" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ef4135" /></>,
  mc: <><rect width="30" height="10" fill="#ce1126" /><rect y="10" width="30" height="10" fill="#fff" /></>,
}

export function Flag({ code, size = 18, className = '' }: { code: string; size?: number; className?: string }) {
  // Eigene ID je Flagge: eine geteilte clipPath-ID bricht, wenn die erste Flagge ausgeblendet ist
  const clip = 'flag' + useId().replace(/:/g, '')
  return (
    <svg className={`flag-svg ${className}`} width={size * 1.5} height={size} viewBox="0 0 30 20" aria-hidden>
      <defs>
        <clipPath id={clip}><rect width="30" height="20" rx="4" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {FLAGS[code] ?? <rect width="30" height="20" fill="#c7cdd6" />}
      </g>
      <rect x="0.5" y="0.5" width="29" height="19" rx="3.6" fill="none" stroke="rgba(0,0,0,.14)" />
    </svg>
  )
}
