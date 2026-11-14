import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ModeRoot } from './ModeRoot.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModeRoot />
  </StrictMode>,
)
