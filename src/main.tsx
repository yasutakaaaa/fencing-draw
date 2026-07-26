import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// デプロイ検証用マーカー（本番に反映されたビルドを識別するため）
console.info('[FencingDraw] build marker: owner-fix-1')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
