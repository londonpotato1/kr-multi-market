import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pretendard/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
