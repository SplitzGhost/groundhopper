// Vektorkarte (MapLibre + OpenFreeMap, ohne API-Schlüssel) mit Stadion-Pins.
// Pins sind HTML-Elemente, damit sie per CSS federnd aufploppen können. Weit herausgezoomt zeichnet
// bei vielen Stadien (weltweit fast 1000) eine Punkt-Ebene auf der GPU – HTML-Pins gibt es dann nur
// im sichtbaren Ausschnitt, sonst ruckelt das Verschieben auf dem iPhone.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
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
/** Bis zu so vielen Pins bleiben alle als HTML-Pins mit Beschriftung (z. B. ein Spieltag in der Nähe) */
const FEW_PINS = 30
/** Höchstzahl gleichzeitiger HTML-Pins im Ausschnitt */
const MAX_DOM_PINS = 320
const SOURCE = 'gh-stadiums'
const DOTS = 'gh-dots'

interface View { far: boolean; bounds: maplibregl.LngLatBounds | null }
type DotData = Exclude<Parameters<maplibregl.GeoJSONSource['setData']>[0], string>

/** Punkt-Ebene für weit herausgezoomt – nach Stilwechsel (Hell/Dunkel) neu anlegen */
function ensureDotLayers(m: maplibregl.Map, data: DotData) {
  const src = m.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined
  if (src) {
    src.setData(data)
    return
  }
  m.addSource(SOURCE, { type: 'geojson', data })
  m.addLayer({
    id: DOTS + '-halo', type: 'circle', source: SOURCE, maxzoom: FAR_ZOOM, filter: ['==', ['get', 'm'], 1],
    paint: { 'circle-radius': 10, 'circle-color': '#0a7cff', 'circle-opacity': 0.22 },
  })
  m.addLayer({
    id: DOTS, type: 'circle', source: SOURCE, maxzoom: FAR_ZOOM,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.5, 3.6, FAR_ZOOM, 6.5],
      'circle-color': ['case', ['==', ['get', 'v'], 1], '#0a7cff', '#ffffff'],
      'circle-stroke-color': ['case', ['==', ['get', 'v'], 1], '#ffffff', '#0a7cff'],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 2.5, 1.6, FAR_ZOOM, 2.6],
    },
  })
}

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
  const [view, setView] = useState<View>({ far: startZoom < FAR_ZOOM, bounds: null })
  const dotData = useRef<DotData>({ type: 'FeatureCollection', features: [] })

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
    const updateFar = () => {
      const far = m.getZoom() < FAR_ZOOM
      m.getContainer().classList.toggle('zoom-far', far)
      // Beim Überschreiten der Schwelle sofort umschalten, nicht erst am Ende der Geste
      setView((v) => (v.far === far ? v : { ...v, far }))
    }
    m.on('zoom', updateFar)
    updateFar()
    m.on('moveend', () => setView({ far: m.getZoom() < FAR_ZOOM, bounds: m.getBounds() }))
    m.on('load', () => setView({ far: m.getZoom() < FAR_ZOOM, bounds: m.getBounds() }))
    m.on('style.load', () => ensureDotLayers(m, dotData.current))
    // Punkte sind klein – großzügig um den Finger herum suchen
    m.on('click', (e) => {
      if (!m.getLayer(DOTS)) return
      const { x, y } = e.point
      const hit = m.queryRenderedFeatures([[x - 16, y - 16], [x + 16, y + 16]], { layers: [DOTS] })[0]
      const id = hit?.properties?.id as string | undefined
      if (id) clickRef.current(id)
    })
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

  const few = pins.length <= FEW_PINS

  // Punkt-Ebene: alle Pins, solange es viele sind
  useEffect(() => {
    if (!map) return
    dotData.current = {
      type: 'FeatureCollection',
      features: few ? [] : pins.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.stadium.lon, p.stadium.lat] },
        properties: { id: p.stadium.id, v: visited.has(p.stadium.id) ? 1 : 0, m: p.hasMatch ? 1 : 0 },
      })),
    }
    if (map.isStyleLoaded()) ensureDotLayers(map, dotData.current)
  }, [map, pins, visited, few])

  // HTML-Pins: bei wenigen alle, sonst nur nah herangezoomt im (großzügigen) Ausschnitt
  const domPins = useMemo(() => {
    if (few) return pins
    const selected = pins.filter((p) => p.stadium.id === selectedId)
    if (view.far || !view.bounds) return selected
    const b = view.bounds
    const padLat = (b.getNorth() - b.getSouth()) * 0.5
    const padLon = (b.getEast() - b.getWest()) * 0.5
    const inView = pins.filter((p) => p.stadium.id !== selectedId
      && p.stadium.lat > b.getSouth() - padLat && p.stadium.lat < b.getNorth() + padLat
      && p.stadium.lon > b.getWest() - padLon && p.stadium.lon < b.getEast() + padLon)
    return [...selected, ...inView.slice(0, MAX_DOM_PINS)]
  }, [few, pins, view, selectedId])

  useEffect(() => {
    if (!map) return
    const current = markers.current
    const wanted = new Set(domPins.map((p) => p.stadium.id))

    for (const [id, e] of current) {
      if (wanted.has(id)) continue
      // Kurz ausblenden, dann entfernen
      e.el.firstElementChild?.classList.add('leaving')
      setTimeout(() => e.marker.remove(), 260)
      current.delete(id)
    }

    let popIndex = 0
    for (const p of domPins) {
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
    map.getContainer().classList.toggle('few-pins', few)
    // Pins mit Spiel über die anderen legen
    for (const p of domPins) {
      const e = current.get(p.stadium.id)
      if (e) e.el.style.zIndex = p.hasMatch ? '2' : '1'
    }
  }, [map, domPins, visited, few])

  // Ausgewählten Pin hervorheben – direkt am Element, ohne Neuaufbau
  useEffect(() => {
    for (const [id, e] of markers.current) {
      const on = id === selectedId
      e.el.firstElementChild?.classList.toggle('selected', on)
      if (on) e.el.style.zIndex = '10'
    }
  }, [selectedId, domPins])

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
