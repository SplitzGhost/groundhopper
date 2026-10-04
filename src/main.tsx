import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './cards.css'
import './social.css'
import './hopper.css'
import App from './App.tsx'

const ArtGallery = lazy(() => import('./dev/ArtGallery.tsx').then((m) => ({ default: m.ArtGallery })))
const HopperGallery = lazy(() => import('./dev/HopperGallery.tsx').then((m) => ({ default: m.HopperGallery })))
const gallery = import.meta.env.DEV && location.hash === '#stadien'
const hoppers = import.meta.env.DEV && location.hash.startsWith('#hopper')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gallery ? <Suspense><ArtGallery /></Suspense> : hoppers ? <Suspense><HopperGallery /></Suspense> : <App />}
  </StrictMode>,
)
