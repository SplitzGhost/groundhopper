// Eigene Symbole, die es in lucide nicht gibt (Stadion, Fußball).

interface IconProps {
  size?: number
  className?: string
}

export function StadiumIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="9" rx="9" ry="3.5" />
      <path d="M3 9v6c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V9" />
      <path d="M7 3.2v2.6M12 2.5v3M17 3.2v2.6" />
      <path d="M8 12.2v3.6M16 12.2v3.6" />
    </svg>
  )
}

export function BallIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5l4.2 3-1.6 5h-5.2l-1.6-5z" />
      <path d="M12 7.5V2.6M16.2 10.5l4.6-1.5M14.6 15.5l2.8 4M9.4 15.5l-2.8 4M7.8 10.5L3.2 9" />
    </svg>
  )
}

/** Stadion-Symbol als SVG-Text für Leaflet-Marker (die kein React rendern). */
export const STADIUM_SVG = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="9" ry="3.5"/><path d="M3 9v6c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V9"/><path d="M7 3.2v2.6M12 2.5v3M17 3.2v2.6"/></svg>`

export const CHECK_SVG = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
