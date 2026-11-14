import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Headquarters } from './v2/Headquarters.tsx'

const tutorial = new URLSearchParams(location.search).get('mode') === 'tutorial'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {tutorial ? (
      <>
        <div className="tutorial-banner"><a href="?">Back to agency headquarters</a><span>Classic CubeSat tutorial · Illustrative</span></div>
        <App />
      </>
    ) : <Headquarters />}
  </StrictMode>,
)
