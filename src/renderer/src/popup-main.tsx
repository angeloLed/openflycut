import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PopupApp from './popup/PopupApp'
import './shared/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
)
