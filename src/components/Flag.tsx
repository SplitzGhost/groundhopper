// Kleine Länderflaggen als SVG – sehen auf allen Geräten gleich aus (Emoji-Flaggen nicht).
// Bei 10–20 pt Höhe reichen vereinfachte Formen; Wappen und feine Details sind weggelassen.

import { useId, type ReactNode } from 'react'

/** Drei waagerechte Streifen */
const h3 = (a: string, b: string, c: string) => <><rect width="30" height="7" fill={a} /><rect y="6.7" width="30" height="6.6" fill={b} /><rect y="13.3" width="30" height="6.7" fill={c} /></>
/** Drei senkrechte Streifen */
const v3 = (a: string, b: string, c: string) => <><rect width="10" height="20" fill={a} /><rect x="10" width="10" height="20" fill={b} /><rect x="20" width="10" height="20" fill={c} /></>
/** Skandinavisches Kreuz */
const nordic = (bg: string, cross: string, inner?: string) => <>
  <rect width="30" height="20" fill={bg} />
  <rect x="8" width="6" height="20" fill={cross} /><rect y="7" width="30" height="6" fill={cross} />
  {inner && <><rect x="9.5" width="3" height="20" fill={inner} /><rect y="8.5" width="30" height="3" fill={inner} /></>}
