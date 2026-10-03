export interface LatLon {
  lat: number
  lon: number
}

/** Luftlinie in Kilometern (Haversine). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Aktueller Standort über die Browser-Geolocation. */
export function getCurrentPosition(): Promise<LatLon> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Standort wird von diesem Browser nicht unterstützt'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Standortfreigabe abgelehnt' : 'Standort nicht ermittelbar')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  })
}

export interface PlaceResult extends LatLon {
  label: string
}

/** Ortssuche (Stadt, PLZ, Adresse) über OpenStreetMap Nominatim. */
export async function searchPlace(query: string): Promise<PlaceResult[]> {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=de&q=' + encodeURIComponent(query)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Ortssuche fehlgeschlagen')
  const json = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  return json.map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), label: r.display_name }))
}
