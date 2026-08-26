import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles/global.css'
import App from './App'
import { engine, restoreSession } from './state/session'
import { initCoach } from './lib/coach'

async function bootstrap() {
  // Revive an in-flight run (e.g. the page was reloaded mid-workout).
  await restoreSession().catch(() => false)

  // Split & goal announcements ride the tracker's snapshot stream.
  initCoach(engine)

  if ('serviceWorker' in navigator) {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
