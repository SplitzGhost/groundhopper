// Fotos und Profilbilder vor dem Hochladen auf dem Gerät verkleinern (JPEG).
// Vom iPhone kommen Fotos mit 4–12 MB – hochgeladen werden ein paar hundert KB.

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    // Safari dreht Fotos beim Zeichnen selbst richtig (EXIF-Ausrichtung)
    await img.decode()
    return img
  } finally {
    // Nach decode() steckt das Bild im Speicher, die URL wird nicht mehr gebraucht
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Längste Seite auf `maxSide` bringen; `square` schneidet mittig ein Quadrat aus. */
function draw(img: HTMLImageElement, maxSide: number, square = false): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const side = Math.min(w, h)
  const [sx, sy, sw, sh] = square ? [(w - side) / 2, (h - side) / 2, side, side] : [0, 0, w, h]
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG fehlgeschlagen'))), 'image/jpeg', quality))

async function base64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  return url.slice(url.indexOf(',') + 1)
}

/** JPEG unter `maxBytes`: erst Qualität senken, dann kleiner rechnen. */
async function jpeg(img: HTMLImageElement, maxSide: number, maxBytes: number, square = false): Promise<string> {
  let side = maxSide
  for (;;) {
    const canvas = draw(img, side, square)
    for (let q = 0.82; q >= 0.5; q -= 0.08) {
      const blob = await toBlob(canvas, q)
      if (blob.size <= maxBytes) return base64(blob)
    }
    side = Math.round(side * 0.75)
    if (side < 64) throw new Error('Bild lässt sich nicht verkleinern')
  }
}

/** Foto für eine Erinnerung: großes Bild (≈ 250 KB) und Vorschaubild (≈ 20 KB) als Base64 */
export async function photoFromFile(file: File): Promise<{ image: string; thumb: string }> {
  const img = await loadImage(file)
  const [image, thumb] = await Promise.all([jpeg(img, 1600, 330_000), jpeg(img, 360, 40_000)])
  return { image, thumb }
}

/** Profilbild: quadratisch, 320 px */
export async function avatarFromFile(file: File): Promise<string> {
  return jpeg(await loadImage(file), 320, 60_000, true)
}

export const jpegSrc = (b64: string) => `data:image/jpeg;base64,${b64}`
