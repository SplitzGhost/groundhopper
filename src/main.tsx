import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './cards.css'
import './social.css'
import App from './App.tsx'

const ArtGallery = lazy(() => import('./dev/ArtGallery.tsx').then((m) => ({ default: m.ArtGallery })))
const gallery = import.meta.env.DEV && location.hash === '#stadien'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {gallery ? <Suspense><ArtGallery /></Suspense> : <App />}
  </StrictMode>,
)
