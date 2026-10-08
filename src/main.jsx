import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { unlockAudio } from './audio/sounds.js'

// Browsers only allow audio after a user gesture; resume it on the first one.
for (const type of ['pointerdown', 'keydown']) {
  window.addEventListener(type, unlockAudio, { passive: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