</>
const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`
  }).join(' ')
  return <polygon key={`${cx},${cy}`} points={pts} fill={fill} />
}
const sun = (cx: number, cy: number, fill: string) => <circle cx={cx} cy={cy} r="2.6" fill={fill} />

const FLAGS: Record<string, ReactNode> = {
  de: <><rect width="30" height="7" fill="#1a1a1a" /><rect y="7" width="30" height="6" fill="#dd2a2a" /><rect y="13" width="30" height="7" fill="#ffcd00" /></>,
  gb: <><rect width="30" height="20" fill="#fff" /><rect x="12.5" width="5" height="20" fill="#d8202f" /><rect y="7.5" width="30" height="5" fill="#d8202f" /></>,
  'gb-sct': <><rect width="30" height="20" fill="#0065bd" /><path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="3.4" /></>,
  'gb-wls': <><rect width="30" height="10" fill="#fff" /><rect y="10" width="30" height="10" fill="#00b140" /><path d="M8 13c3-6 9-8 13-5l3-2-1 4c1 3-2 6-6 6H9z" fill="#d30731" /></>,
  es: <><rect width="30" height="20" fill="#c60b1e" /><rect y="5" width="30" height="10" fill="#ffc400" /></>,
  ad: v3('#10069f', '#fedd00', '#d50032'),
  it: v3('#009246', '#fff', '#ce2b37'),
  fr: v3('#0055a4', '#fff', '#ef4135'),
  mc: <><rect width="30" height="10" fill="#ce1126" /><rect y="10" width="30" height="10" fill="#fff" /></>,
  nl: h3('#ae1c28', '#fff', '#21468b'),
  pt: <><rect width="30" height="20" fill="#da291c" /><rect width="12" height="20" fill="#046a38" /><circle cx="12" cy="10" r="3.6" fill="#ffe900" /></>,
  be: v3('#1a1a1a', '#fdda24', '#ef3340'),
  at: h3('#c8102e', '#fff', '#c8102e'),
  ch: <><rect width="30" height="20" fill="#da291c" /><rect x="13" y="4" width="4" height="12" fill="#fff" /><rect x="9" y="8" width="12" height="4" fill="#fff" /></>,
  tr: <><rect width="30" height="20" fill="#e30a17" /><circle cx="11" cy="10" r="5" fill="#fff" /><circle cx="12.3" cy="10" r="4" fill="#e30a17" />{star(18, 10, 2.4, '#fff')}</>,
  gr: <>
    {Array.from({ length: 9 }, (_, i) => <rect key={i} y={i * 2.22} width="30" height="2.3" fill={i % 2 ? '#fff' : '#0d5eaf'} />)}
    <rect width="11" height="11.1" fill="#0d5eaf" /><rect x="4.4" width="2.2" height="11.1" fill="#fff" /><rect y="4.4" width="11" height="2.2" fill="#fff" />
  </>,
  dk: nordic('#c8102e', '#fff'),
  no: nordic('#ba0c2f', '#fff', '#00205b'),
  se: nordic('#006aa7', '#fecc02'),
  ru: h3('#fff', '#0039a6', '#d52b1e'),
  us: <>
    <rect width="30" height="20" fill="#fff" />
    {Array.from({ length: 7 }, (_, i) => <rect key={i} y={(i * 40) / 13} width="30" height={20 / 13} fill="#b22234" />)}
    <rect width="13" height="10.8" fill="#3c3b6e" />
  </>,
  ca: <><rect width="30" height="20" fill="#fff" /><rect width="7.5" height="20" fill="#d52b1e" /><rect x="22.5" width="7.5" height="20" fill="#d52b1e" /><path d="M15 4l1.5 3 2-1-1 4 2-1-1 3h-2.5v3h-2v-3H11l-1-3 2 1-1-4 2 1z" fill="#d52b1e" /></>,
  mx: <>{v3('#006847', '#fff', '#ce1126')}<circle cx="15" cy="10" r="2.4" fill="#8c5a2b" /></>,
  hn: <>{h3('#0073cf', '#fff', '#0073cf')}{star(15, 10, 1.6, '#0073cf')}</>,
  cr: <><rect width="30" height="20" fill="#002b7f" /><rect y="3.3" width="30" height="13.4" fill="#fff" /><rect y="6.7" width="30" height="6.6" fill="#ce1126" /></>,
  gt: <>{v3('#4997d0', '#fff', '#4997d0')}<circle cx="15" cy="10" r="2.4" fill="#6c9a3c" /></>,
  sv: <>{h3('#0047ab', '#fff', '#0047ab')}<circle cx="15" cy="10" r="2" fill="#d4af37" /></>,
  br: <><rect width="30" height="20" fill="#009c3b" /><path d="M15 2.5 27 10 15 17.5 3 10z" fill="#ffdf00" /><circle cx="15" cy="10" r="4.2" fill="#002776" /></>,
  ar: <>{h3('#74acdf', '#fff', '#74acdf')}{sun(15, 10, '#f6b40e')}</>,
  cl: <><rect width="30" height="10" fill="#fff" /><rect y="10" width="30" height="10" fill="#d52b1e" /><rect width="10" height="10" fill="#0039a6" />{star(5, 5, 2.6, '#fff')}</>,
  uy: <>
    {Array.from({ length: 9 }, (_, i) => <rect key={i} y={i * 2.22} width="30" height="2.3" fill={i % 2 ? '#0038a8' : '#fff'} />)}
    <rect width="11" height="11.1" fill="#fff" />{sun(5.5, 5.5, '#fcd116')}
  </>,
  co: <><rect width="30" height="10" fill="#fcd116" /><rect y="10" width="30" height="5" fill="#003893" /><rect y="15" width="30" height="5" fill="#ce1126" /></>,
  pe: v3('#d91023', '#fff', '#d91023'),
  py: h3('#d52b1e', '#fff', '#0038a8'),
  ec: <><rect width="30" height="10" fill="#ffdd00" /><rect y="10" width="30" height="5" fill="#034ea2" /><rect y="15" width="30" height="5" fill="#ed1c24" /><circle cx="15" cy="10" r="2.4" fill="#7a5c2e" /></>,
  ve: <>{h3('#ffcc00', '#00247d', '#cf142b')}{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => star(15 + 5 * Math.cos(Math.PI * (1 + i / 7)), 12 + 5 * Math.sin(Math.PI * (1 + i / 7)), 0.8, '#fff'))}</>,
  bo: h3('#d52b1e', '#f9e300', '#007934'),
  jp: <><rect width="30" height="20" fill="#fff" /><circle cx="15" cy="10" r="5.5" fill="#bc002d" /></>,
  cn: <><rect width="30" height="20" fill="#ee1c25" />{star(6, 6, 3.4, '#ffff00')}{star(11.5, 2.5, 1, '#ffff00')}{star(13, 5, 1, '#ffff00')}{star(13, 8.5, 1, '#ffff00')}{star(11.5, 11, 1, '#ffff00')}</>,
  sa: <><rect width="30" height="20" fill="#006c35" /><rect x="8" y="7" width="14" height="1.6" rx="0.8" fill="#fff" /><rect x="9" y="12.5" width="12" height="1" fill="#fff" /></>,
  in: <>{h3('#ff9933', '#fff', '#138808')}<circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.8" /></>,
  au: <><rect width="30" height="20" fill="#012169" /><path d="M0 0 13 9M13 0 0 9" stroke="#fff" strokeWidth="2" /><path d="M6.5 0v9M0 4.5h13" stroke="#fff" strokeWidth="2.6" /><path d="M6.5 0v9M0 4.5h13" stroke="#c8102e" strokeWidth="1.4" />{star(6.5, 15, 2.2, '#fff')}{star(23, 5, 1.2, '#fff')}{star(20, 10, 1.2, '#fff')}{star(26, 9, 1.2, '#fff')}{star(23, 16, 1.2, '#fff')}</>,
  nz: <><rect width="30" height="20" fill="#012169" /><path d="M6.5 0v9M0 4.5h13" stroke="#fff" strokeWidth="2.6" /><path d="M6.5 0v9M0 4.5h13" stroke="#c8102e" strokeWidth="1.4" />{star(22, 5, 1.3, '#c8102e')}{star(19, 10, 1.3, '#c8102e')}{star(25, 9, 1.3, '#c8102e')}{star(22, 16, 1.3, '#c8102e')}</>,
  za: <>
    <rect width="30" height="10" fill="#e03c31" /><rect y="10" width="30" height="10" fill="#001489" />
    <path d="M0 0 14 10 0 20" fill="none" stroke="#fff" strokeWidth="7" /><path d="M0 0 14 10 0 20M14 10h16" fill="none" stroke="#007749" strokeWidth="4.4" />
    <path d="M0 3.5 9 10 0 16.5z" fill="#ffb81c" /><path d="M0 5.5 6.3 10 0 14.5z" fill="#000" />
  </>,
  // ---------- Verbände ----------
  uefa: <><rect width="30" height="20" fill="#003399" />{Array.from({ length: 12 }, (_, i) => star(15 + 6 * Math.cos((i * Math.PI) / 6), 10 + 6 * Math.sin((i * Math.PI) / 6), 1.1, '#ffcc00'))}</>,
  conmebol: <><rect width="30" height="20" fill="#0b2f6b" /><circle cx="15" cy="10" r="5.5" fill="#f2c200" /><circle cx="15" cy="10" r="3.4" fill="#0b2f6b" /></>,
  concacaf: <><rect width="30" height="20" fill="#0f1e3d" /><circle cx="15" cy="10" r="5.5" fill="#c7a34b" /><path d="M10 10h10M15 5v10" stroke="#0f1e3d" strokeWidth="1.4" /></>,
  afc: <><rect width="30" height="20" fill="#0a3d91" /><circle cx="15" cy="10" r="5.5" fill="#fff" /><circle cx="15" cy="10" r="3" fill="#e2001a" /></>,
  caf: <><rect width="30" height="20" fill="#007a3d" /><circle cx="15" cy="10" r="5.5" fill="#fcd116" /><circle cx="15" cy="10" r="2.6" fill="#ce1126" /></>,
  fifa: <><rect width="30" height="20" fill="#326295" /><circle cx="15" cy="10" r="6" fill="none" stroke="#fff" strokeWidth="1.2" /><path d="M9 10h12M15 4c-3 3-3 9 0 12M15 4c3 3 3 9 0 12" fill="none" stroke="#fff" strokeWidth="1" /></>,
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
