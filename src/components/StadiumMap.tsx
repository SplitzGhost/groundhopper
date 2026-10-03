// Vektorkarte (MapLibre + OpenFreeMap, ohne API-Schlüssel) mit Stadion-Pins.
// Pins sind HTML-Elemente, damit sie per CSS federnd aufploppen können.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Worker von Vite bündeln lassen – MapLibre sucht ihn sonst neben der (umgebündelten) Bibliothek.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Stadium } from '../shared/types.ts'
import type { LatLon } from '../lib/geo.ts'
import { useDarkMode } from '../lib/useDarkMode.ts'
import { CHECK_SVG, STADIUM_SVG } from './icons.tsx'

maplibregl.setWorkerUrl(workerUrl)

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
/** Unterhalb dieser Zoomstufe werden Pins zu kleinen Punkten */
const FAR_ZOOM = 6.3

export interface Pin {
  stadium: Stadium
  label?: string
  star?: boolean
  hasMatch?: boolean
}

export interface StadiumMapHandle {
  /** Ziel anfliegen; `lift` schiebt es etwas nach oben (über ein offenes Sheet) */
  flyTo(pos: LatLon, opts?: { zoom?: number; minZoom?: number; lift?: boolean; pitch?: number }): void
}

interface Props {
  start: LatLon
  startZoom: number
  pins: Pin[]
  visited: Set<string | null>
  selectedId: string | null
  me: LatLon | null
  onPinClick: (stadiumId: string) => void
}

function pinHtml(p: Pin, visited: boolean, delay: number) {
  const cls = ['gh-marker', visited && 'visited', p.hasMatch && 'has-match'].filter(Boolean).join(' ')
  return `<div class="${cls}" style="--d:${delay}ms">`
    + `<div class="gh-pin">${STADIUM_SVG(18)}</div>`
    + (visited ? `<span class="gh-check">${CHECK_SVG(9)}</span>` : '')
    + (p.label ? `<span class="gh-label ${p.star ? 'star' : ''}">${p.star ? '★ ' : ''}${p.label}</span>` : '')
    + '</div>'
}

/** Inhalt ohne Verzögerung – zum Vergleichen, ob sich ein Pin wirklich geändert hat */
const pinKey = (p: Pin, visited: boolean) => `${visited}|${p.hasMatch}|${p.label}|${p.star}`

interface Entry {
  marker: maplibregl.Marker
  el: HTMLDivElement
  key: string
}

export const StadiumMap = forwardRef<StadiumMapHandle, Props>(function StadiumMap(
  { start, startZoom, pins, visited, selectedId, me, onPinClick }, ref,
) {
  const container = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, Entry>())
  const meMarker = useRef<maplibregl.Marker | null>(null)
  const clickRef = useRef(onPinClick)
  const dark = useDarkMode()
  const styleDark = useRef(dark)

  useEffect(() => {
    clickRef.current = onPinClick
  }, [onPinClick])

  // ---------- Karte anlegen ----------

  useEffect(() => {
    const entries = markers.current
    const m = new maplibregl.Map({
      container: container.current!,
      style: styleDark.current ? STYLES.dark : STYLES.light,
      center: [start.lon, start.lat],
      zoom: startZoom,
      minZoom: 2.5,
      maxPitch: 65,
      attributionControl: false,
      fadeDuration: 250,
    })
    const updateFar = () => m.getContainer().classList.toggle('zoom-far', m.getZoom() < FAR_ZOOM)
    m.on('zoom', updateFar)
    updateFar()
    setMap(m)
    return () => {
      m.remove()
      entries.clear()
      meMarker.current = null
    }
    // Startposition gilt nur beim ersten Anlegen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hell/Dunkel folgt dem System
  useEffect(() => {
    if (!map || styleDark.current === dark) return
    styleDark.current = dark
    map.setStyle(dark ? STYLES.dark : STYLES.light)
  }, [map, dark])

  // ---------- Pins abgleichen ----------

  useEffect(() => {
    if (!map) return
    const current = markers.current
    const wanted = new Set(pins.map((p) => p.stadium.id))

    for (const [id, e] of current) {
      if (wanted.has(id)) continue
      // Kurz ausblenden, dann entfernen
      e.el.firstElementChild?.classList.add('leaving')
      setTimeout(() => e.marker.remove(), 260)
      current.delete(id)
    }

    let popIndex = 0
    for (const p of pins) {
      const id = p.stadium.id
      const v = visited.has(id)
      const key = pinKey(p, v)
      const existing = current.get(id)
      if (existing?.key === key) continue
      // Gestaffeltes Aufploppen – Pins sind nach Entfernung sortiert, also vom Zentrum nach außen
      const html = pinHtml(p, v, Math.min(popIndex++ * 14, 700))
      if (existing) {
        existing.el.innerHTML = html
        existing.key = key
        continue
      }
      const el = document.createElement('div')
      el.className = 'gh-marker-wrap'
      el.innerHTML = html
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        clickRef.current(id)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.stadium.lon, p.stadium.lat]).addTo(map)
      current.set(id, { marker, el, key })
    }
    // Bei wenigen Pins (z. B. ein Spieltag) auch weit herausgezoomt volle Pins mit Uhrzeit zeigen
    map.getContainer().classList.toggle('few-pins', pins.length <= 30)
    // Pins mit Spiel über die anderen legen
    for (const p of pins) {
      const e = current.get(p.stadium.id)
      if (e) e.el.style.zIndex = p.hasMatch ? '2' : '1'
    }
  }, [map, pins, visited])

  // Ausgewählten Pin hervorheben – direkt am Element, ohne Neuaufbau
  useEffect(() => {
    for (const [id, e] of markers.current) {
      const on = id === selectedId
      e.el.firstElementChild?.classList.toggle('selected', on)
      if (on) e.el.style.zIndex = '10'
    }
  }, [selectedId, pins])

  // ---------- Eigener Standort ----------

  useEffect(() => {
    if (!map || !me) return
    if (!meMarker.current) {
      const el = document.createElement('div')
      el.className = 'me-dot'
      meMarker.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([me.lon, me.lat]).addTo(map)
    } else {
      meMarker.current.setLngLat([me.lon, me.lat])
    }
  }, [map, me])

  useImperativeHandle(ref, () => ({
    flyTo(pos, opts = {}) {
      if (!map) return
      const zoom = opts.zoom ?? Math.max(map.getZoom(), opts.minZoom ?? 0)
      map.flyTo({
        center: [pos.lon, pos.lat],
        zoom,
        pitch: opts.pitch ?? (zoom >= 14 ? 50 : 0),
        bearing: zoom >= 14 ? map.getBearing() : 0,
        // Halbhohes Sheet deckt die untere Hälfte ab – Ziel in die Mitte der oberen Hälfte
        offset: opts.lift ? [0, -map.getContainer().clientHeight * 0.24] : [0, 0],
        speed: 1.4,
        curve: 1.5,
        essential: true,
      })
    },
  }), [map])

  return <div ref={container} className="map-canvas" />
})

/** Quellenangabe der Karte: kleiner ⓘ-Knopf, klappt per Tipp auf. */
export function MapAttribution() {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" className={`glass attrib ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}
      aria-label="Kartenquellen" aria-expanded={open}>
      {open
        ? <span>© <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></span>
        : <span>i</span>}
    </button>
  )
}
