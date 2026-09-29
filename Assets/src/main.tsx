import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SharedPage from './components/SharedPage.tsx'

const sharedRoute = /^\/share\/([^/]+)\/?$/.exec(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {sharedRoute ? <SharedPage id={sharedRoute[1]} /> : <App />}
  </StrictMode>,
)
