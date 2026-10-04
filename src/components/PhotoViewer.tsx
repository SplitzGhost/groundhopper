// Fotos einer Erinnerung in groß: zur Seite wischen blättert, nach unten wischen schließt.
// Bis das volle Bild geladen ist, steht das Vorschaubild unscharf an seiner Stelle.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from '../lib/fastMotion.tsx'
import { Trash2, X } from 'lucide-react'
import type { PhotoInfo } from '../lib/cloud.ts'
import { jpegSrc } from '../lib/images.ts'
import { avatarVersion, deletePhoto, fullPhoto, usePhotos, useSocial } from '../state/social.ts'
import { closePhoto, photoViewStore, showAlert } from '../state/ui.ts'
import { GlassButton } from './ui.tsx'
import { Avatar } from './social.tsx'

export function PhotoViewer() {
  const view = photoViewStore.use()
  return (
    <AnimatePresence>
      {view && <Viewer key={`${view.owner}|${view.visitId}`} owner={view.owner} visitId={view.visitId} photoId={view.photoId} />}
    </AnimatePresence>
  )
}

const dayFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

function Viewer({ owner, visitId, photoId }: { owner: string | null; visitId: string; photoId: string }) {
  const { photos } = usePhotos(owner, visitId)
  const { data } = useSocial()
  const index = Math.max(0, photos.findIndex((p) => p.id === photoId))
  const photo = photos[index] as PhotoInfo | undefined
  // Richtung des letzten Blätterns – das neue Foto kommt von der passenden Seite
  const [dir, setDir] = useState(0)

  useEffect(() => {
    if (!photos.length) closePhoto()
  }, [photos.length])

  // Nachbarn schon vorladen
  useEffect(() => {
    for (const p of [photos[index - 1], photos[index + 1]]) if (p) void fullPhoto(p.id)
  }, [photos, index])

  const go = (d: number) => {
    const next = photos[index + d]
    if (!next) return
    setDir(d)
    photoViewStore.set({ owner, visitId, photoId: next.id })
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { x, y } = info.offset
    if (y > 110 && Math.abs(y) > Math.abs(x)) return closePhoto()
    if (x < -70 || info.velocity.x < -500) go(1)
    else if (x > 70 || info.velocity.x > 500) go(-1)
  }

  const askDelete = () => {
    if (!photo) return
    showAlert({
      title: 'Foto löschen?',
      message: 'Das Foto verschwindet auch bei deinen Freunden.',
      confirm: 'Löschen',
      destructive: true,
      async onConfirm() {
        await deletePhoto(photo)
      },
    })
  }

  // Taste ←/→/Esc am Computer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Escape') closePhoto()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="pv">
      <motion.div className="pv-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
        onClick={closePhoto} />

      <motion.header className="pv-head" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <GlassButton small label="Schließen" icon={<X size={18} strokeWidth={2.6} />} onClick={closePhoto} />
        {photo && (
          <div className="pv-who">
            <Avatar name={photo.username} v={avatarVersion(data, photo.username)} size={30} />
            <div>
              <b>{photo.mine ? 'Dein Foto' : photo.username}</b>
              <span>{dayFmt.format(new Date(photo.at))}</span>
            </div>
          </div>
        )}
        {photo?.mine
          ? <GlassButton small label="Foto löschen" icon={<Trash2 size={17} strokeWidth={2.4} />} onClick={askDelete} />
          : <span style={{ width: 38 }} />}
      </motion.header>

      <div className="pv-stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          {photo && (
            <motion.div key={photo.id} className="pv-photo" custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 260, scale: d ? 0.94 : 0.8 }),
                center: { opacity: 1, x: 0, scale: 1 },
                exit: (d: number) => ({ opacity: 0, x: d * -260, scale: 0.94 }),
              }}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              drag dragSnapToOrigin dragElastic={0.6} onDragEnd={onDragEnd}>
              <FullImage photo={photo} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {photos.length > 1 && (
        <motion.div className="pv-dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {photos.map((p, i) => <i key={p.id} className={i === index ? 'on' : ''} />)}
        </motion.div>
      )}
    </div>
  )
}

function FullImage({ photo }: { photo: PhotoInfo }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void fullPhoto(photo.id).then((s) => {
      if (alive) setSrc(s)
    })
    return () => {
      alive = false
    }
  }, [photo.id])
  return (
    <>
      <img className="pv-thumb" src={jpegSrc(photo.thumb)} alt="" draggable={false} />
      {src && <motion.img className="pv-full" src={src} alt="" draggable={false} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />}
      {!src && <span className="spinner on-tint pv-spinner" />}
    </>
  )
}
