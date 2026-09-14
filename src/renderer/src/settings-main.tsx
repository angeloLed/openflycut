import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SettingsApp from './settings/SettingsApp'
import './shared/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
)
