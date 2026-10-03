import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages liegt unter /<repo>/ – die Action setzt BASE_PATH, lokal bleibt es /.
  base: process.env.BASE_PATH ?? '/',
  // Modus "phone" (npm run dev:phone): selbstsigniertes Zertifikat, damit Safari auf dem iPhone
  // den Standort freigibt – Geolocation funktioniert dort nur über HTTPS.
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  // MapLibres Worker ist ein ES-Modul mit eigenen Importen
  worker: { format: 'es' },
  server: {
    port: 5173,
    // Im WLAN erreichbar, damit die App direkt auf dem iPhone getestet werden kann.
    host: true,
    // API-Anfragen der App gehen an den lokalen Node-Server (server/index.ts).
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` },
  },
}))
